import { type Connection, Server, type WSMessage } from "partyserver";
import {
	type ClientMessage,
	MAX_MESSAGE_BYTES,
	MAX_SPECTATORS,
	type ServerMessage,
} from "#/lib/monopawly/protocol";
import { cryptoRng } from "#/lib/monopawly/rng";
import {
	act,
	issueRejoin,
	join,
	newRoom,
	nextWake,
	type Room,
	redeemRejoin,
	refresh,
	seatFor,
	shouldDelete,
	wake,
} from "#/lib/monopawly/room";
import { STATE_VERSION } from "#/lib/monopawly/types";

interface Seat {
	playerId: number | null;
}

const ROOM_KEY = "room";
/** Per connection: a burst of 20 messages, refilling at 10 a second. */
const BURST = 20;
const REFILL_PER_MS = 10 / 1000;

/**
 * One Monopawly room. A thin shell: all rules live in the pure engine and room
 * policy; this stores the result, broadcasts it and keeps a single alarm.
 * Nothing is written until someone takes a seat, and everything is deleted when
 * the room policy says the game is over.
 */
export class GameRoom extends Server<Env> {
	static options = { hibernate: true };

	private room: Room | null = null;
	private buckets = new Map<string, { tokens: number; at: number }>();

	async onStart() {
		const stored = await this.ctx.storage.get<Room>(ROOM_KEY);
		// A room saved by an incompatible build ends politely rather than crashing.
		if (stored && stored.game.version !== STATE_VERSION) await this.wipe();
		else this.room = stored ?? null;
	}

	onConnect(connection: Connection<Seat>) {
		connection.setState({ playerId: null });
	}

	async onMessage(connection: Connection<Seat>, raw: WSMessage) {
		if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return;
		if (!this.allow(connection.id)) {
			return this.send(connection, {
				type: "rejected",
				reason: "Slow down a little 🐾",
			});
		}
		let message: ClientMessage;
		try {
			message = JSON.parse(raw);
		} catch {
			return;
		}
		const now = Date.now();

		switch (message.type) {
			case "hello":
				return this.hello(connection, message, now);
			case "join": {
				if (!this.room) return this.gone(connection);
				if (connection.state?.playerId != null) return;
				const result = join(this.room, String(message.name ?? ""), now);
				if (!result.ok)
					return this.send(connection, {
						type: "rejected",
						reason: result.error,
					});
				this.room = result.room;
				connection.setState({ playerId: result.playerId });
				this.send(connection, {
					type: "welcome",
					playerId: result.playerId,
					token: result.token,
				});
				return this.commit(now);
			}
			case "intent": {
				const playerId = connection.state?.playerId;
				if (!this.room) return this.gone(connection);
				if (playerId == null) {
					return this.send(connection, {
						type: "rejected",
						reason: "You're watching this game.",
					});
				}
				let result: ReturnType<typeof act>;
				try {
					result = act(this.room, playerId, message.intent, {
						rng: cryptoRng,
						now,
					});
				} catch (error) {
					// A bug in the rules must never corrupt the game: keep the last good state.
					console.error("monopawly: intent failed", error);
					result = {
						ok: false,
						error: "Something went wrong. Try that again?",
					};
				}
				if (!result.ok)
					return this.send(connection, {
						type: "rejected",
						reason: result.error,
					});
				this.room = result.room;
				return this.commit(now);
			}
			case "issueRejoin": {
				const playerId = connection.state?.playerId;
				if (
					!this.room ||
					playerId == null ||
					this.room.game.hostId !== playerId
				)
					return;
				const issued = issueRejoin(this.room, message.playerId);
				this.room = issued.room;
				await this.save();
				return this.send(connection, {
					type: "rejoinLink",
					playerId: message.playerId,
					token: issued.token,
				});
			}
		}
	}

	private async hello(
		connection: Connection<Seat>,
		message: Extract<ClientMessage, { type: "hello" }>,
		now: number,
	) {
		if (!this.room) {
			if (!message.create) return this.gone(connection);
			// Held in memory only; storage is written once someone takes a seat.
			this.room = newRoom(now);
		}
		let playerId = seatFor(this.room, message.token);
		let token: string | undefined;
		if (playerId === null && message.rejoin) {
			const redeemed = redeemRejoin(this.room, message.rejoin);
			if (redeemed) {
				this.room = redeemed.room;
				playerId = redeemed.playerId;
				token = redeemed.token;
			}
		}
		if (playerId === null) {
			if (message.create && this.room.game.players.length > 0) {
				this.send(connection, { type: "roomTaken" });
				return connection.close(4000, "room taken");
			}
			if (this.spectatorCount() > MAX_SPECTATORS) {
				this.send(connection, {
					type: "rejected",
					reason: "This room is full.",
				});
				return connection.close(4001, "full");
			}
		}
		connection.setState({ playerId });
		this.send(connection, { type: "welcome", playerId, token });
		if (this.room.game.players.length === 0) {
			// An empty, unsaved room: just show it.
			return this.send(connection, {
				type: "state",
				state: this.room.game,
				now,
			});
		}
		return this.commit(now);
	}

	async onClose(connection: Connection<Seat>) {
		this.buckets.delete(connection.id);
		if (!this.room) return;
		if (this.room.game.players.length === 0) {
			// Nobody ever sat down; forget the room once its last visitor leaves.
			if (![...this.getConnections()].some((c) => c.id !== connection.id))
				this.room = null;
			return;
		}
		return this.commit(Date.now(), connection.id);
	}

	async onAlarm() {
		if (!this.room) return;
		const now = Date.now();
		this.room = wake(this.room, this.onlineIds(), { rng: cryptoRng, now });
		return this.commit(now, undefined, true);
	}

	/** Re-checks presence, then either deletes the room or saves, broadcasts and re-arms. */
	private async commit(now: number, closing?: string, fromAlarm = false) {
		if (!this.room) return;
		if (!fromAlarm)
			this.room = refresh(this.room, this.onlineIds(closing), now);
		if (shouldDelete(this.room, now)) {
			for (const c of this.getConnections()) {
				if (c.id === closing) continue;
				this.send(c, { type: "roomGone" });
				c.close(4004, "game over");
			}
			return this.wipe();
		}
		await this.save();
		const wakeAt = nextWake(this.room);
		if (wakeAt === null) await this.ctx.storage.deleteAlarm();
		else await this.ctx.storage.setAlarm(Math.max(wakeAt, now + 50));
		this.broadcast(
			JSON.stringify({
				type: "state",
				state: this.room.game,
				now,
			} satisfies ServerMessage),
		);
	}

	private async save() {
		if (this.room) await this.ctx.storage.put(ROOM_KEY, this.room);
	}

	private async wipe() {
		this.room = null;
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
	}

	private gone(connection: Connection) {
		this.send(connection, { type: "roomGone" });
		connection.close(4004, "no such room");
	}

	private onlineIds(closing?: string) {
		const ids = new Set<number>();
		for (const c of this.getConnections<Seat>()) {
			if (c.id === closing) continue;
			const id = c.state?.playerId;
			if (id != null) ids.add(id);
		}
		return ids;
	}

	private spectatorCount() {
		let count = 0;
		for (const c of this.getConnections<Seat>())
			if (c.state?.playerId == null) count++;
		return count;
	}

	private allow(id: string) {
		const now = Date.now();
		const bucket = this.buckets.get(id) ?? { tokens: BURST, at: now };
		bucket.tokens = Math.min(
			BURST,
			bucket.tokens + (now - bucket.at) * REFILL_PER_MS,
		);
		bucket.at = now;
		this.buckets.set(id, bucket);
		if (bucket.tokens < 1) return false;
		bucket.tokens -= 1;
		return true;
	}

	private send(connection: Connection, message: ServerMessage) {
		connection.send(JSON.stringify(message));
	}
}
