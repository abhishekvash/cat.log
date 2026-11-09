import { describe, expect, it } from "vitest";
import { CATS } from "#/lib/cats";
import type { Context, Seat } from "#/lib/multiplayer/types";
import { type Rng, seededRng } from "#/lib/rng";
import {
	advance,
	BASKET,
	HOME,
	isSafe,
	LAST_TRACK,
	trackSquare,
} from "./board";
import {
	movableKittens,
	reduce,
	removePlayer,
	skipTurn,
	start,
} from "./engine";
import type { GameState, Move } from "./types";

/** The die comes up in the order given; anything else falls back to a seed. */
function dice(...rolls: number[]): Rng {
	const fallback = seededRng(1);
	const queue = [...rolls];
	return {
		int(max) {
			if (max === 6 && queue.length) return (queue.shift() as number) - 1;
			return fallback.int(max);
		},
	};
}

const ctx = (rng: Rng = seededRng(7)): Context => ({ rng, now: 1000 });

const seats = (n: number): Seat[] =>
	Array.from({ length: n }, (_, i) => ({
		id: i + 1,
		name: ["Mochi", "Tux", "Biscuit", "Luna"][i],
		cat: CATS[i],
		connected: true,
		away: false,
	}));

/** A started game with players 1..n in seat order, corners in that order too. */
function game(n = 2): GameState {
	const s = start(seats(n), ctx());
	s.players.sort((a, b) => a.corner - b.corner);
	s.players.forEach((p, i) => {
		p.id = i + 1;
		p.name = seats(n)[i].name;
	});
	s.turn = { playerId: 1, phase: "roll", roll: null, sixes: 0, movable: [] };
	return s;
}

function run(s: GameState, actor: number, move: Move, ...rolls: number[]) {
	const r = reduce(s, actor, move, ctx(dice(...rolls)));
	if (!r.ok) throw new Error(r.error);
	return r.state;
}

const roll = (s: GameState, actor: number, value: number) =>
	run(s, actor, { type: "roll" }, value);

const p = (s: GameState, id: number) => {
	const found = s.players.find((x) => x.id === id);
	if (!found) throw new Error(`no player ${id}`);
	return found;
};

describe("the board", () => {
	it("starts each corner thirteen squares on from the last", () => {
		expect(trackSquare(0, 0)).toBe(0);
		expect(trackSquare(1, 0)).toBe(13);
		expect(trackSquare(3, 50)).toBe(37);
		expect(trackSquare(2, BASKET)).toBeNull();
		expect(trackSquare(2, LAST_TRACK + 1)).toBeNull();
	});

	it("keeps start squares and the cushions after them safe", () => {
		expect([0, 8, 13, 21, 26, 34, 39, 47].every(isSafe)).toBe(true);
		expect(isSafe(1)).toBe(false);
		expect(isSafe(12)).toBe(false);
	});

	it("needs a 6 to leave the basket and an exact roll to get home", () => {
		expect(advance(BASKET, 5)).toBeNull();
		expect(advance(BASKET, 6)).toBe(0);
		expect(advance(HOME - 3, 3)).toBe(HOME);
		expect(advance(HOME - 3, 4)).toBeNull();
		expect(advance(HOME, 1)).toBeNull();
	});
});

describe("starting", () => {
	it("seats two players in opposite corners, every kitten in its basket", () => {
		const s = start(seats(2), ctx());
		expect(s.players.map((x) => x.corner)).toEqual([0, 2]);
		expect(s.players.flatMap((x) => x.kittens)).toEqual(Array(8).fill(BASKET));
		expect(s.turn?.playerId).toBe(s.players[0].id);
	});

	it("refuses too few or too many players", () => {
		expect(() => start(seats(1), ctx())).toThrow();
		expect(() => start([...seats(4), ...seats(1)], ctx())).toThrow();
	});
});

describe("rolling", () => {
	it("passes the turn when no kitten can move", () => {
		const s = roll(game(), 1, 3);
		expect(s.turn?.playerId).toBe(2);
		expect(s.lastRoll).toMatchObject({ id: 1, playerId: 1, value: 3 });
	});

	it("lets a kitten out on a 6 and rolls again", () => {
		const s = roll(game(), 1, 6);
		// Four kittens in one basket are one choice, so it moves on its own.
		expect(p(s, 1).kittens).toEqual([0, BASKET, BASKET, BASKET]);
		expect(s.turn).toMatchObject({ playerId: 1, phase: "roll", sixes: 1 });
		expect(s.lastMove).toMatchObject({ kitten: 0, from: BASKET, to: 0 });
	});

	it("asks which kitten when there's a real choice", () => {
		const g = game();
		p(g, 1).kittens = [0, BASKET, BASKET, BASKET];
		const s = roll(g, 1, 6);
		expect(s.turn).toMatchObject({ phase: "move", roll: 6, movable: [0, 1] });
		const after = run(s, 1, { type: "move", kitten: 2 });
		// Any kitten from the basket will do.
		expect(p(after, 1).kittens).toEqual([0, BASKET, 0, BASKET]);
		expect(after.turn).toMatchObject({ playerId: 1, phase: "roll" });
	});

	it("offers kittens sharing a square once", () => {
		const g = game();
		p(g, 1).kittens = [4, 4, 9, BASKET];
		expect(movableKittens(p(g, 1), 2)).toEqual([0, 2]);
	});

	it("ends the turn on three 6s in a row, without moving", () => {
		const g = game();
		p(g, 1).kittens = [10, BASKET, BASKET, HOME];
		let s = roll(g, 1, 6);
		s = run(s, 1, { type: "move", kitten: 0 });
		s = roll(s, 1, 6);
		s = run(s, 1, { type: "move", kitten: 0 });
		expect(p(s, 1).kittens[0]).toBe(22);
		s = roll(s, 1, 6);
		expect(p(s, 1).kittens[0]).toBe(22);
		expect(s.turn?.playerId).toBe(2);
	});

	it("rolls again after a 6 even when nothing can move", () => {
		const g = game();
		p(g, 1).kittens = [HOME - 2, HOME, HOME, HOME];
		const s = roll(g, 1, 6);
		expect(s.turn).toMatchObject({ playerId: 1, phase: "roll" });
	});

	it("rejects a kitten that isn't one of theirs", () => {
		const g = game();
		p(g, 1).kittens = [4, 0, BASKET, BASKET];
		const s = roll(g, 1, 2);
		expect(s.turn?.phase).toBe("move");
		for (const kitten of ["length", -1, 4, 1.5, null] as unknown as number[])
			expect(reduce(s, 1, { type: "move", kitten }, ctx()).ok).toBe(false);
		expect(p(s, 1).kittens).toEqual([4, 0, BASKET, BASKET]);
	});

	it("rejects moves out of turn or out of order", () => {
		const g = game();
		expect(reduce(g, 2, { type: "roll" }, ctx()).ok).toBe(false);
		expect(reduce(g, 1, { type: "move", kitten: 0 }, ctx()).ok).toBe(false);
		p(g, 1).kittens = [0, 30, BASKET, BASKET];
		const s = roll(g, 1, 2);
		expect(reduce(s, 1, { type: "roll" }, ctx()).ok).toBe(false);
		expect(reduce(s, 1, { type: "move", kitten: 2 }, ctx()).ok).toBe(false);
	});
});

describe("booping", () => {
	it("sends a kitten back to its basket and earns another roll", () => {
		const g = game();
		// Player 2 starts on square 26; 24 steps on puts it on square 50.
		p(g, 1).kittens = [47, BASKET, BASKET, BASKET];
		p(g, 2).kittens = [24, BASKET, BASKET, BASKET];
		expect(trackSquare(0, 50)).toBe(trackSquare(2, 24));
		const s = roll(g, 1, 3);
		expect(p(s, 2).kittens[0]).toBe(BASKET);
		expect(s.lastMove?.booped).toEqual([{ playerId: 2, kitten: 0, from: 24 }]);
		expect(s.turn).toMatchObject({ playerId: 1, phase: "roll", sixes: 0 });
	});

	it("boops every kitten on the square", () => {
		const g = game();
		p(g, 1).kittens = [1, BASKET, BASKET, BASKET];
		p(g, 2).kittens = [31, 31, BASKET, BASKET];
		const s = roll(g, 1, 4);
		expect(p(s, 2).kittens).toEqual(Array(4).fill(BASKET));
	});

	it("never boops on a cushion", () => {
		const g = game();
		p(g, 1).kittens = [5, BASKET, BASKET, BASKET];
		// Square 8 is player 1's cushion; player 2 reaches it 34 steps in.
		p(g, 2).kittens = [34, BASKET, BASKET, BASKET];
		const s = roll(g, 1, 3);
		expect(p(s, 2).kittens[0]).toBe(34);
		expect(s.turn?.playerId).toBe(2);
	});

	it("leaves your own kittens alone", () => {
		const g = game();
		p(g, 1).kittens = [3, 5, BASKET, BASKET];
		const s = run(roll(g, 1, 2), 1, { type: "move", kitten: 0 });
		expect(p(s, 1).kittens).toEqual([5, 5, BASKET, BASKET]);
	});
});

describe("finishing", () => {
	it("places cats as they get home and decides every place", () => {
		const g = game(3);
		p(g, 1).kittens = [HOME - 2, HOME, HOME, HOME];
		p(g, 2).kittens = [HOME - 1, HOME, HOME, HOME];
		let s = roll(g, 1, 2);
		expect(p(s, 1).place).toBe(1);
		// Home with every kitten: no bonus roll, just watching.
		expect(s.turn?.playerId).toBe(2);
		s = roll(s, 2, 1);
		expect(p(s, 2).place).toBe(2);
		expect(p(s, 3).place).toBe(3);
		expect(s.phase).toBe("finished");
		expect(s.turn).toBeNull();
	});

	it("skips cats already home", () => {
		const g = game(3);
		p(g, 2).place = 1;
		p(g, 2).kittens.fill(HOME);
		const s = roll(g, 1, 3);
		expect(s.turn?.playerId).toBe(3);
	});
});

describe("the host and leaving", () => {
	it("skips a turn", () => {
		const r = skipTurn(game());
		expect(r.ok && r.state.turn?.playerId).toBe(2);
	});

	it("takes a leaver's kittens off and moves the turn on", () => {
		const g = game(3);
		p(g, 1).kittens = [5, 6, BASKET, BASKET];
		const r = removePlayer(g, 1, ctx(), "left");
		if (!r.ok) throw new Error(r.error);
		expect(p(r.state, 1)).toMatchObject({ gone: true, place: null });
		expect(p(r.state, 1).kittens).toEqual(Array(4).fill(BASKET));
		expect(r.state.turn?.playerId).toBe(2);
		expect(r.state.phase).toBe("playing");
	});

	it("ends a two-cat game when one leaves", () => {
		const r = removePlayer(game(), 2, ctx());
		if (!r.ok) throw new Error(r.error);
		expect(r.state.phase).toBe("finished");
		expect(p(r.state, 1).place).toBe(1);
		expect(p(r.state, 2).place).toBeNull();
	});

	it("won't remove a cat who's already home", () => {
		const g = game(3);
		p(g, 2).place = 1;
		expect(removePlayer(g, 2, ctx()).ok).toBe(false);
	});
});

describe("a whole game", () => {
	it("always ends with every place decided", () => {
		for (const seed of [1, 2, 3, 4, 5]) {
			const rng = seededRng(seed);
			let s = start(seats(4), ctx(rng));
			for (let i = 0; i < 20_000 && s.phase === "playing"; i++) {
				const turn = s.turn;
				if (!turn) break;
				const move: Move =
					turn.phase === "roll"
						? { type: "roll" }
						: {
								type: "move",
								kitten: turn.movable[rng.int(turn.movable.length)],
							};
				const r = reduce(s, turn.playerId, move, ctx(rng));
				if (!r.ok) throw new Error(r.error);
				s = r.state;
			}
			expect(s.phase).toBe("finished");
			expect(s.players.map((x) => x.place).sort()).toEqual([1, 2, 3, 4]);
		}
	});
});
