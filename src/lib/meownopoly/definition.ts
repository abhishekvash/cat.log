import type { GameDefinition } from "#/lib/multiplayer/types";
import { meownopolyClient } from "./client";
import { reduce, removePlayer, skipTurn, start, tick } from "./engine";
import {
	DEFAULT_HOUSE_RULES,
	type GameState,
	type HouseRules,
	type Move,
	STATE_VERSION,
} from "./types";

/** Meownopoly as an online game: the rules engine plugged into the shared rooms. */
export const meownopoly: GameDefinition<GameState, Move, HouseRules> = {
	...meownopolyClient,
	version: STATE_VERSION,
	defaultRules: DEFAULT_HOUSE_RULES,
	sanitizeRules: (raw) => {
		const rules = (raw ?? {}) as Partial<Record<keyof HouseRules, unknown>>;
		return Object.fromEntries(
			Object.keys(DEFAULT_HOUSE_RULES).map((key) => [
				key,
				!!rules[key as keyof HouseRules],
			]),
		) as unknown as HouseRules;
	},
	start,
	reduce,
	isOver: (state) => state.phase === "finished",
	skipTurn,
	removeSeat: removePlayer,
	nextTimer: (state) => state.auction?.endsAt ?? null,
	tick,
	// The deck order is what gets drawn next; nobody gets to peek.
	view: (state) => ({ ...state, decks: { zoomies: [], treatJar: [] } }),
};
