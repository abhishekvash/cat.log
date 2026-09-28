import { attempt, type GameDefinition, reject, type SeatId } from "./types";

/**
 * A tiny game for testing the room machinery without any real rules: players
 * take turns counting up, and the first to reach `target` wins. "stall" starts
 * a clock the room must close on its own.
 */

export interface CountState {
	order: SeatId[];
	turn: number;
	count: number;
	target: number;
	out: SeatId[];
	winner: SeatId | null;
	clock: number | null;
}

export type CountMove = { type: "count" } | { type: "stall"; until: number };

export interface CountRules {
	target: number;
}

const current = (s: CountState) => s.order[s.turn % s.order.length];

function nextTurn(s: CountState) {
	do s.turn++;
	while (s.out.includes(current(s)));
}

export const countingGame: GameDefinition<CountState, CountMove, CountRules> = {
	id: "counting",
	name: "Counting",
	version: 1,
	minPlayers: 2,
	maxPlayers: 4,
	defaultRules: { target: 5 },
	sanitizeRules: (raw) => {
		const target = Number((raw as CountRules | null)?.target);
		return { target: Number.isInteger(target) && target > 0 ? target : 5 };
	},
	start: (seats, rules) => ({
		order: seats.map((s) => s.id),
		turn: 0,
		count: 0,
		target: rules.target,
		out: [],
		winner: null,
		clock: null,
	}),
	reduce: (state, seat, move) =>
		attempt(state, (s) => {
			if (s.winner !== null) reject("It's over.");
			if (current(s) !== seat) reject("It's not your turn.");
			if (move.type === "stall") {
				s.clock = move.until;
				return;
			}
			s.count++;
			if (s.count >= s.target) s.winner = seat;
			else nextTurn(s);
		}),
	currentPlayer: (s) => (s.winner === null ? current(s) : null),
	isOut: (s, seat) => s.out.includes(seat),
	isOver: (s) => s.winner !== null,
	skipTurn: (state) => attempt(state, nextTurn),
	removeSeat: (state, seat) =>
		attempt(state, (s) => {
			s.out.push(seat);
			const left = s.order.filter((id) => !s.out.includes(id));
			if (left.length === 1) s.winner = left[0];
			else if (current(s) === seat) nextTurn(s);
		}),
	nextTimer: (s) => s.clock,
	tick: (state, ctx) =>
		attempt(state, (s) => {
			if (s.clock === null || ctx.now < s.clock) reject("Not yet.");
			s.clock = null;
			nextTurn(s);
		}),
};
