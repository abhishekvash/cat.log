import type { ClientGame } from "#/lib/multiplayer/types";
import { GAME_NAME } from "./board";
import { playerById } from "./selectors";
import { type GameState, MAX_PLAYERS, MIN_PLAYERS } from "./types";

/** Browser-facing metadata and selectors, without the authoritative engine. */
export const meownopolyClient: ClientGame<GameState> = {
	id: "meownopoly",
	name: GAME_NAME,
	minPlayers: MIN_PLAYERS,
	maxPlayers: MAX_PLAYERS,
	currentPlayer: (state) => state.turn?.playerId ?? null,
	isOut: (state, seat) => playerById(state, seat)?.bankrupt ?? false,
};
