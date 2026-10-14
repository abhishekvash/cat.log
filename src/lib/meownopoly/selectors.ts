import {
	BOARD,
	FLAP_INDEXES,
	flapRent,
	type GroupId,
	groupSpaces,
	UTILITY_INDEXES,
	UTILITY_MULTIPLIER,
} from "./board";
import type { GameState, Holding, Player } from "./types";

/**
 * Read-only questions about a game, shared by the engine and the UI so both
 * answer them the same way.
 */

export const playerById = (state: GameState, id: number | null | undefined) =>
	state.players.find((p) => p.id === id);

export const activePlayers = (state: GameState) =>
	state.players.filter((p) => !p.bankrupt);

/**
 * The one player a debtor owes everything to, who inherits their things on
 * bankruptcy. Anyone else (the bank, or several creditors) and it goes to the bank.
 */
export function soleCreditor(state: GameState, debtor: Player) {
	const ids = new Set(debtor.debts.map((d) => d.to));
	if (ids.size !== 1) return undefined;
	const creditor = playerById(state, debtor.debts[0].to);
	return creditor && !creditor.bankrupt ? creditor : undefined;
}

/** A player's holdings in board order. */
export function holdingsOf(
	state: GameState,
	playerId: number,
): { index: number; holding: Holding }[] {
	return Object.entries(state.holdings)
		.filter(([, holding]) => holding.owner === playerId)
		.map(([key, holding]) => ({ index: Number(key), holding }))
		.sort((a, b) => a.index - b.index);
}

export const ownsGroup = (state: GameState, playerId: number, group: GroupId) =>
	groupSpaces(group).every((i) => state.holdings[i]?.owner === playerId);

export const groupHasBuildings = (state: GameState, group: GroupId) =>
	groupSpaces(group).some((i) => (state.holdings[i]?.buildings ?? 0) > 0);

/** Identifies the latest roll, so a fresh one can animate even if the faces repeat. */
export const lastRollId = (state: GameState) => state.rolls || undefined;

/** The groups a player owns outright. */
export const completeGroups = (state: GameState, playerId: number) =>
	new Set(
		Object.keys(state.holdings).flatMap((key) => {
			const space = BOARD[Number(key)];
			return space.kind === "street" && ownsGroup(state, playerId, space.group)
				? [space.group]
				: [];
		}),
	);

/**
 * What landing on an owned space costs right now, before mortgages and house
 * rules. `row` is the line of the space's rent table that applies (streets:
 * base, whole group, 1 to 4 boxes, cat house; flaps: by count; utilities: one
 * or both). Utilities charge `amount` times the dice.
 */
export function rentQuote(
	state: GameState,
	index: number,
): { row: number; amount: number; perDice: boolean } | null {
	const space = BOARD[index];
	const holding = state.holdings[index];
	if (!holding) return null;
	const owns = (list: number[]) =>
		list.filter((i) => state.holdings[i]?.owner === holding.owner).length;
	switch (space.kind) {
		case "street": {
			if (holding.buildings > 0)
				return {
					row: holding.buildings + 1,
					amount: space.rent[holding.buildings],
					perDice: false,
				};
			const set = ownsGroup(state, holding.owner, space.group);
			return {
				row: set ? 1 : 0,
				amount: set ? space.rent[0] * 2 : space.rent[0],
				perDice: false,
			};
		}
		case "flap": {
			const count = owns(FLAP_INDEXES);
			return { row: count - 1, amount: flapRent(count), perDice: false };
		}
		case "utility": {
			const both = owns(UTILITY_INDEXES) === UTILITY_INDEXES.length;
			return {
				row: both ? 1 : 0,
				amount: both ? UTILITY_MULTIPLIER.both : UTILITY_MULTIPLIER.one,
				perDice: true,
			};
		}
		default:
			return null;
	}
}
