import { describe, expect, it } from "vitest";
import { BOARD, groupSpaces } from "./board";
import { reduce } from "./engine";
import {
	buildBlocker,
	mortgageBlocker,
	sellBlocker,
	unmortgageBlocker,
} from "./rules";
import { holdingsOf, lastRollId } from "./selectors";
import { ctx, dice, game, own, p, run, turn } from "./test-fixtures";
import type { GameState } from "./types";

const BLOCKERS = {
	build: buildBlocker,
	sell: sellBlocker,
	mortgage: mortgageBlocker,
	unmortgage: unmortgageBlocker,
} as const;

/** A messy mid-game board: sets, partial sets, buildings and mortgages. */
function messy(): GameState {
	const s = game(3);
	own(s, 1, ...groupSpaces(1), ...groupSpaces(2), 5, 12);
	own(s, 2, ...groupSpaces(3).slice(0, 2), 15);
	s.holdings[groupSpaces(1)[0]].buildings = 2;
	s.holdings[groupSpaces(1)[1]].buildings = 1;
	s.holdings[groupSpaces(2)[0]].mortgaged = true;
	s.holdings[12].mortgaged = true;
	p(s, 1).fish = 90;
	return s;
}

describe("rules", () => {
	it("agree with the engine on every space, player and move", () => {
		const base = messy();
		const auction = { space: 39, highBid: 0, highBidder: null, endsAt: 0 };
		for (const state of [base, { ...base, auction }]) {
			for (const player of [1, 2, 3])
				for (const [type, blocker] of Object.entries(BLOCKERS))
					for (let index = 0; index < BOARD.length; index++) {
						const why = blocker(state, player, index);
						const result = reduce(
							state,
							player,
							{ type: type as keyof typeof BLOCKERS, space: index },
							ctx(),
						);
						expect(result.ok ? null : result.error).toBe(why);
					}
		}
	});

	it("name the reason a build is blocked", () => {
		const s = messy();
		const [a, b] = groupSpaces(1);
		expect(buildBlocker(s, 1, a)).toBe("Build evenly across the group.");
		expect(buildBlocker(s, 1, b)).toBeNull();
		expect(buildBlocker(s, 2, groupSpaces(3)[0])).toBe(
			"Own all 3 in this group to build.",
		);
		expect(buildBlocker(s, 1, groupSpaces(2)[1])).toBe(
			"Lift the mortgages on this group first.",
		);
		p(s, 1).fish = 0;
		expect(buildBlocker(s, 1, b)).toBe("Not enough fish 🐟");
	});

	it("block mortgaging a street whose group has buildings", () => {
		const s = messy();
		expect(mortgageBlocker(s, 1, groupSpaces(1)[0])).toBe(
			"Sell the buildings in this group first.",
		);
		expect(mortgageBlocker(s, 1, 5)).toBeNull();
		expect(unmortgageBlocker(s, 1, 12)).toBeNull();
		expect(sellBlocker(s, 1, groupSpaces(1)[1])).toBe(
			"Sell evenly across the group.",
		);
	});
});

describe("selectors", () => {
	it("lists a player's holdings in board order", () => {
		const s = game();
		own(s, 1, 39, 1, 12);
		own(s, 2, 3);
		expect(holdingsOf(s, 1).map((h) => h.index)).toEqual([1, 12, 39]);
		expect(holdingsOf(s, 3)).toEqual([]);
	});

	it("gives every roll a new id, even when the faces repeat", () => {
		let s = game();
		expect(lastRollId(s)).toBeUndefined();
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		const first = lastRollId(s);
		s.turn = { ...turn(s), playerId: 1, phase: "awaitingRoll" };
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(first).toBeDefined();
		expect(lastRollId(s)).not.toBe(first);
	});
});
