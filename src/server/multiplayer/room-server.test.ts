import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_MESSAGE_BYTES, MAX_SPECTATORS } from "#/lib/multiplayer/protocol";
import { countingGame } from "#/lib/multiplayer/test-game";
import { createRoomServer } from "./room-server";

// partyserver extends Cloudflare's DurableObject, which only loads inside the
// Workers runtime. Stand in a base class with just what the room server uses:
// storage, an alarm and the open connections.
vi.mock("partyserver", () => ({
	Server: class {
		connections = new Map<string, unknown>();
		alarm: number | null = null;
		data = new Map<string, unknown>();
		ctx = {
			storage: {
				get: async (key: string) => structuredClone(this.data.get(key)),
				put: async (key: string, value: unknown) => {
					this.data.set(key, structuredClone(value));
				},
				deleteAll: async () => this.data.clear(),
				setAlarm: async (at: number) => {
					this.alarm = at;
				},
				deleteAlarm: async () => {
					this.alarm = null;
				},
			},
		};
		getConnections() {
			return this.connections.values();
		}
	},
}));

type Sent = { type: string } & Record<string, unknown>;

function fakeConnection(id: string) {
	let state: unknown = null;
	return {
		id,
		sent: [] as Sent[],
		closed: [] as [number, string][],
		get state() {
			return state;
		},
		setState(next: unknown) {
			state = next;
			return next;
		},
		send(raw: string) {
			this.sent.push(JSON.parse(raw));
		},
		close(code: number, reason: string) {
			this.closed.push([code, reason]);
		},
	};
}

type FakeConnection = ReturnType<typeof fakeConnection>;

const RoomServer = createRoomServer(countingGame);

interface FakeBase {
	connections: Map<string, FakeConnection>;
	alarm: number | null;
	data: Map<string, { state: { version: number; seq: number } }>;
}

function server() {
	const s = new (
		RoomServer as unknown as new () => InstanceType<typeof RoomServer>
	)();
	const base = s as unknown as FakeBase;
	let next = 0;
	const connect = (id = `c${next++}`) => {
		const c = fakeConnection(id);
		base.connections.set(id, c);
		s.onConnect(c as never);
		return c;
	};
	const send = (c: FakeConnection, message: unknown) =>
		s.onMessage(
			c as never,
			typeof message === "string" ? message : JSON.stringify(message),
		);
	const close = async (c: FakeConnection) => {
		await s.onClose(c as never);
		base.connections.delete(c.id);
	};
	return { s, base, connect, send, close };
}

const last = (c: FakeConnection) => c.sent.at(-1);
const ofType = (c: FakeConnection, type: string) =>
	c.sent.filter((m) => m.type === type);

/** A room with `names` seated, each on their own connection. */
async function seated(names: string[]) {
	const t = server();
	const players = [];
	for (const [i, name] of names.entries()) {
		const c = t.connect();
		await t.send(c, { type: "hello", create: i === 0 });
		await t.send(c, { type: "join", name });
		const welcome = ofType(c, "welcome").at(-1);
		players.push({ c, seat: welcome?.seat as number, token: welcome?.token });
	}
	return { ...t, players };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1_000_000);
	vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("incoming messages", () => {
	it("drops anything that isn't a string or is too long", async () => {
		const { s, connect, send } = server();
		const c = connect();
		await s.onMessage(c as never, new ArrayBuffer(8));
		await send(
			c,
			JSON.stringify({
				type: "hello",
				create: true,
				pad: "x".repeat(MAX_MESSAGE_BYTES),
			}),
		);
		expect(c.sent).toEqual([]);
	});

	it("ignores malformed JSON", async () => {
		const { connect, send } = server();
		const c = connect();
		await send(c, "{not json");
		expect(c.sent).toEqual([]);
	});

	it("rate-limits a burst, and forgets the limit once the connection closes", async () => {
		const { connect, send, close } = server();
		const c = connect("same");
		for (let i = 0; i < 20; i++) await send(c, "{");
		expect(c.sent).toEqual([]);
		await send(c, "{");
		expect(last(c)).toMatchObject({ type: "rejected" });
		expect(last(c)?.reason).toMatch(/slow down/i);

		await close(c);
		const again = connect("same");
		await send(again, "{");
		expect(again.sent).toEqual([]);
	});
});

describe("hello", () => {
	it("creates a room in memory without writing it", async () => {
		const { base, connect, send } = server();
		const c = connect();
		await send(c, { type: "hello", create: true });
		expect(c.sent.map((m) => m.type)).toEqual(["welcome", "state"]);
		expect(c.sent[0]).toMatchObject({ seat: null });
		expect(base.data.size).toBe(0);
	});

	it("turns away a visitor when there's no room", async () => {
		const { connect, send } = server();
		const c = connect();
		await send(c, { type: "hello" });
		expect(c.sent).toEqual([{ type: "roomGone" }]);
		expect(c.closed).toEqual([[4004, "no such room"]]);
	});

	it("won't let someone create over a room with players", async () => {
		const { connect, send } = await seated(["Ann"]);
		const c = connect();
		await send(c, { type: "hello", create: true });
		expect(c.sent).toEqual([{ type: "roomTaken" }]);
		expect(c.closed[0][0]).toBe(4000);
	});

	it("turns away spectators past the limit", async () => {
		const { connect, send } = server();
		const host = connect();
		await send(host, { type: "hello", create: true });
		for (let i = 1; i < MAX_SPECTATORS; i++) {
			const c = connect();
			await send(c, { type: "hello" });
			expect(c.closed).toEqual([]);
		}
		const extra = connect();
		await send(extra, { type: "hello" });
		expect(extra.sent).toEqual([
			{ type: "rejected", reason: "This room is full." },
		]);
		expect(extra.closed).toEqual([[4001, "full"]]);
	});

	it("gives a returning device its seat back", async () => {
		const { connect, send, players } = await seated(["Ann", "Bo"]);
		const c = connect();
		await send(c, { type: "hello", token: players[1].token });
		expect(ofType(c, "welcome")[0]).toMatchObject({ seat: players[1].seat });
	});
});

describe("join", () => {
	it("seats the player, hands out a token and saves the room", async () => {
		const { base, connect, send } = server();
		const c = connect();
		await send(c, { type: "hello", create: true });
		await send(c, { type: "join", name: "Ann" });
		const welcome = ofType(c, "welcome").at(-1);
		expect(welcome?.seat).toEqual(expect.any(Number));
		expect(welcome?.token).toEqual(expect.any(String));
		expect(base.data.get("room")?.state).toMatchObject({
			seats: [expect.objectContaining({ name: "Ann" })],
		});
	});

	it("ignores a second join from a seated connection", async () => {
		const { base, send, players } = await seated(["Ann"]);
		const before = base.data.get("room")?.state.seq;
		const sentBefore = players[0].c.sent.length;
		await send(players[0].c, { type: "join", name: "Again" });
		expect(players[0].c.sent.length).toBe(sentBefore);
		expect(base.data.get("room")?.state.seq).toBe(before);
	});

	it("sends a visitor away when there's no room", async () => {
		const { connect, send } = server();
		const c = connect();
		await send(c, { type: "join", name: "Ann" });
		expect(c.sent).toEqual([{ type: "roomGone" }]);
	});
});

describe("intent", () => {
	it("rejects a spectator", async () => {
		const { connect, send } = await seated(["Ann"]);
		const c = connect();
		await send(c, { type: "hello" });
		await send(c, { type: "intent", intent: { type: "start" } });
		expect(last(c)).toEqual({
			type: "rejected",
			reason: "You're watching this game.",
		});
	});

	it("applies a move and sends everyone the new state", async () => {
		const { send, players } = await seated(["Ann", "Bo"]);
		await send(players[0].c, { type: "intent", intent: { type: "start" } });
		await send(players[0].c, {
			type: "intent",
			intent: { type: "move", move: { type: "count" } },
		});
		for (const { c } of players)
			expect(last(c)).toMatchObject({
				type: "state",
				room: { game: { count: 1 } },
			});
	});

	it("makes a player who leaves a spectator on the same connection", async () => {
		const { send, players } = await seated(["Ann", "Bo"]);
		const bo = players[1].c;
		await send(bo, { type: "intent", intent: { type: "leave" } });
		expect(ofType(bo, "welcome").at(-1)).toEqual({
			type: "welcome",
			seat: null,
		});
		await send(bo, { type: "intent", intent: { type: "start" } });
		expect(last(bo)).toEqual({
			type: "rejected",
			reason: "You're watching this game.",
		});
	});

	it("keeps the last good state when the rules throw", async () => {
		const { base, send, players } = await seated(["Ann", "Bo"]);
		await send(players[0].c, { type: "intent", intent: { type: "start" } });
		const before = base.data.get("room");
		vi.spyOn(countingGame, "reduce").mockImplementation(() => {
			throw new Error("boom");
		});
		await send(players[0].c, {
			type: "intent",
			intent: { type: "move", move: { type: "count" } },
		});
		expect(last(players[0].c)).toEqual({
			type: "rejected",
			reason: "Something went wrong. Try that again?",
		});
		expect(base.data.get("room")).toEqual(before);
	});
});

describe("issueRejoin", () => {
	it("does nothing for a spectator", async () => {
		const { connect, send, players } = await seated(["Ann", "Bo"]);
		const c = connect();
		await send(c, { type: "hello" });
		const sent = c.sent.length;
		await send(c, { type: "issueRejoin", seat: players[1].seat });
		expect(c.sent.length).toBe(sent);
	});

	it("moves a dropped seat to a new device and retires the old token", async () => {
		const { connect, send, close, players } = await seated(["Ann", "Bo"]);
		const [host, bo] = players;
		await close(bo.c);

		await send(host.c, { type: "issueRejoin", seat: bo.seat });
		const link = last(host.c);
		expect(link).toMatchObject({ type: "rejoinLink", seat: bo.seat });

		const device = connect();
		await send(device, { type: "hello", rejoin: link?.token });
		const welcome = ofType(device, "welcome")[0];
		expect(welcome.seat).toBe(bo.seat);
		expect(welcome.token).not.toBe(bo.token);

		const stale = connect();
		await send(stale, { type: "hello", token: bo.token });
		expect(ofType(stale, "welcome")[0]).toMatchObject({ seat: null });
	});

	it("rejects anyone but the host", async () => {
		const { send, close, players } = await seated(["Ann", "Bo", "Cy"]);
		await close(players[2].c);
		await send(players[1].c, { type: "issueRejoin", seat: players[2].seat });
		expect(last(players[1].c)).toEqual({
			type: "rejected",
			reason: "Only the host can do that.",
		});
	});
});

describe("onStart", () => {
	it("wipes a room saved by another version", async () => {
		const { s, base } = server();
		base.data.set("room", { state: { version: 999, seq: 0 } });
		base.alarm = 123;
		await s.onStart();
		expect(base.data.size).toBe(0);
		expect(base.alarm).toBeNull();
	});
});
