import type { GameDefinition } from "#/lib/multiplayer/types";
import { GAME_NAME } from "./board";
import { reduce, removePlayer, skipTurn, start, tick } from "./engine";
import { playerById } from "./selectors";
import {
	DEFAULT_HOUSE_RULES,
	type GameState,
	type HouseRules,
	MAX_PLAYERS,
	MIN_PLAYERS,
	type Move,
	STATE_VERSION,
} from "./types";

/** Monopawly as an online game: the rules engine plugged into the shared rooms. */
export const monopawly: GameDefinition<GameState, Move, HouseRules> = {
	id: "monopawly",
	name: GAME_NAME,
	version: STATE_VERSION,
	minPlayers: MIN_PLAYERS,
	maxPlayers: MAX_PLAYERS,
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
	currentPlayer: (state) => state.turn?.playerId ?? null,
	isOut: (state, seat) => playerById(state, seat)?.bankrupt ?? false,
	isOver: (state) => state.phase === "finished",
	skipTurn,
	removeSeat: removePlayer,
	nextTimer: (state) => state.auction?.endsAt ?? null,
	tick,
};
