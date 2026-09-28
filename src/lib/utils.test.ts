import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("keeps our text sizes beside a text colour", () => {
		expect(cn("text-row", "text-muted-foreground")).toBe(
			"text-row text-muted-foreground",
		);
		expect(cn("text-sm", "text-tile")).toBe("text-tile");
	});

	it("still lets a later width or radius win", () => {
		expect(cn("max-w-measure", "max-w-sm")).toBe("max-w-sm");
		expect(cn("rounded-md", "rounded-board-inner")).toBe("rounded-board-inner");
	});
});
