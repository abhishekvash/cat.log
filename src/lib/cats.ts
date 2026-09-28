/** The original five cats; Meowstermind's secret code is made of these. */
export const CORE_CATS = [
	"grey",
	"white",
	"black",
	"ginger",
	"siamese",
] as const;

/** Every cat in cat.log. Monopawly seats all six. */
export const CATS = [...CORE_CATS, "calico"] as const;
export type Cat = (typeof CATS)[number];

export const CAT_NAMES: Record<Cat, string> = {
	grey: "Grey tabby",
	white: "Snowy",
	black: "Void",
	ginger: "Ginger",
	siamese: "Siamese",
	calico: "Calico",
};

/** Paw prints come in two colours (Meowstermind's clues). */
export const PAW_COLORS = ["pink", "white"] as const;
export type PawColor = (typeof PAW_COLORS)[number];
