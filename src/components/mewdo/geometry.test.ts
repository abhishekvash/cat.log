import { describe, expect, it } from "vitest";
import { BASKET, HOME, LAST_TRACK, TRACK } from "#/lib/mewdo/board";
import type { Corner } from "#/lib/mewdo/types";
import { hopPath, kittenPoint, loopPoint, viewTurns } from "./geometry";

/** Squares between two cells, diagonals counting as one (the loop cuts the inner corners). */
const steps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe("the drawn board", () => {
	it("draws the loop as 52 distinct squares, each next to the last", () => {
		const points = Array.from({ length: TRACK }, (_, i) => loopPoint(i, 0));
		expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(TRACK);
		points.forEach((p, i) => {
			expect(steps(p, points[(i + 1) % TRACK])).toBe(1);
		});
	});

	it("walks every corner's path one square at a time, into its lane", () => {
		for (const corner of [0, 1, 2, 3] as Corner[]) {
			const path = hopPath(corner, 0, HOME - 1, 0, 1);
			for (let i = 1; i < path.length; i++)
				expect(steps(path[i - 1], path[i])).toBe(1);
			// The lane leaves the loop from the last track square.
			expect(
				steps(
					kittenPoint(corner, LAST_TRACK, 0, 1),
					kittenPoint(corner, LAST_TRACK + 1, 0, 1),
				),
			).toBe(1);
		}
	});

	it("turns the board so the viewer's corner is at the bottom left", () => {
		for (const corner of [0, 1, 2, 3] as Corner[]) {
			const basket = kittenPoint(corner, BASKET, 0, viewTurns(corner));
			expect(basket.x).toBeLessThan(7.5);
			expect(basket.y).toBeGreaterThan(7.5);
		}
	});
});
