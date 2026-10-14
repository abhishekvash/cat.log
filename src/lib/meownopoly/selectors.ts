import {
	BOARD,
	FLAP_INDEXES,
	GROUPS,
	type GroupId,
	groupSpaces,
	type RentRow,
	rentTable,
	UTILITY_INDEXES,
} from "./board";
import type { Auction, GameState, Holding, Player } from "./types";

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
		GROUPS.filter((g) => ownsGroup(state, playerId, g.id)).map((g) => g.id),
	);

/** An auction's bids, best first. */
export const rankedBids = (auction: Auction) =>
	Object.entries(auction.bids)
		.map(([id, amount]) => ({ bidder: Number(id), amount }))
		.sort((a, b) => b.amount - a.amount);

/** The bid to beat, or nothing yet. */
export const topBid = (auction: Auction) =>
	rankedBids(auction)[0] ?? { bidder: null, amount: 0 };

/**
 * What landing on an owned space costs right now. `row` is the line of the
 * space's `rentTable` that applies; `waived` says why nothing is due, if so.
 */
export function rentQuote(
	state: GameState,
	index: number,
):
	| (RentRow & { row: number; waived: "mortgaged" | "ownerAtVet" | null })
	| null {
	const space = BOARD[index];
	const holding = state.holdings[index];
	if (!holding) return null;
	const owns = (list: number[]) =>
		list.filter((i) => state.holdings[i]?.owner === holding.owner).length;
	let row: number;
	switch (space.kind) {
		case "street":
			row =
				holding.buildings > 0
					? holding.buildings + 1
					: ownsGroup(state, holding.owner, space.group)
						? 1
						: 0;
			break;
		case "flap":
			row = owns(FLAP_INDEXES) - 1;
			break;
		case "utility":
			row = owns(UTILITY_INDEXES) === UTILITY_INDEXES.length ? 1 : 0;
			break;
		default:
			return null;
	}
	const waived = holding.mortgaged
		? "mortgaged"
		: state.rules.noRentAtVet && playerById(state, holding.owner)?.atVet
			? "ownerAtVet"
			: null;
	return { ...rentTable(space)[row], row, waived };
}
