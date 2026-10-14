import { describe, expect, it } from "vitest";
import {
	act,
	type Intent,
	join,
	newRoom,
	nextWake,
	type Room,
	refresh,
	wake,
} from "#/lib/multiplayer/room";
import { seededRng } from "#/lib/rng";
import { meownopoly } from "./definition";
import { inDebt } from "./test-fixtures";
import type { GameState, HouseRules, Move } from "./types";

// Meownopoly played through the shared room, end to end.

type MonoRoom = Room<GameState, HouseRules>;
const ctx = (now: number) => ({ rng: seededRng(3), now });

function run(
	room: MonoRoom,
	actor: number,
	intent: Intent<Move, HouseRules>,
	now = 0,
) {
	const r = act(meownopoly, room, actor, intent, ctx(now));
	if (!r.ok) throw new Error(r.error);
	return r.room;
}

function started() {
	let room = newRoom(meownopoly, 0);
	for (const name of ["Mochi", "Tux"]) {
		const r = join(meownopoly, room, name, 0);
		if (!r.ok) throw new Error(r.error);
		room = r.room;
	}
	room = run(room, 1, {
		type: "setRules",
		rules: { napSpotJackpot: true, doubleFoodBowl: "yes" } as never,
	});
	room = run(room, 1, { type: "start" });
	return refresh(meownopoly, room, new Set([1, 2]), 0);
}

const current = (room: MonoRoom) => room.state.game?.turn?.playerId as number;

describe("meownopoly in a room", () => {
	it("starts with the host's cleaned-up house rules", () => {
		const room = started();
		expect(room.state.phase).toBe("playing");
		expect(room.state.game?.rules).toEqual({
			napSpotJackpot: true,
			doubleFoodBowl: true,
			noRentAtVet: false,
			auctions: false,
		});
		expect(room.state.game?.players.map((p) => p.name).sort()).toEqual([
			"Mochi",
			"Tux",
		]);
	});

	it("plays moves and finishes the room when a cat goes bankrupt", () => {
		let room = started();
		const first = current(room);
		room = run(room, first, { type: "move", move: { type: "roll" } });
		expect(room.state.game?.rolls).toBe(1);
		// Only a cat in debt can go bankrupt.
		inDebt(room.state.game as GameState, first, 10);
		room = run(room, first, {
			type: "move",
			move: { type: "declareBankruptcy" },
		});
		expect(room.state.phase).toBe("finished");
		expect(room.state.game?.winnerId).toBe(first === 1 ? 2 : 1);
		// The host went bankrupt, so hosting passes to the winner.
		if (first === 1) expect(room.state.hostId).toBe(2);
	});

	it("closes an auction when its clock runs out", () => {
		let room = started();
		const bidder = current(room);
		const game = room.state.game as GameState;
		room.state.game = {
			...game,
			turn: {
				...(game.turn as NonNullable<GameState["turn"]>),
				phase: "auction",
			},
			auction: {
				space: 1,
				bids: { [bidder as number]: 30 },
				endsAt: 5000,
				clock: 6000,
				resume: "postRoll",
			},
		};
		expect(nextWake(meownopoly, room)).toBe(5000);
		room = wake(meownopoly, room, ctx(5000));
		expect(room.state.game?.auction).toBeNull();
		expect(room.state.game?.holdings[1]?.owner).toBe(bidder);
	});

	it("lets the host remove a cat who wandered off, returning their streets", () => {
		let room = started();
		const host = room.state.hostId as number;
		const away = host === 1 ? 2 : 1;
		room = refresh(meownopoly, room, new Set([host]), 0);
		room = refresh(meownopoly, room, new Set([host]), 3 * 60_000);
		room = run(room, host, { type: "hostRemove", seat: away }, 3 * 60_000);
		expect(room.state.phase).toBe("finished");
		expect(room.state.game?.winnerId).toBe(host);
	});
});
