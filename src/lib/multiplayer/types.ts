import type { Cat } from "#/lib/cats";
import type { Rng } from "#/lib/rng";

/**
 * The contract between an online game's rules and the shared room machinery.
 * A game implements `GameDefinition`; rooms, seats, the lobby, presence,
 * reconnection, timers and tidying up all come from `room.ts`.
 */

/** Stable for the life of a room; games use it as their player id. */
export type SeatId = number;

export interface Seat {
	id: SeatId;
	name: string;
	cat: Cat;
	/** Has a device connected right now. */
	connected: boolean;
	/** Disconnected, or sitting on their turn, for a while. The host may step in. */
	away: boolean;
}

/** Everything a rule may depend on besides the state, so rules stay pure. */
export interface Context {
	rng: Rng;
	now: number;
}

export type Result<S> = { ok: true; state: S } | { ok: false; error: string };

/** A rule said no. The message is shown to the player as-is. */
export class Rejection extends Error {}

export function reject(message: string): never {
	throw new Rejection(message);
}

/**
 * Runs `change` on a copy of `state`. A `reject()` inside turns into a failed
 * result and leaves `state` untouched; any other error is a bug and is rethrown.
 * `copy` defaults to a deep copy; pass a cheaper one when `change` only touches
 * part of the state.
 */
export function attempt<S>(
	state: S,
	change: (draft: S) => void,
	copy: (state: S) => S = structuredClone,
): Result<S> {
	const draft = copy(state);
	try {
		change(draft);
	} catch (error) {
		if (error instanceof Rejection) return { ok: false, error: error.message };
		throw error;
	}
	return { ok: true, state: draft };
}

export interface GameDefinition<State, Move, Rules, View = State> {
	/** Short and URL-safe: names the party, storage keys and the route. */
	id: string;
	name: string;
	/** Bump when `State` changes shape; rooms saved by another version end politely. */
	version: number;
	minPlayers: number;
	maxPlayers: number;
	defaultRules: Rules;
	/** Cleans rules sent by the host (untrusted input). */
	sanitizeRules(raw: unknown): Rules;
	/** Deals a fresh game for the seated players, in lobby order. */
	start(seats: readonly Seat[], rules: Rules, ctx: Context): State;
	/** Applies one player's move. Never mutates `state`. */
	reduce(state: State, seat: SeatId, move: Move, ctx: Context): Result<State>;
	/** Whose turn it is, for spotting someone sitting on it. */
	currentPlayer(state: State): SeatId | null;
	/** Knocked out, but still watching. */
	isOut(state: State, seat: SeatId): boolean;
	isOver(state: State): boolean;
	/** The host moves on past a player who wandered off. */
	skipTurn(state: State, ctx: Context): Result<State>;
	/** The host takes a player who wandered off out of the game. */
	removeSeat(state: State, seat: SeatId, ctx: Context): Result<State>;
	/** When the game next needs to act on its own (an auction clock, say). */
	nextTimer?(state: State): number | null;
	/** What happens when that time comes. */
	tick?(state: State, ctx: Context): Result<State>;
	/** What one seat (or a spectator) may see. Defaults to everything. */
	view?(state: State, seat: SeatId | null): View;
}

export type RoomPhase = "lobby" | "playing" | "finished";

/** What every seat and spectator sees of a room. `game` is the game's view. */
export interface RoomState<Game, Rules> {
	version: number;
	phase: RoomPhase;
	seats: Seat[];
	hostId: SeatId | null;
	nextSeatId: SeatId;
	rules: Rules;
	/** Null in the lobby. Kept once the game ends, for the results. */
	game: Game | null;
	/** Counts games started in this room, so a rematch is a fresh game. */
	round: number;
	/** Bumps on every change anyone can see. */
	seq: number;
}
