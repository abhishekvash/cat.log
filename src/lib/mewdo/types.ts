import type { Cat } from "#/lib/cats";
import type { SeatId } from "#/lib/multiplayer/types";

/** Bump when `GameState` changes shape; rooms saved by another version end politely. */
export const STATE_VERSION = 1;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const KITTENS = 4;
export const LOG_LIMIT = 200;

/** Mewdo has no house rules (yet); the rooms still want a rules object. */
export type HouseRules = Record<string, never>;
export const DEFAULT_HOUSE_RULES: HouseRules = {};

/** One of the four corners of the board, clockwise from the bottom left. */
export type Corner = 0 | 1 | 2 | 3;

/**
 * Where a kitten is, counted in steps from its own corner's start square:
 * `BASKET` is still in the basket, 0–50 is out on the shared track, 51–55 is
 * the home lane and `HOME` is in the food bowl.
 */
export type Progress = number;

export interface Player {
	/** The player's seat in the room; used everywhere a player is referenced. */
	id: SeatId;
	/** Copied from the seat when the game starts (names can't change mid-game). */
	name: string;
	cat: Cat;
	corner: Corner;
	/** Each kitten's progress. Always `KITTENS` long. */
	kittens: Progress[];
	/** 1 for first home, 2 for second, and so on. Null while still playing. */
	place: number | null;
	/** Left or was removed: their kittens are off the board and they're unplaced. */
	gone: boolean;
}

export type TurnPhase = "roll" | "move";

export interface Turn {
	playerId: SeatId;
	phase: TurnPhase;
	/** The roll waiting to be moved, while `phase` is "move". */
	roll: number | null;
	/** Sixes rolled in a row this turn; the third one ends it. */
	sixes: number;
	/** Kittens that can take the roll, one per distinct square. */
	movable: number[];
}

/** The last kitten to move, for the board to hop along its path. */
export interface KittenMove {
	/** Counts every move, so each one has an id the animation can key on. */
	id: number;
	playerId: SeatId;
	kitten: number;
	from: Progress;
	to: Progress;
	/** Kittens booped back to their basket by landing here. */
	booped: { playerId: SeatId; kitten: number; from: Progress }[];
}

export interface LastRoll {
	/** Counts every roll, so each one has an id the dice animation can key on. */
	id: number;
	playerId: SeatId;
	value: number;
}

export interface LogEntry {
	id: number;
	text: string;
}

/** One game, from the first roll until every place is decided. The room owns the lobby. */
export interface GameState {
	phase: "playing" | "finished";
	/** In turn order (clockwise from corner 0). */
	players: Player[];
	turn: Turn | null;
	lastRoll: LastRoll | null;
	lastMove: KittenMove | null;
	log: LogEntry[];
}

export type Move = { type: "roll" } | { type: "move"; kitten: number };
