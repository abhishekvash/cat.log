import { type Connection, Server, type WSMessage } from "partyserver";
import {
	type ClientMessage,
	MAX_MESSAGE_BYTES,
	MAX_SPECTATORS,
	type ServerMessage,
} from "#/lib/multiplayer/protocol";
import {
	type Acted,
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
} from "#/lib/multiplayer/room";
import type { GameDefinition, SeatId } from "#/lib/multiplayer/types";
import { cryptoRng } from "#/lib/rng";

interface Seat {
	seat: SeatId | null;
}

const ROOM_KEY = "room";
/** Per connection: a burst of 20 messages, refilling at 10 a second. */
const BURST = 20;
const REFILL_PER_MS = 10 / 1000;

/**
 * The Durable Object class for one game's rooms, one room per object. A thin
 * shell: the game's rules and the shared room policy decide everything; this
 * stores the result, sends it out and keeps a single alarm. Nothing is written
 * until someone takes a seat, and everything is deleted when the room policy
 * says the room is done.
 */
export function createRoomServer<S, M, R, V>(def: GameDefinition<S, M, R, V>) {
	type GameRoom = Room<S, R>;
	type Out = ServerMessage<S | V, R>;

	return class RoomServer extends Server<Env> {
		static options = { hibernate: true };

		private room: GameRoom | null = null;
		private buckets = new Map<string, { tokens: number; at: number }>();

		async onStart() {
			const stored = await this.ctx.storage.get<GameRoom>(ROOM_KEY);
			// A room saved by an incompatible build ends politely rather than crashing.
			if (stored && stored.state?.version !== def.version) await this.wipe();
			else this.room = stored ?? null;
		}

		onConnect(connection: Connection<Seat>) {
			connection.setState({ seat: null });
		}

		async onMessage(connection: Connection<Seat>, raw: WSMessage) {
			if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return;
			if (!this.allow(connection.id)) {
				return this.send(connection, {
					type: "rejected",
					reason: "Slow down a little 🐾",
				});
			}
			let message: ClientMessage<M, R>;
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
					if (connection.state?.seat != null) return;
					const result = join(def, this.room, String(message.name ?? ""), now);
					if (!result.ok)
						return this.send(connection, {
							type: "rejected",
							reason: result.error,
						});
					this.room = result.room;
					connection.setState({ seat: result.seat });
					this.send(connection, {
						type: "welcome",
						seat: result.seat,
						token: result.token,
					});
					return this.commit(now);
				}
				case "intent": {
					const seat = connection.state?.seat;
					if (!this.room) return this.gone(connection);
					if (seat == null) {
						return this.send(connection, {
							type: "rejected",
							reason: "You're watching this game.",
						});
					}
					let result: Acted<S, R>;
					try {
						result = act(def, this.room, seat, message.intent, {
							rng: cryptoRng,
							now,
						});
					} catch (error) {
						// A bug in the rules must never corrupt the room: keep the last good state.
						console.error(`${def.id}: intent failed`, error);
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
					const seat = connection.state?.seat;
					if (!this.room || seat == null || this.room.state.hostId !== seat)
						return;
					const issued = issueRejoin(this.room, message.seat);
					this.room = issued.room;
					await this.save();
					return this.send(connection, {
						type: "rejoinLink",
						seat: message.seat,
						token: issued.token,
					});
				}
			}
		}

		private async hello(
			connection: Connection<Seat>,
			message: Extract<ClientMessage<M, R>, { type: "hello" }>,
			now: number,
		) {
			if (!this.room) {
				if (!message.create) return this.gone(connection);
				// Held in memory only; storage is written once someone takes a seat.
				this.room = newRoom(def, now);
			}
			let seat = seatFor(this.room, message.token);
			let token: string | undefined;
			if (seat === null && message.rejoin) {
				const redeemed = redeemRejoin(this.room, message.rejoin);
				if (redeemed) {
					this.room = redeemed.room;
					seat = redeemed.seat;
					token = redeemed.token;
				}
			}
			if (seat === null) {
				if (message.create && this.room.state.seats.length > 0) {
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
			connection.setState({ seat });
			this.send(connection, { type: "welcome", seat, token });
			// An empty, unsaved room: just show it.
			if (this.room.state.seats.length === 0)
				return this.sendState(connection, now);
			return this.commit(now);
		}

		async onClose(connection: Connection<Seat>) {
			this.buckets.delete(connection.id);
			if (!this.room) return;
			if (this.room.state.seats.length === 0) {
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
			this.room = wake(def, this.room, { rng: cryptoRng, now });
			return this.commit(now);
		}

		/** Re-checks presence, then either deletes the room or saves, sends and re-arms. */
		private async commit(now: number, closing?: string) {
			if (!this.room) return;
			this.room = refresh(def, this.room, this.onlineIds(closing), now);
			if (shouldDelete(this.room, now)) {
				for (const c of this.getConnections()) {
					if (c.id === closing) continue;
					this.send(c, { type: "roomGone" });
					c.close(4004, "game over");
				}
				return this.wipe();
			}
			await this.save();
			const wakeAt = nextWake(def, this.room);
			if (wakeAt === null) await this.ctx.storage.deleteAlarm();
			else await this.ctx.storage.setAlarm(Math.max(wakeAt, now + 50));
			for (const c of this.getConnections<Seat>()) {
				if (c.id !== closing) this.sendState(c, now);
			}
		}

		/** The room as one connection may see it. */
		private sendState(connection: Connection<Seat>, now: number) {
			if (!this.room) return;
			const { state } = this.room;
			const view = def.view;
			const game =
				view && state.game !== null
					? view(state.game, connection.state?.seat ?? null)
					: state.game;
			this.send(connection, { type: "state", room: { ...state, game }, now });
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
			const ids = new Set<SeatId>();
			for (const c of this.getConnections<Seat>()) {
				if (c.id === closing) continue;
				const id = c.state?.seat;
				if (id != null) ids.add(id);
			}
			return ids;
		}

		private spectatorCount() {
			let count = 0;
			for (const c of this.getConnections<Seat>())
				if (c.state?.seat == null) count++;
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

		private send(connection: Connection, message: Out) {
			connection.send(JSON.stringify(message));
		}
	};
}
