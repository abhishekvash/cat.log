import type { Corner, Progress } from "./types";

/**
 * The shape of a Mewdo board: a shared loop of 52 squares, four baskets, and a
 * five-square home lane up to the food bowl in the middle for each corner.
 * Positions here are abstract; the screens decide where squares are drawn.
 */

export const GAME_NAME = "Mewdo";

export const TRACK = 52;
/** Squares between one corner's start and the next. */
export const CORNER_SPAN = TRACK / 4;
export const BASKET: Progress = -1;
/** The last square of the shared track before turning up the home lane. */
export const LAST_TRACK: Progress = TRACK - 2;
export const HOME_LANE = 5;
export const HOME: Progress = LAST_TRACK + HOME_LANE + 1;
/** A kitten needs this roll to leave the basket. */
export const LEAVE_ROLL = 6;

/** The start square, and the cushion eight squares on, in every corner. */
const SAFE_OFFSETS = [0, 8];

/** Which corners sit at the table, by player count: two players face each other. */
export const CORNERS_FOR: Record<number, Corner[]> = {
	2: [0, 2],
	3: [0, 1, 2],
	4: [0, 1, 2, 3],
};

export const onTrack = (p: Progress) => p >= 0 && p <= LAST_TRACK;
export const inHomeLane = (p: Progress) => p > LAST_TRACK && p < HOME;

/** The shared-track square (0–51) a kitten stands on, or null off the track. */
export function trackSquare(corner: Corner, p: Progress): number | null {
	return onTrack(p) ? (corner * CORNER_SPAN + p) % TRACK : null;
}

/** Cushions: nobody can be booped while sitting on one. */
export function isSafe(square: number) {
	return SAFE_OFFSETS.includes(square % CORNER_SPAN);
}

/** Where a kitten would end up on `roll`, or null if it can't take it. */
export function advance(p: Progress, roll: number): Progress | null {
	if (p === BASKET) return roll === LEAVE_ROLL ? 0 : null;
	if (p === HOME) return null;
	const to = p + roll;
	return to <= HOME ? to : null;
}
