import { describe, expect, it } from "vitest";
import { seededRng } from "#/lib/rng";
import {
	AWAY_AFTER,
	act,
	FINISHED_TTL,
	type Intent,
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
import {
	type CountMove,
	type CountRules,
	type CountState,
	countingGame as game,
} from "./test-game";

// Every rule here runs against a toy game, so none of it can lean on one
// game's quirks.

type TestRoom = Room<CountState, CountRules>;

const ctx = (now: number) => ({ rng: seededRng(3), now });

function lobby(names: string[], now = 0) {
	let room = newRoom(game, now);
	const tokens: string[] = [];
	for (const name of names) {
		const r = join(game, room, name, now);
		if (!r.ok) throw new Error(r.error);
		room = r.room;
		tokens.push(r.token);
	}
	return { room, tokens };
}

function run(
	room: TestRoom,
	actor: number,
	intent: Intent<CountMove, CountRules>,
	now = 0,
) {
	const r = act(game, room, actor, intent, ctx(now));
	if (!r.ok) throw new Error(r.error);
	return r.room;
}

function started(now = 0, names = ["Mochi", "Tux"]) {
	const { room, tokens } = lobby(names, now);
	return { room: run(room, 1, { type: "start" }, now), tokens };
}

const online = (...ids: number[]) => new Set(ids);
const seat = (room: TestRoom, id: number) =>
	room.state.seats.find((s) => s.id === id);
const turnOf = (room: TestRoom) =>
	game.currentPlayer(room.state.game as CountState);

describe("lobby", () => {
	it("seats players with distinct cats and makes the first one host", () => {
		const { room } = lobby(["A", "B", "C"]);
		expect(room.state.hostId).toBe(1);
		expect(new Set(room.state.seats.map((s) => s.cat)).size).toBe(3);
	});

	it("cleans names and refuses a blank one", () => {
		const { room } = lobby([`  Mochi\u0007 the very long named cat  `]);
		expect(seat(room, 1)?.name).toBe("Mochi the very l");
		expect(join(game, room, "   ", 0)).toMatchObject({
			ok: false,
			error: "Pick a name first.",
		});
	});

	it("needs enough players and the host to start", () => {
		const one = lobby(["Solo"]).room;
		expect(act(game, one, 1, { type: "start" }, ctx(0))).toMatchObject({
			ok: false,
			error: "You need at least 2 cats to play.",
		});
		const { room } = lobby(["Solo", "Pal"]);
		expect(act(game, room, 2, { type: "start" }, ctx(0))).toMatchObject({
			ok: false,
			error: "Only the host can do that.",
		});
		const next = run(room, 1, { type: "start" });
		expect(next.state.phase).toBe("playing");
		expect(next.state.round).toBe(1);
		expect(next.state.game?.order).toEqual([1, 2]);
	});

	it("refuses a player past the game's limit", () => {
		const { room } = lobby(["A", "B", "C", "D"]);
		expect(join(game, room, "Late", 0)).toMatchObject({
			ok: false,
			error: "The room is full.",
		});
	});

	it("lets players change name and cat, but not to a taken cat", () => {
		const { room } = lobby(["A", "B"]);
		const renamed = run(room, 2, { type: "updateMe", name: "Bea" });
		expect(seat(renamed, 2)?.name).toBe("Bea");
		const taken = seat(room, 1)?.cat;
		expect(
			act(game, room, 2, { type: "updateMe", cat: taken }, ctx(0)),
		).toMatchObject({ ok: false, error: "Another player has that cat." });
	});

	it("keeps only the host's sanitised rules", () => {
		const { room } = lobby(["A", "B"]);
		const r = act(
			game,
			room,
			2,
			{ type: "setRules", rules: { target: 9 } },
			ctx(0),
		);
		expect(r.ok).toBe(false);
		const set = run(room, 1, {
			type: "setRules",
			rules: { target: "lots" } as never,
		});
		expect(set.state.rules).toEqual({ target: 5 });
	});

	it("passes hosting on when the host leaves the lobby", () => {
		const { room } = lobby(["A", "B"]);
		expect(run(room, 1, { type: "leave" }).state.hostId).toBe(2);
	});

	it("turns spectators' intents away", () => {
		const { room } = lobby(["A", "B"]);
		expect(act(game, room, 99, { type: "start" }, ctx(0))).toMatchObject({
			ok: false,
			error: "You're watching this game.",
		});
	});
});

describe("moves", () => {
	it("passes moves to the game and ends the room with it", () => {
		let { room } = started();
		expect(
			act(game, room, 2, { type: "move", move: { type: "count" } }, ctx(0)),
		).toMatchObject({ ok: false, error: "It's not your turn." });
		for (let i = 0; i < 5; i++)
			room = run(room, turnOf(room) as number, {
				type: "move",
				move: { type: "count" },
			});
		expect(room.state.phase).toBe("finished");
	});

	it("rejects moves before the game starts", () => {
		const { room } = lobby(["A", "B"]);
		expect(
			act(game, room, 1, { type: "move", move: { type: "count" } }, ctx(0)),
		).toMatchObject({ ok: false, error: "The game isn't running." });
	});
});

describe("seats", () => {
	it("maps device tokens to seats and treats others as spectators", () => {
		const { room, tokens } = lobby(["Mochi", "Tux"]);
		expect(seatFor(room, tokens[0])).toBe(1);
		expect(seatFor(room, tokens[1])).toBe(2);
		expect(seatFor(room, "nope")).toBeNull();
		expect(seatFor(room, undefined)).toBeNull();
	});

	it("moves a seat to a new device with a single-use rejoin link", () => {
		const { room: fresh, tokens } = lobby(["Mochi", "Tux"]);
		const room = refresh(game, fresh, online(1), 0);
		const issued = issueRejoin(game, room, 1, 2);
		if (!issued.ok) throw new Error(issued.error);
		const redeemed = redeemRejoin(issued.room, issued.token);
		if (!redeemed) throw new Error();
		expect(redeemed.seat).toBe(2);
		expect(seatFor(redeemed.room, redeemed.token)).toBe(2);
		expect(seatFor(redeemed.room, tokens[1])).toBeNull();
		expect(redeemRejoin(redeemed.room, issued.token)).toBeNull();
	});

	it("only issues rejoin links from the host for a disconnected player", () => {
		const { room: fresh } = lobby(["Mochi", "Tux", "Pip"]);
		const room = refresh(game, fresh, online(1, 2), 0);
		expect(issueRejoin(game, room, 2, 3)).toMatchObject({ ok: false });
		expect(issueRejoin(game, room, 1, 1)).toMatchObject({ ok: false });
		expect(issueRejoin(game, room, 1, 2)).toMatchObject({ ok: false });
		expect(issueRejoin(game, room, 1, 9)).toMatchObject({ ok: false });
		expect(issueRejoin(game, room, 1, 3)).toMatchObject({ ok: true });
	});

	it("won't redeem a rejoin link once the player is back", () => {
		const { room: fresh, tokens } = lobby(["Mochi", "Tux"]);
		const issued = issueRejoin(game, refresh(game, fresh, online(1), 0), 1, 2);
		if (!issued.ok) throw new Error(issued.error);
		const back = refresh(game, issued.room, online(1, 2), 0);
		expect(redeemRejoin(back, issued.token)).toBeNull();
		expect(seatFor(back, tokens[1])).toBe(2);
	});

	it("forgets the token of a player who leaves the lobby", () => {
		const { room, tokens } = lobby(["Mochi", "Tux"]);
		expect(seatFor(run(room, 2, { type: "leave" }), tokens[1])).toBeNull();
	});
});

describe("host controls", () => {
	it("skips or removes only a player who has wandered off", () => {
		let { room } = started(0, ["A", "B", "C"]);
		room = refresh(game, room, online(1, 2, 3), 0);
		const skip = { type: "hostSkip", seat: 1 } as const;
		expect(act(game, room, 2, skip, ctx(0))).toMatchObject({
			ok: false,
			error: "Only the host can do that.",
		});
		expect(act(game, room, 1, skip, ctx(0))).toMatchObject({ ok: false });
		// Player 1 hosts and drops off on their turn; hosting passes to 2 once they're away.
		room = refresh(game, room, online(2, 3), 0);
		room = refresh(game, room, online(2, 3), AWAY_AFTER);
		expect(room.state.hostId).toBe(2);
		expect(seat(room, 1)?.away).toBe(true);
		room = run(room, 2, skip, AWAY_AFTER);
		expect(turnOf(room)).toBe(2);
		room = run(room, 2, { type: "hostRemove", seat: 1 }, AWAY_AFTER);
		expect(room.state.game?.out).toEqual([1]);
		expect(
			act(game, room, 2, { type: "hostRemove", seat: 3 }, ctx(AWAY_AFTER)),
		).toMatchObject({ ok: false, error: "C is still here." });
	});

	it("removes anyone from the lobby, but not the host themself", () => {
		const { room } = lobby(["A", "B"]);
		expect(
			run(room, 1, { type: "hostRemove", seat: 2 }).state.seats,
		).toHaveLength(1);
		expect(
			act(game, room, 1, { type: "hostRemove", seat: 1 }, ctx(0)),
		).toMatchObject({ ok: false, error: "You can't remove yourself." });
	});

	it("ends the game when removing leaves one player, and hands hosting to them", () => {
		let { room } = started();
		room = refresh(game, room, online(2), 0);
		room = refresh(game, room, online(2), AWAY_AFTER);
		expect(room.state.hostId).toBe(2);
		room = run(room, 2, { type: "hostRemove", seat: 1 }, AWAY_AFTER);
		expect(room.state.phase).toBe("finished");
		expect(room.state.game?.winner).toBe(2);
	});
});

describe("presence", () => {
	it("marks a disconnected player away after two minutes", () => {
		let { room } = started();
		room = refresh(game, room, online(1), 0);
		expect(seat(room, 2)?.connected).toBe(false);
		expect(seat(room, 2)?.away).toBe(false);
		expect(nextWake(game, room)).toBe(AWAY_AFTER);
		room = refresh(game, room, online(1), AWAY_AFTER);
		expect(seat(room, 2)?.away).toBe(true);
	});

	it("marks a connected player away only when they sit on their turn", () => {
		let { room } = started();
		room = refresh(game, room, online(1, 2), 0);
		const current = turnOf(room) as number;
		const other = current === 1 ? 2 : 1;
		room = refresh(game, room, online(1, 2), AWAY_AFTER);
		expect(seat(room, current)?.away).toBe(true);
		expect(seat(room, other)?.away).toBe(false);
	});

	it("hands hosting to someone present when the host wanders off", () => {
		let { room } = started();
		const host = room.state.hostId;
		const other = host === 1 ? 2 : 1;
		room = refresh(game, room, online(other), 0);
		expect(room.state.hostId).toBe(host);
		room = refresh(game, room, online(other), AWAY_AFTER);
		expect(room.state.hostId).toBe(other);
	});

	it("only bumps seq when something visible changes", () => {
		let { room } = started();
		room = refresh(game, room, online(1, 2), 0);
		const seq = room.state.seq;
		expect(refresh(game, room, online(1, 2), 1).state.seq).toBe(seq);
		expect(refresh(game, room, online(1), 1).state.seq).toBe(seq + 1);
	});
});

describe("deletion", () => {
	it("keeps a lobby for 30 minutes after the last person leaves", () => {
		let { room } = lobby(["Mochi"]);
		room = refresh(game, room, online(), 0);
		expect(shouldDelete(room, LOBBY_TTL - 1)).toBe(false);
		expect(nextWake(game, room)).toBe(AWAY_AFTER);
		expect(shouldDelete(room, LOBBY_TTL)).toBe(true);
	});

	it("keeps a running game for an hour with everyone gone", () => {
		let { room } = started();
		room = refresh(game, room, online(), 10 * MINUTE);
		expect(shouldDelete(room, 10 * MINUTE + PLAYING_TTL - 1)).toBe(false);
		expect(shouldDelete(room, 10 * MINUTE + PLAYING_TTL)).toBe(true);
	});

	it("comes back to life if someone reconnects in time", () => {
		let { room } = started();
		room = refresh(game, room, online(), 0);
		room = refresh(game, room, online(1), 30 * MINUTE);
		expect(room.emptySince).toBeNull();
		expect(shouldDelete(room, 2 * PLAYING_TTL)).toBe(false);
	});

	const finished = (now: number): TestRoom => {
		let { room } = started();
		room = refresh(game, room, online(1, 2), 0);
		for (let i = 0; i < 5; i++)
			room = run(
				room,
				turnOf(room) as number,
				{ type: "move", move: { type: "count" } },
				now,
			);
		return room;
	};

	it("deletes a finished game five minutes after it ends, even with people watching", () => {
		const room = finished(1000);
		expect(room.state.phase).toBe("finished");
		expect(room.finishedAt).toBe(1000);
		expect(shouldDelete(room, 1000 + FINISHED_TTL - 1)).toBe(false);
		expect(nextWake(game, room)).toBe(1000 + FINISHED_TTL);
		expect(shouldDelete(room, 1000 + FINISHED_TTL)).toBe(true);
	});

	it("deletes a finished game the moment the last player disconnects", () => {
		let room = finished(1000);
		room = refresh(game, room, online(1), 2000);
		expect(shouldDelete(room, 2000)).toBe(false);
		room = refresh(game, room, online(), 3000);
		expect(shouldDelete(room, 3000)).toBe(true);
	});

	it("play again cancels the finished-game countdown and keeps only who's here", () => {
		let room = finished(1000);
		room = refresh(game, room, online(1), 1500);
		room = run(room, room.state.hostId as number, { type: "playAgain" }, 2000);
		expect(room.state.phase).toBe("lobby");
		expect(room.state.game).toBeNull();
		expect(room.state.seats.map((s) => s.id)).toEqual([1]);
		expect(room.finishedAt).toBeNull();
		expect(shouldDelete(room, 2000 + FINISHED_TTL)).toBe(false);
	});

	it("deletes a room with no players", () => {
		expect(shouldDelete(newRoom(game, 0), 0)).toBe(true);
	});
});

describe("alarm", () => {
	it("lets the game act on its own when its clock runs out", () => {
		let { room } = started();
		room = refresh(game, room, online(1, 2), 0);
		const current = turnOf(room) as number;
		room = run(room, current, {
			type: "move",
			move: { type: "stall", until: 5000 },
		});
		expect(nextWake(game, room)).toBe(5000);
		expect(wake(game, room, ctx(4999))).toMatchObject({
			state: { game: { clock: 5000 } },
		});
		room = wake(game, room, ctx(5000));
		expect(room.state.game?.clock).toBeNull();
		expect(turnOf(room)).not.toBe(current);
		expect(room.turnSince).toBe(5000);
	});

	it("sets no alarm when there is nothing to wait for", () => {
		let { room } = lobby(["Mochi", "Tux"]);
		room = refresh(game, room, online(1, 2), 0);
		expect(nextWake(game, room)).toBeNull();
	});
});
