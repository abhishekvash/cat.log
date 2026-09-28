import { type GroupId, groupSpaces } from "./board";
import type { GameState, Holding } from "./types";

/**
 * Read-only questions about a game, shared by the engine and the UI so both
 * answer them the same way.
 */

export const playerById = (state: GameState, id: number | null | undefined) =>
	state.players.find((p) => p.id === id);

export const activePlayers = (state: GameState) =>
	state.players.filter((p) => !p.bankrupt);

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
