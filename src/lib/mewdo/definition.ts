import type { GameDefinition } from "#/lib/multiplayer/types";
import { mewdoClient } from "./client";
import { reduce, removePlayer, skipTurn, start } from "./engine";
import {
	DEFAULT_HOUSE_RULES,
	type GameState,
	type HouseRules,
	type Move,
	STATE_VERSION,
} from "./types";

/** Mewdo as an online game: the rules engine plugged into the shared rooms. */
export const mewdo: GameDefinition<GameState, Move, HouseRules> = {
	...mewdoClient,
	version: STATE_VERSION,
	defaultRules: DEFAULT_HOUSE_RULES,
	sanitizeRules: () => ({}),
	start: (seats, _rules, ctx) => start(seats, ctx),
	reduce,
	isOver: (state) => state.phase === "finished",
	skipTurn,
	removeSeat: removePlayer,
};
