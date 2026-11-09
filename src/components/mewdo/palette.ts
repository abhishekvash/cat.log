import type { CSSProperties } from "react";
import type { Corner } from "#/lib/mewdo/types";

/**
 * Each corner's tint: its yard, start square, home lane and the ring round
 * its kittens. Soft, milky colours that sit calmly on Velvet Dusk; any cat can
 * play any corner.
 */
export const CORNER_TINTS: Record<Corner, { name: string; color: string }> = {
	0: { name: "Strawberry", color: "oklch(0.78 0.12 355)" },
	1: { name: "Honey", color: "oklch(0.84 0.11 82)" },
	2: { name: "Mint", color: "oklch(0.8 0.1 165)" },
	3: { name: "Periwinkle", color: "oklch(0.76 0.1 270)" },
};

export const cornerStyle = (corner: Corner) =>
	({ "--corner": CORNER_TINTS[corner].color }) as CSSProperties;

/** A small dot of a corner's tint, for lists and headings. */
export function tintOf(corner: Corner) {
	return CORNER_TINTS[corner].color;
}
