import {
	BASKET,
	CORNER_SPAN,
	HOME,
	HOME_LANE,
	LAST_TRACK,
	TRACK,
} from "#/lib/mewdo/board";
import type { Corner, Progress } from "#/lib/mewdo/types";

/**
 * Where things sit on the drawn board: a 15×15 grid, in grid units, measured
 * to the centre of a cell. Everything is laid out for a corner in the top left
 * and turned a quarter at a time for the others, then turned again so the
 * viewer's own corner sits at the bottom left.
 */

export const GRID = 15;
const MID = GRID / 2;

export interface Point {
	x: number;
	y: number;
}

/** A quarter turn clockwise about the middle of the board. */
const turn = ({ x, y }: Point): Point => ({ x: GRID - y, y: x });

function turned(p: Point, quarters: number): Point {
	let out = p;
	for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) out = turn(out);
	return out;
}

const cell = (col: number, row: number): Point => ({
	x: col + 0.5,
	y: row + 0.5,
});

/**
 * One corner's thirteen squares of the loop, for the corner in the top left:
 * out along its start row, up the arm, and across the top of it.
 */
const QUARTER: Point[] = [
	...[1, 2, 3, 4, 5].map((col) => cell(col, 6)),
	...[5, 4, 3, 2, 1, 0].map((row) => cell(6, row)),
	cell(7, 0),
	cell(8, 0),
];

/** The whole loop, square 0 being the top-left corner's start. */
const LOOP: Point[] = [0, 1, 2, 3].flatMap((q) =>
	QUARTER.map((p) => turned(p, q)),
);
if (LOOP.length !== TRACK) throw new Error("The Mewdo loop is the wrong size.");

const LANE: Point[] = Array.from({ length: HOME_LANE }, (_, i) =>
	cell(1 + i, 7),
);

/** Basket spots in the top-left yard, and food-bowl spots in its triangle. */
const BASKET_SPOTS: Point[] = [
	{ x: 2, y: 2 },
	{ x: 4, y: 2 },
	{ x: 2, y: 4 },
	{ x: 4, y: 4 },
];
const BOWL_SPOTS: Point[] = [
	{ x: 6.35, y: 6.85 },
	{ x: 6.35, y: 8.15 },
	{ x: 6.35, y: 7.5 },
	{ x: 6.9, y: 7.5 },
];

/** How far the viewer's board is turned so `bottom` sits at the bottom left. */
export const viewTurns = (bottom: Corner) => (3 - bottom + 4) % 4;

/** The loop square at an index (0–51), on a board turned by `view`. */
export const loopPoint = (square: number, view: number) =>
	turned(LOOP[square], view);

/** A kitten's spot. `kitten` picks its place in the basket or the food bowl. */
export function kittenPoint(
	corner: Corner,
	progress: Progress,
	kitten: number,
	view: number,
): Point {
	const q = corner + view;
	if (progress === BASKET) return turned(BASKET_SPOTS[kitten], q);
	if (progress === HOME) return turned(BOWL_SPOTS[kitten], q);
	if (progress > LAST_TRACK) return turned(LANE[progress - LAST_TRACK - 1], q);
	return loopPoint((corner * CORNER_SPAN + progress) % TRACK, view);
}

/** Every spot a kitten passes through moving `from` → `to`, `to` included. */
export function hopPath(
	corner: Corner,
	from: Progress,
	to: Progress,
	kitten: number,
	view: number,
): Point[] {
	if (from === BASKET) return [kittenPoint(corner, to, kitten, view)];
	const out: Point[] = [];
	for (let p = from + 1; p <= to; p++)
		out.push(kittenPoint(corner, p, kitten, view));
	return out;
}

/** The board parts for one corner, already turned for the viewer. */
export function cornerParts(corner: Corner, view: number) {
	const q = corner + view;
	const r = (p: Point) => turned(p, q);
	return {
		/** The yard's top-left and bottom-right, in grid units. */
		yard: [r({ x: 0, y: 0 }), r({ x: 6, y: 6 })] as const,
		basketSpots: BASKET_SPOTS.map(r),
		lane: LANE.map(r),
		/** The food-bowl triangle this corner's lane runs into. */
		bowl: [
			r({ x: 6, y: 6 }),
			r({ x: MID, y: MID }),
			r({ x: 6, y: 9 }),
		] as const,
	};
}
