import type { ClientGame } from "#/lib/multiplayer/types";
import { GAME_NAME } from "./board";
import { type GameState, MAX_PLAYERS, MIN_PLAYERS } from "./types";

/** Browser-facing metadata and selectors, without the authoritative engine. */
export const mewdoClient: ClientGame<GameState> = {
	id: "mewdo",
	name: GAME_NAME,
	minPlayers: MIN_PLAYERS,
	maxPlayers: MAX_PLAYERS,
	currentPlayer: (state) => state.turn?.playerId ?? null,
	// Home with every kitten (or gone): no more turns, just watching.
	isOut: (state, seat) => {
		const p = state.players.find((x) => x.id === seat);
		return !!p && (p.gone || p.place !== null);
	},
};
