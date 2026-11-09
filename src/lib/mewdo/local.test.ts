import { describe, expect, it } from "vitest";
import { seededRng } from "#/lib/rng";
import { start } from "./engine";
import { isLocalGame, type LocalPlayer, localSeats } from "./local";

const players: LocalPlayer[] = [
	{ name: "Mochi", cat: "grey" },
	{ name: "Tux", cat: "black" },
];
const fresh = () => ({
	players,
	state: start(localSeats(players), { rng: seededRng(1), now: 0 }),
	round: 1,
});

describe("checking a saved shared-screen game", () => {
	it("trusts a game this version made", () => {
		expect(isLocalGame(fresh())).toBe(true);
		expect(isLocalGame({ players: [], state: null, round: 0 })).toBe(true);
	});

	it("turns away anything that would crash the board", () => {
		const broken = [
			{ players: [], state: {}, round: 0 },
			{ players, state: null },
			{ players: [{ name: "Mochi", cat: "tiger" }], state: null, round: 0 },
			{ players: [...players, ...players], state: null, round: 0 },
			{ ...fresh(), state: { ...fresh().state, players: [] } },
			{ ...fresh(), state: { ...fresh().state, turn: null } },
			{ ...fresh(), state: { ...fresh().state, log: [null] } },
			{ ...fresh(), state: { ...fresh().state, lastRoll: { id: 1 } } },
			{
				...fresh(),
				state: {
					...fresh().state,
					lastMove: {
						id: 1,
						playerId: 1,
						kitten: 0,
						from: 0,
						to: 3,
						booped: [null],
					},
				},
			},
			{
				...fresh(),
				state: {
					...fresh().state,
					players: fresh().state.players.map((p) => ({
						...p,
						kittens: [0, 0],
					})),
				},
			},
		];
		for (const save of broken) expect(isLocalGame(save)).toBe(false);
	});
});
