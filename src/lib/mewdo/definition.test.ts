import { describe, expect, it } from "vitest";
import {
	act,
	type Intent,
	join,
	newRoom,
	type Room,
	refresh,
} from "#/lib/multiplayer/room";
import { seededRng } from "#/lib/rng";
import { mewdo } from "./definition";
import type { GameState, HouseRules, Move } from "./types";

// Mewdo played through the shared room, end to end.

type MewdoRoom = Room<GameState, HouseRules>;
const ctx = (now: number) => ({ rng: seededRng(3), now });

function run(
	room: MewdoRoom,
	actor: number,
	intent: Intent<Move, HouseRules>,
	now = 0,
) {
	const r = act(mewdo, room, actor, intent, ctx(now));
	if (!r.ok) throw new Error(r.error);
	return r.room;
}

function started(names = ["Mochi", "Tux"]) {
	let room = newRoom(mewdo, 0);
	for (const name of names) {
		const r = join(mewdo, room, name, 0);
		if (!r.ok) throw new Error(r.error);
		room = r.room;
	}
	room = run(room, 1, { type: "start" });
	return refresh(mewdo, room, new Set(names.map((_, i) => i + 1)), 0);
}

const current = (room: MewdoRoom) => room.state.game?.turn?.playerId as number;

describe("mewdo in a room", () => {
	it("starts with every seated cat in a corner", () => {
		const room = started(["Mochi", "Tux", "Biscuit"]);
		expect(room.state.phase).toBe("playing");
		expect(room.state.game?.players.map((p) => p.corner).sort()).toEqual([
			0, 1, 2,
		]);
	});

	it("plays a roll", () => {
		let room = started();
		const first = current(room);
		room = run(room, first, { type: "move", move: { type: "roll" } });
		expect(room.state.game?.lastRoll?.playerId).toBe(first);
	});

	it("finishes the room when one of two cats leaves", () => {
		let room = started();
		room = run(room, 2, { type: "resign" });
		expect(room.state.phase).toBe("finished");
		expect(room.state.game?.players.find((p) => p.id === 1)?.place).toBe(1);
	});
});

describe("hosting after a mewdo game", () => {
	it("passes to a cat still here when the host wanders off, though everyone's placed", () => {
		let room = started();
		room = run(room, 2, { type: "resign" });
		expect(room.state.phase).toBe("finished");
		// Everyone is "out" now: one placed, one gone.
		const host = room.state.hostId as number;
		const other = host === 1 ? 2 : 1;
		room = refresh(mewdo, room, new Set([other]), 0);
		room = refresh(mewdo, room, new Set([other]), 3 * 60_000);
		expect(room.state.hostId).toBe(other);
	});
});
