import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our own @theme tokens (styles.css), so class merging knows `text-row` is a
// size (not a colour) and `max-w-measure` a width. Add new tokens here too.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["tile", "row"],
			container: ["measure", "measure-narrow"],
			radius: ["board-inner"],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
