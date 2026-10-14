import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tick } from "#/lib/meownopoly/engine";
import {
	ctx,
	dice,
	game,
	must,
	own,
	p,
	run,
} from "#/lib/meownopoly/test-fixtures";
import type { GameState } from "#/lib/meownopoly/types";
import { createPresentation, initialPresentation } from "./presentation-state";

const controllers: ReturnType<typeof createPresentation>[] = [];

function present(initial: GameState, reducedMotion = false) {
	let shown = initialPresentation(initial);
	const publish = vi.fn((next: typeof shown) => {
		shown = next;
	});
	const controller = createPresentation(initial, {
		publish,
		rollAge: (roll) => (roll === initial.rolls ? Infinity : 0),
		reducedMotion: () => reducedMotion,
	});
	controllers.push(controller);
	return {
		...controller,
		publish,
		get shown() {
			return shown;
		},
	};
}

/** The long card move from the review: 24 to Zoomies at 36, then Yarn Market. */
function cardMove() {
	const before = game(3);
	before.rules.auctions = true;
	p(before, 1).position = 24;
	before.decks.zoomies = [3, ...before.decks.zoomies.filter((i) => i !== 3)];
	const rolled = run(before, 1, { type: "roll" }, ctx(dice(6, 6)));
	return { before, rolled };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	for (const controller of controllers.splice(0)) controller.dispose();
	vi.useRealTimers();
});

describe("presentation playback", () => {
	it.each([
		["dice", 100],
		["walking", 900],
		["card", 3100],
		["between legs", 5400],
		["final landing", 7300],
	])("interrupts %s for an auction without letting stale work overwrite it", async (_, at) => {
		const { before, rolled } = cardMove();
		const view = present(before);
		view.update(rolled);
		await vi.advanceTimersByTimeAsync(at);
		expect(view.shown.animating).toBe(true);
		if (at === 3100)
			expect(view.shown.card).toEqual({ deck: "zoomies", index: 3 });
		const stale = structuredClone(rolled);
		view.update(stale);
		const auction = run(rolled, 1, { type: "decline" }, ctx(undefined, at));
		view.update(auction);
		expect(view.shown.state).toBe(auction);
		expect(view.shown.animating).toBe(false);
		expect(view.shown.card).toBeNull();
		expect(view.shown.positions[1]).toBe(11);

		const bid = run(
			auction,
			2,
			{ type: "bid", amount: 10 },
			ctx(undefined, at + 1),
		);
		view.update(bid);
		expect(view.shown.state).toBe(bid);
		const closed = must(tick(bid, ctx(undefined, at + 6001)));
		view.update(closed);
		await vi.advanceTimersByTimeAsync(20_000);
		expect(view.shown.state).toBe(closed);
		expect(
			view.publish.mock.calls.some(([shown]) => shown.state === stale),
		).toBe(false);
	});

	it("does not let a cancelled runner release or overwrite a newer roll", async () => {
		const { before, rolled } = cardMove();
		const view = present(before);
		view.update(rolled);
		await vi.advanceTimersByTimeAsync(100);
		const auction = run(rolled, 1, { type: "decline" });
		view.update(auction);
		const closed = must(tick(auction, ctx(undefined, 60_000)));
		view.update(closed);
		const nextRoll = run(closed, 1, { type: "roll" }, ctx(dice(1, 2)));
		view.update(nextRoll);
		await vi.advanceTimersByTimeAsync(100);
		const bought = run(nextRoll, 1, { type: "buy" });
		view.update(bought);
		expect(view.shown.animating).toBe(true);
		expect(view.shown.state.holdings[14]).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1500);
		expect(view.shown.state).toBe(bought);
		expect(view.shown.animating).toBe(false);
	});

	it("preserves normal movement timing and queues results until landing", async () => {
		const before = game();
		const rolled = run(before, 1, { type: "roll" }, ctx(dice(1, 2)));
		const bought = run(rolled, 1, { type: "buy" });
		const view = present(before);
		view.update(rolled);
		view.update(bought);
		await vi.advanceTimersByTimeAsync(649);
		expect(view.shown.positions[1]).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(view.shown.positions[1]).toBe(1);
		await vi.advanceTimersByTimeAsync(949);
		expect(view.shown.animating).toBe(true);
		expect(view.shown.state.holdings[3]).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1);
		expect(view.shown.state).toBe(bought);
		expect(view.shown.animating).toBe(false);
	});

	it("skips movement under reduced motion and never replays the loaded roll", () => {
		const { before, rolled } = cardMove();
		const reduced = present(before, true);
		reduced.update(rolled);
		expect(reduced.shown.state).toBe(rolled);
		expect(reduced.shown.animating).toBe(false);
		const loaded = present(rolled);
		const snapshot = structuredClone(rolled);
		loaded.update(snapshot);
		expect(loaded.shown.state).toBe(snapshot);
		expect(loaded.shown.animating).toBe(false);
	});

	it.each([
		100, 3100,
	])("cancels all playback timers on disposal at %d ms", async (at) => {
		const { before, rolled } = cardMove();
		const view = present(before);
		view.update(rolled);
		await vi.advanceTimersByTimeAsync(at);
		view.dispose();
		const calls = view.publish.mock.calls.length;
		expect(vi.getTimerCount()).toBe(0);
		view.update(run(rolled, 1, { type: "decline" }));
		await vi.advanceTimersByTimeAsync(20_000);
		expect(view.publish).toHaveBeenCalledTimes(calls);
	});
});

describe("presentation feedback", () => {
	it.each([
		false,
		true,
	])("expires after unchanged snapshots (reduced motion: %s)", async (reduce) => {
		const before = game();
		const view = present(before, reduce);
		const purchase = structuredClone(before);
		own(purchase, 1, 1, 3);
		p(purchase, 1).fish -= 120;
		view.update(purchase);
		expect(view.shown.deltas[1].amount).toBe(-120);
		expect(view.shown.freshSets.size).toBe(1);
		await vi.advanceTimersByTimeAsync(1000);
		const unchanged = structuredClone(purchase);
		if (unchanged.turn) unchanged.turn.playerId = 2;
		view.update(unchanged);
		await vi.advanceTimersByTimeAsync(1599);
		expect(view.shown.deltas[1].amount).toBe(-120);
		await vi.advanceTimersByTimeAsync(1);
		expect(view.shown.deltas).toEqual({});
		expect(view.shown.freshSets.size).toBe(0);
		expect(view.shown.state).toBe(unchanged);
	});

	it("gives replacement feedback a new key and a full expiry", async () => {
		const before = game();
		const view = present(before);
		const first = structuredClone(before);
		p(first, 1).fish -= 10;
		view.update(first);
		const key = view.shown.deltas[1].key;
		await vi.advanceTimersByTimeAsync(1000);
		const second = structuredClone(first);
		p(second, 1).fish -= 20;
		view.update(second);
		expect(view.shown.deltas[1]).toEqual({ amount: -20, key: key + 1 });
		await vi.advanceTimersByTimeAsync(1600);
		expect(view.shown.deltas[1].amount).toBe(-20);
		await vi.advanceTimersByTimeAsync(1000);
		expect(view.shown.deltas).toEqual({});
	});

	it("clears feedback timers on disposal", async () => {
		const before = game();
		const view = present(before);
		const next = structuredClone(before);
		p(next, 1).fish -= 10;
		view.update(next);
		view.dispose();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(3000);
		expect(view.publish).toHaveBeenCalledTimes(1);
	});
});
