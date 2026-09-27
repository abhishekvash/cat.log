import { describe, expect, it } from "vitest";
import { seededRng } from "./rng";
import {
	AWAY_AFTER,
	act,
	FINISHED_TTL,
	issueRejoin,
	join,
	LOBBY_TTL,
	MINUTE,
	newRoom,
	nextWake,
	PLAYING_TTL,
	type Room,
	redeemRejoin,
	refresh,
	seatFor,
	shouldDelete,
	wake,
} from "./room";

const ctx = (now: number) => ({ rng: seededRng(3), now });

function lobby(names: string[], now = 0) {
	let room = newRoom(now);
	const tokens: string[] = [];
	for (const name of names) {
		const r = join(room, name, now);
		if (!r.ok) throw new Error(r.error);
		room = r.room;
		tokens.push(r.token);
	}
	return { room, tokens };
}

function started(now = 0) {
	const { room, tokens } = lobby(["Mochi", "Tux"], now);
	const r = act(room, room.game.hostId as number, { type: "start" }, ctx(now));
	if (!r.ok) throw new Error(r.error);
	return { room: r.room, tokens };
}

const online = (...ids: number[]) => new Set(ids);

describe("seats", () => {
	it("maps device tokens to seats and treats others as spectators", () => {
		const { room, tokens } = lobby(["Mochi", "Tux"]);
		expect(seatFor(room, tokens[0])).toBe(1);
		expect(seatFor(room, tokens[1])).toBe(2);
		expect(seatFor(room, "nope")).toBeNull();
		expect(seatFor(room, undefined)).toBeNull();
	});

	it("moves a seat to a new device with a single-use rejoin link", () => {
		const { room, tokens } = lobby(["Mochi", "Tux"]);
		const issued = issueRejoin(room, 2);
		const redeemed = redeemRejoin(issued.room, issued.token);
		if (!redeemed) throw new Error();
		expect(redeemed.playerId).toBe(2);
		expect(seatFor(redeemed.room, redeemed.token)).toBe(2);
		expect(seatFor(redeemed.room, tokens[1])).toBeNull();
		expect(redeemRejoin(redeemed.room, issued.token)).toBeNull();
	});

	it("forgets the token of a player who leaves the lobby", () => {
		const { room, tokens } = lobby(["Mochi", "Tux"]);
		const r = act(room, 2, { type: "leave" }, ctx(0));
		if (!r.ok) throw new Error();
		expect(seatFor(r.room, tokens[1])).toBeNull();
	});
});

describe("presence", () => {
	it("marks a disconnected player away after two minutes", () => {
		let { room } = started();
		room = refresh(room, online(1), 0);
		expect(room.game.players.find((p) => p.id === 2)?.connected).toBe(false);
		expect(room.game.players.find((p) => p.id === 2)?.away).toBe(false);
		expect(nextWake(room)).toBe(AWAY_AFTER);
		room = refresh(room, online(1), AWAY_AFTER);
		expect(room.game.players.find((p) => p.id === 2)?.away).toBe(true);
	});

	it("marks a connected player away only when they sit on their turn", () => {
		let { room } = started();
		room = refresh(room, online(1, 2), 0);
		const current = room.game.turn?.playerId as number;
		const other = current === 1 ? 2 : 1;
		room = refresh(room, online(1, 2), AWAY_AFTER);
		expect(room.game.players.find((p) => p.id === current)?.away).toBe(true);
		expect(room.game.players.find((p) => p.id === other)?.away).toBe(false);
	});

	it("hands hosting to someone present when the host wanders off", () => {
		let { room } = started();
		const host = room.game.hostId;
		const other = host === 1 ? 2 : 1;
		room = refresh(room, online(other), 0);
		expect(room.game.hostId).toBe(host);
		room = refresh(room, online(other), AWAY_AFTER);
		expect(room.game.hostId).toBe(other);
	});
});

describe("deletion", () => {
	it("keeps a lobby for 30 minutes after the last person leaves", () => {
		let { room } = lobby(["Mochi"]);
		room = refresh(room, online(), 0);
		expect(shouldDelete(room, LOBBY_TTL - 1)).toBe(false);
		expect(nextWake(room)).toBe(AWAY_AFTER);
		expect(shouldDelete(room, LOBBY_TTL)).toBe(true);
	});

	it("keeps a running game for an hour with everyone gone", () => {
		let { room } = started();
		room = refresh(room, online(), 10 * MINUTE);
		expect(shouldDelete(room, 10 * MINUTE + PLAYING_TTL - 1)).toBe(false);
		expect(shouldDelete(room, 10 * MINUTE + PLAYING_TTL)).toBe(true);
	});

	it("comes back to life if someone reconnects in time", () => {
		let { room } = started();
		room = refresh(room, online(), 0);
		room = refresh(room, online(1), 30 * MINUTE);
		expect(room.emptySince).toBeNull();
		expect(shouldDelete(room, 2 * PLAYING_TTL)).toBe(false);
	});

	const finished = (now: number): Room => {
		let { room } = started();
		room = refresh(room, online(1, 2), 0);
		const loser = room.game.turn?.playerId as number;
		const r = act(room, loser, { type: "declareBankruptcy" }, ctx(now));
		if (!r.ok) throw new Error(r.error);
		return r.room;
	};

	it("deletes a finished game five minutes after it ends, even with people watching", () => {
		const room = finished(1000);
		expect(room.game.phase).toBe("finished");
		expect(room.finishedAt).toBe(1000);
		expect(shouldDelete(room, 1000 + FINISHED_TTL - 1)).toBe(false);
		expect(nextWake(room)).toBe(1000 + FINISHED_TTL);
		expect(shouldDelete(room, 1000 + FINISHED_TTL)).toBe(true);
	});

	it("deletes a finished game the moment the last player disconnects", () => {
		let room = finished(1000);
		room = refresh(room, online(1), 2000);
		expect(shouldDelete(room, 2000)).toBe(false);
		room = refresh(room, online(), 3000);
		expect(shouldDelete(room, 3000)).toBe(true);
	});

	it("play again cancels the finished-game countdown", () => {
		let room = finished(1000);
		const r = act(
			room,
			room.game.hostId as number,
			{ type: "playAgain" },
			ctx(2000),
		);
		if (!r.ok) throw new Error(r.error);
		room = r.room;
		expect(room.game.phase).toBe("lobby");
		expect(room.finishedAt).toBeNull();
		expect(shouldDelete(room, 2000 + FINISHED_TTL)).toBe(false);
	});

	it("deletes a room with no players", () => {
		expect(shouldDelete(newRoom(0), 0)).toBe(true);
	});
});

describe("alarm", () => {
	it("closes an auction when its clock runs out", () => {
		let { room } = started();
		room = refresh(room, online(1, 2), 0);
		const current = room.game.turn?.playerId as number;
		if (!room.game.turn) throw new Error("no turn");
		room.game.turn = { ...room.game.turn, phase: "auction" };
		room.game.auction = {
			space: 1,
			highBid: 30,
			highBidder: current,
			endsAt: 5000,
		};
		expect(nextWake(room)).toBe(5000);
		room = wake(room, online(1, 2), ctx(5000));
		expect(room.game.auction).toBeNull();
		expect(room.game.holdings[1]?.owner).toBe(current);
	});

	it("sets no alarm when there is nothing to wait for", () => {
		let { room } = lobby(["Mochi", "Tux"]);
		room = refresh(room, online(1, 2), 0);
		expect(nextWake(room)).toBeNull();
	});
});
