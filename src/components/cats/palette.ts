import type { Cat, PawColor } from "#/lib/cats";

/**
 * The sticker-art palette every drawing shares: cat faces, paws, board art,
 * dice and fur. These are artwork colours, not UI tokens; the UI's own colours
 * live in styles.css.
 */

/** Outlines. */
export const INK = "#2a1f26";
/** "Paw White": the sticker border around every drawing. */
export const STICKER = "#fff4f8";
export const PINK = "#ff7eb0";
export const CREAM = "#fde2c0";
export const INNER_EAR = "#f7a8b8";
export const BLUSH = "#ff8fb1";
export const NOSE = "#f28aa0";
/** The sleeping cat that stands in for anything hidden or on its way. */
export const SLEEPY_FUR = "#6e5a78";

export interface CoatColors {
	fur: string;
	/** Stripes, tufts or points. */
	accent: string;
	iris: string;
}

// Each cat differs in fur and eye colour (plus markings), so no two look alike
// even at a glance.
export const COATS: Record<Cat, CoatColors> = {
	grey: { fur: "#a7b0bb", accent: "#7d8793", iris: "#f2a93b" },
	white: { fur: "#fbf8f4", accent: "#e2d6cc", iris: "#f2c14e" },
	black: { fur: "#2d2a31", accent: "#5a5463", iris: "#a6e07a" },
	ginger: { fur: "#f4a259", accent: "#d9772e", iris: "#8cc751" },
	siamese: { fur: "#e9d3b1", accent: "#2f2724", iris: "#4fb3f0" },
	// White with a ginger and a black patch.
	calico: { fur: "#fbf8f4", accent: "#f4a259", iris: "#f2a93b" },
};

/** The black cats lurking in the background: "Lurking Green" and friends. */
export const LURKING_EYES = {
	light: "#e9ff8a",
	iris: "#8fdc4f",
	shade: "#3f8f2a",
	pupil: "#0d0a10",
	glint: "#f4ffe6",
};

/** [highlight, base, shade] for the glossy paw tokens. */
export const PAW_SHADES: Record<PawColor, [string, string, string]> = {
	pink: ["#ffd6e5", PINK, "#d6457f"],
	white: ["#fffafc", STICKER, "#d9c3cf"],
};
