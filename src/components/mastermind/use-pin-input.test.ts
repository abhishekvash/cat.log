import { describe, expect, it } from "vitest";
import { CODE_COLORS, KEY_COLORS } from "#/lib/mastermind";
import type { DragData, DropData } from "./pins";
import { dropAction } from "./use-pin-input";

const cat = CODE_COLORS[0];
const paw = KEY_COLORS[0];
const hole = (kind: DropData["kind"], index: number, enabled = true) => ({
	kind,
	index,
	enabled,
});
const code = (from?: number): DragData => ({ kind: "code", color: cat, from });
const key = (from?: number): DragData => ({ kind: "key", color: paw, from });

describe("dropAction", () => {
	it("places a tray pin in a hole", () => {
		expect(dropAction(code(), hole("code", 2), "guess")).toEqual({
			type: "placeCode",
			target: "guess",
			index: 2,
			color: cat,
		});
		expect(dropAction(key(), hole("key", 1), null)).toEqual({
			type: "setKey",
			index: 1,
			color: paw,
		});
	});

	it("moves a placed pin to another hole", () => {
		expect(dropAction(code(0), hole("code", 3), "secret")).toEqual({
			type: "moveCode",
			target: "secret",
			from: 0,
			to: 3,
		});
		expect(dropAction(key(0), hole("key", 3), null)).toEqual({
			type: "moveKey",
			from: 0,
			to: 3,
		});
	});

	it("does nothing when a pin lands back where it was", () => {
		expect(dropAction(code(2), hole("code", 2), "guess")).toBeNull();
		expect(dropAction(key(2), hole("key", 2), null)).toBeNull();
	});

	it("only touches code pins while there's a code to edit", () => {
		expect(dropAction(code(), hole("code", 2), null)).toBeNull();
		expect(dropAction(code(1), undefined, null)).toBeNull();
	});

	it("takes a placed pin off the board when dropped elsewhere", () => {
		const elsewhere = [undefined, hole("code", 1, false), hole("key", 1)];
		for (const drop of elsewhere)
			expect(dropAction(code(1), drop, "guess")).toEqual({
				type: "clearCode",
				target: "guess",
				index: 1,
			});
		expect(dropAction(key(1), hole("code", 1), null)).toEqual({
			type: "setKey",
			index: 1,
			color: null,
		});
	});

	it("ignores a tray pin dropped off the board", () => {
		expect(dropAction(code(), undefined, "guess")).toBeNull();
		expect(dropAction(key(), hole("code", 0), null)).toBeNull();
	});
});
