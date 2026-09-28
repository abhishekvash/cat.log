import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STICKER } from "./palette";

// SVG art takes its colours from palette.ts, class names from styles.css
// tokens. The colour they share must not drift apart.
describe("palette", () => {
	const css = readFileSync(
		new URL("../../styles.css", import.meta.url),
		"utf8",
	);

	it("matches --color-sticker in styles.css", () => {
		expect(css).toContain(`--color-sticker: ${STICKER};`);
	});
});
