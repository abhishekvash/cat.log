import { CATS } from "#/lib/cats";
import type { Context, Seat } from "#/lib/multiplayer/types";
import { type Rng, seededRng } from "#/lib/rng";
import { reduce, start } from "./engine";
import { DEFAULT_HOUSE_RULES, type GameState, type Move } from "./types";

/** Shared fixtures for the Monopawly engine tests. */

/** Dice come out in the order given; anything else falls back to a seed. */
export function dice(...rolls: number[]): Rng {
	const fallback = seededRng(1);
	const queue = [...rolls];
	return {
		int(max) {
			if (max === 6 && queue.length) return (queue.shift() as number) - 1;
			return fallback.int(max);
		},
	};
}

export const ctx = (rng: Rng = seededRng(7), now = 1000): Context => ({
	rng,
	now,
});

export const seats = (n: number): Seat[] =>
	Array.from({ length: n }, (_, i) => ({
		id: i + 1,
		name: ["Mochi", "Tux", "Biscuit", "Luna", "Pip", "Miso"][i],
		cat: CATS[i],
		connected: true,
		away: false,
	}));

/** A started game with players 1..n in seat order, everyone on the Food Bowl. */
export function game(n = 2): GameState {
	const s = start(seats(n), DEFAULT_HOUSE_RULES, ctx());
	// Undo the shuffle so tests read naturally: player 1 goes first.
	s.players.sort((a, b) => a.id - b.id);
	s.turn = {
		playerId: 1,
		phase: "awaitingRoll",
		doubles: 0,
		dice: null,
		rollAgain: false,
	};
	return s;
}

export function must(result: ReturnType<typeof reduce>) {
	if (!result.ok) throw new Error(result.error);
	return result.state;
}

export function run(s: GameState, actor: number, move: Move, c = ctx()) {
	return must(reduce(s, actor, move, c));
}

export const p = (s: GameState, id: number) => {
	const found = s.players.find((x) => x.id === id);
	if (!found) throw new Error(`no player ${id}`);
	return found;
};
export const turn = (s: GameState) => {
	if (!s.turn) throw new Error("no turn");
	return s.turn;
};
export const own = (s: GameState, owner: number, ...spaces: number[]) => {
	for (const i of spaces)
		s.holdings[i] = { owner, buildings: 0, mortgaged: false };
};
