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
import { monopawly } from "./definition";
import type { GameState, HouseRules, Move } from "./types";

// Monopawly played through the shared room, end to end.

type MonoRoom = Room<GameState, HouseRules>;
const ctx = (now: number) => ({ rng: seededRng(3), now });

function run(
	room: MonoRoom,
	actor: number,
	intent: Intent<Move, HouseRules>,
	now = 0,
) {
	const r = act(monopawly, room, actor, intent, ctx(now));
	if (!r.ok) throw new Error(r.error);
	return r.room;
}

function started() {
	let room = newRoom(monopawly, 0);
	for (const name of ["Mochi", "Tux"]) {
		const r = join(monopawly, room, name, 0);
		if (!r.ok) throw new Error(r.error);
		room = r.room;
	}
	room = run(room, 1, {
		type: "setRules",
		rules: { napSpotJackpot: true, doubleFoodBowl: "yes" } as never,
	});
	room = run(room, 1, { type: "start" });
	return refresh(monopawly, room, new Set([1, 2]), 0);
}

const current = (room: MonoRoom) => room.state.game?.turn?.playerId as number;

describe("monopawly in a room", () => {
	it("starts with the host's cleaned-up house rules", () => {
		const room = started();
		expect(room.state.phase).toBe("playing");
		expect(room.state.game?.rules).toEqual({
			napSpotJackpot: true,
			doubleFoodBowl: true,
			noRentAtVet: false,
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
			auction: { space: 1, highBid: 30, highBidder: bidder, endsAt: 5000 },
		};
		expect(nextWake(monopawly, room)).toBe(5000);
		room = wake(monopawly, room, ctx(5000));
		expect(room.state.game?.auction).toBeNull();
		expect(room.state.game?.holdings[1]?.owner).toBe(bidder);
	});

	it("lets the host remove a cat who wandered off, returning their streets", () => {
		let room = started();
		const host = room.state.hostId as number;
		const away = host === 1 ? 2 : 1;
		room = refresh(monopawly, room, new Set([host]), 0);
		room = refresh(monopawly, room, new Set([host]), 3 * 60_000);
		room = run(room, host, { type: "hostRemove", seat: away }, 3 * 60_000);
		expect(room.state.phase).toBe("finished");
		expect(room.state.game?.winnerId).toBe(host);
	});
});
