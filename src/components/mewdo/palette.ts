import type { Corner } from "#/lib/mewdo/types";

/**
 * Each corner's tint (strawberry, honey, mint, periwinkle): its yard, start
 * square, home lane and the ring round its kittens. Soft, milky colours that
 * sit calmly on Velvet Dusk; any cat can play any corner.
 */
const CORNER_TINTS: Record<Corner, string> = {
	0: "oklch(0.78 0.12 355)",
	1: "oklch(0.84 0.11 82)",
	2: "oklch(0.8 0.1 165)",
	3: "oklch(0.76 0.1 270)",
};

export const tintOf = (corner: Corner) => CORNER_TINTS[corner];
