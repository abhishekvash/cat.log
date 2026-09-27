import { addPlayer, createGame, reduce } from "./engine";
import type { Context, GameState, Intent, Result } from "./types";

/**
 * Room policy: who holds which seat, who's around, and when the room should
 * wake up or delete itself. Pure, so every lifecycle rule is testable without a
 * Durable Object; the GameRoom shell just stores and broadcasts the result.
 */

export const MINUTE = 60_000;
/** A lobby nobody is in. */
export const LOBBY_TTL = 30 * MINUTE;
/** A game in progress with every player disconnected. */
export const PLAYING_TTL = 60 * MINUTE;
/** A finished game, even with people still looking at the results. */
export const FINISHED_TTL = 5 * MINUTE;
/** Disconnected, or sitting on their turn, this long = "wandered off". */
export const AWAY_AFTER = 2 * MINUTE;

export interface Presence {
	online: boolean;
	/** When `online` last flipped. */
	since: number;
	/** Their last accepted move. */
	lastActive: number;
}

export interface Room {
	game: GameState;
	/** Device token → player id. */
	tokens: Record<string, number>;
	/** Single-use tokens the host hands out for switching devices. */
	rejoins: Record<string, number>;
	presence: Record<number, Presence>;
	/** When the current player's turn began, so waiting on others isn't idling. */
	turnSince: number;
	/** When the last player disconnected (null while anyone is online). */
	emptySince: number | null;
	finishedAt: number | null;
}

export function newRoom(now: number): Room {
	return {
		game: createGame(),
		tokens: {},
		rejoins: {},
		presence: {},
		turnSince: now,
		emptySince: null,
		finishedAt: null,
	};
}

export function newToken() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Finds the seat a device token belongs to (or null for a spectator). */
export function seatFor(room: Room, token: string | undefined) {
	if (!token) return null;
	const id = room.tokens[token];
	return id !== undefined && room.game.players.some((p) => p.id === id)
		? id
		: null;
}

/** Swaps a single-use rejoin token for a fresh device token. */
export function redeemRejoin(room: Room, rejoin: string) {
	const id = room.rejoins[rejoin];
	if (id === undefined || !room.game.players.some((p) => p.id === id))
		return null;
	const token = newToken();
	const tokens = Object.fromEntries(
		Object.entries(room.tokens).filter(([, pid]) => pid !== id),
	);
	tokens[token] = id;
	const rejoins = { ...room.rejoins };
	delete rejoins[rejoin];
	return { room: { ...room, tokens, rejoins }, token, playerId: id };
}

export function issueRejoin(room: Room, playerId: number) {
	const token = newToken();
	return {
		room: { ...room, rejoins: { ...room.rejoins, [token]: playerId } },
		token,
	};
}

export function join(room: Room, name: string, now: number) {
	const result = addPlayer(room.game, name);
	if (!result.ok) return result;
	const token = newToken();
	return {
		ok: true as const,
		token,
		playerId: result.playerId,
		room: {
			...room,
			game: result.state,
			tokens: { ...room.tokens, [token]: result.playerId },
			presence: {
				...room.presence,
				[result.playerId]: { online: true, since: now, lastActive: now },
			},
			emptySince: null,
		},
	};
}

/** Applies a player's move and keeps the room's bookkeeping in step. */
export function act(
	room: Room,
	actor: number | "system",
	intent: Intent | { type: "auctionClock" },
	ctx: Context,
): { ok: true; room: Room } | { ok: false; error: string } {
	const result: Result = reduce(room.game, actor, intent, ctx);
	if (!result.ok) return result;
	const next = { ...room, game: result.state, presence: { ...room.presence } };
	if (actor !== "system" && next.presence[actor])
		next.presence[actor] = { ...next.presence[actor], lastActive: ctx.now };
	if (room.game.turn?.playerId !== next.game.turn?.playerId)
		next.turnSince = ctx.now;
	if (next.game.phase === "finished" && room.game.phase !== "finished")
		next.finishedAt = ctx.now;
	if (next.game.phase !== "finished") next.finishedAt = null;
	return { ok: true, room: forgetMissing(next) };
}

/** Drops tokens and presence for players no longer in the game. */
function forgetMissing(room: Room): Room {
	const ids = new Set(room.game.players.map((p) => p.id));
	const keep = <T>(
		record: Record<string, T>,
		id: (v: T, k: string) => number,
	) =>
		Object.fromEntries(
			Object.entries(record).filter(([k, v]) => ids.has(id(v, k))),
		);
	return {
		...room,
		tokens: keep(room.tokens, (v) => v),
		rejoins: keep(room.rejoins, (v) => v),
		presence: keep(room.presence, (_, k) => Number(k)) as Record<
			number,
			Presence
		>,
	};
}

/**
 * Updates who's connected, who has wandered off, and who hosts. Bumps `seq`
 * when anything players can see has changed.
 */
export function refresh(
	room: Room,
	onlineIds: ReadonlySet<number>,
	now: number,
): Room {
	const game = structuredClone(room.game);
	const presence = { ...room.presence };
	let changed = false;

	for (const p of game.players) {
		const was = presence[p.id] ?? {
			online: false,
			since: now,
			lastActive: now,
		};
		const online = onlineIds.has(p.id);
		presence[p.id] =
			was.online === online
				? was
				: { ...was, online, since: now, lastActive: now };
		const away = isAway(room, game, p.id, presence[p.id], now);
		if (p.connected !== online || p.away !== away) {
			p.connected = online;
			p.away = away;
			changed = true;
		}
	}

	// A host who has wandered off hands the room to someone who's here.
	const host = game.players.find((p) => p.id === game.hostId);
	if (!host || (!host.connected && host.away) || host.bankrupt) {
		const heir = game.players.find((p) => p.connected && !p.bankrupt);
		if (heir && heir.id !== game.hostId) {
			game.hostId = heir.id;
			changed = true;
		}
	}

	if (changed) game.seq++;
	const anyone = game.players.some((p) => p.connected);
	return {
		...room,
		game: changed ? game : room.game,
		presence,
		emptySince: anyone ? null : (room.emptySince ?? now),
	};
}

function isAway(
	room: Room,
	game: GameState,
	id: number,
	presence: Presence,
	now: number,
) {
	if (!presence.online) return now - presence.since >= AWAY_AFTER;
	if (game.phase !== "playing" || game.turn?.playerId !== id) return false;
	return now - Math.max(presence.lastActive, room.turnSince) >= AWAY_AFTER;
}

export function shouldDelete(room: Room, now: number) {
	const { game } = room;
	if (game.players.length === 0) return true;
	const anyone = game.players.some((p) => p.connected);
	if (game.phase === "finished") {
		if (!anyone) return true;
		return room.finishedAt !== null && now >= room.finishedAt + FINISHED_TTL;
	}
	if (anyone || room.emptySince === null) return false;
	const ttl = game.phase === "lobby" ? LOBBY_TTL : PLAYING_TTL;
	return now >= room.emptySince + ttl;
}

/** The single moment the room next needs to wake up, if any. */
export function nextWake(room: Room): number | null {
	const { game } = room;
	const times: number[] = [];
	if (game.auction) times.push(game.auction.endsAt);
	if (game.phase === "finished" && room.finishedAt !== null)
		times.push(room.finishedAt + FINISHED_TTL);
	if (room.emptySince !== null && game.phase !== "finished")
		times.push(
			room.emptySince + (game.phase === "lobby" ? LOBBY_TTL : PLAYING_TTL),
		);
	for (const p of game.players) {
		const presence = room.presence[p.id];
		if (!presence || p.away || p.bankrupt) continue;
		if (!presence.online) times.push(presence.since + AWAY_AFTER);
		else if (game.phase === "playing" && game.turn?.playerId === p.id)
			times.push(Math.max(presence.lastActive, room.turnSince) + AWAY_AFTER);
	}
	return times.length ? Math.min(...times) : null;
}

/** What the alarm does: close a finished auction, then re-check presence. */
export function wake(
	room: Room,
	onlineIds: ReadonlySet<number>,
	ctx: Context,
): Room {
	let next = room;
	if (next.game.auction && ctx.now >= next.game.auction.endsAt) {
		const result = act(next, "system", { type: "auctionClock" }, ctx);
		if (result.ok) next = result.room;
	}
	return refresh(next, onlineIds, ctx.now);
}
