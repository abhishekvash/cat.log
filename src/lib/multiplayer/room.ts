import { CATS, type Cat } from "#/lib/cats";
import {
	attempt,
	type Context,
	type GameDefinition,
	type Result,
	type RoomState,
	reject,
	type Seat,
	type SeatId,
} from "./types";

/**
 * Room policy for every online game: who holds which seat, the lobby, who's
 * around, who hosts, and when the room should wake up or delete itself. Pure,
 * so every rule is testable without a Durable Object; the room server just
 * stores and broadcasts the result.
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

export const NAME_MAX = 16;

// The room machinery never looks inside a game's view.
type Game<S, M, R> = GameDefinition<S, M, R, unknown>;

export interface Presence {
	online: boolean;
	/** When `online` last flipped. */
	since: number;
	/** Their last accepted move. */
	lastActive: number;
}

/** The server's copy of a room. Only `state` is ever sent to devices. */
export interface Room<S, R> {
	state: RoomState<S, R>;
	/** Device token → seat. */
	tokens: Record<string, SeatId>;
	/** Single-use tokens the host hands out for switching devices. */
	rejoins: Record<string, SeatId>;
	presence: Record<SeatId, Presence>;
	/** When the current player's turn began, so waiting on others isn't idling. */
	turnSince: number;
	/** When the last player disconnected (null while anyone is online). */
	emptySince: number | null;
	finishedAt: number | null;
}

/** What seated players can ask of the room itself. */
export type RoomIntent<R> =
	| { type: "updateMe"; name?: string; cat?: Cat }
	| { type: "setRules"; rules: R }
	| { type: "start" }
	| { type: "leave" }
	| { type: "playAgain" }
	| { type: "hostSkip"; seat: SeatId }
	| { type: "hostRemove"; seat: SeatId };

/** Anything a seated player sends: a room intent, or a move in the game. */
export type Intent<M, R> = RoomIntent<R> | { type: "move"; move: M };

export type Acted<S, R> =
	| { ok: true; room: Room<S, R> }
	| { ok: false; error: string };

export function newRoom<S, M, R>(def: Game<S, M, R>, now: number): Room<S, R> {
	return {
		state: {
			version: def.version,
			phase: "lobby",
			seats: [],
			hostId: null,
			nextSeatId: 1,
			rules: structuredClone(def.defaultRules),
			game: null,
			round: 0,
			seq: 0,
		},
		tokens: {},
		rejoins: {},
		presence: {},
		turnSince: now,
		emptySince: null,
		finishedAt: null,
	};
}

function cleanName(raw: string) {
	return [...String(raw)]
		.filter((ch) => ch >= " " && ch !== "\u007f")
		.join("")
		.trim()
		.slice(0, NAME_MAX);
}

function newToken() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- seats

const seated = (
	state: RoomState<unknown, unknown>,
	id: SeatId | undefined,
): id is SeatId => id !== undefined && state.seats.some((s) => s.id === id);

export const seatById = (
	state: RoomState<unknown, unknown>,
	id: SeatId | null | undefined,
) => state.seats.find((s) => s.id === id);

/**
 * A copy of the room's state that's safe to change: seats are copied, and
 * everything else is only ever replaced whole (the game by the definition's own
 * copy-on-write, the rules by `sanitizeRules`), so a deep copy would be wasted.
 */
const draft = <S, R>(state: RoomState<S, R>): RoomState<S, R> => ({
	...state,
	seats: state.seats.map((seat) => ({ ...seat })),
});

/** How long a room with nobody connected is kept. */
const emptyTtl = (phase: RoomState<unknown, unknown>["phase"]) =>
	phase === "lobby" ? LOBBY_TTL : PLAYING_TTL;

/** Finds the seat a device token belongs to (or null for a spectator). */
export function seatFor<S, R>(room: Room<S, R>, token: string | undefined) {
	const id = token ? room.tokens[token] : undefined;
	return seated(room.state, id) ? id : null;
}

/** Swaps a single-use rejoin token for a fresh device token. */
export function redeemRejoin<S, R>(room: Room<S, R>, rejoin: string) {
	const seat = room.rejoins[rejoin];
	if (!seated(room.state, seat)) return null;
	// Never bump a live device: the link is only for a seat left behind.
	if (seatById(room.state, seat)?.connected) return null;
	const token = newToken();
	const tokens = Object.fromEntries(
		Object.entries(room.tokens).filter(([, id]) => id !== seat),
	);
	tokens[token] = seat;
	const rejoins = { ...room.rejoins };
	delete rejoins[rejoin];
	return { room: { ...room, tokens, rejoins }, token, seat };
}

/**
 * Lets the host move a disconnected player's seat to a new device. Anything
 * else would let the host take over someone who's still playing.
 */
export function issueRejoin<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	host: SeatId,
	seat: SeatId,
):
	| { ok: true; room: Room<S, R>; token: string }
	| { ok: false; error: string } {
	const { state } = room;
	if (state.hostId !== host)
		return { ok: false, error: "Only the host can do that." };
	const target = seatById(state, seat);
	if (!target || seat === host || isOut(def, state, seat))
		return { ok: false, error: "That player can't get a new device link." };
	if (target.connected)
		return { ok: false, error: `${target.name} is still here.` };
	const token = newToken();
	return {
		ok: true,
		room: { ...room, rejoins: { ...room.rejoins, [token]: seat } },
		token,
	};
}

/** Seats a newcomer in the lobby and issues their device token. */
export function join<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	name: string,
	now: number,
):
	| { ok: true; room: Room<S, R>; seat: SeatId; token: string }
	| {
			ok: false;
			error: string;
	  } {
	const seat = room.state.nextSeatId;
	const result = attempt(
		room.state,
		(s) => {
			if (s.phase !== "lobby") reject("This game has already started.");
			if (s.seats.length >= def.maxPlayers) reject("The room is full.");
			const clean = cleanName(name);
			if (!clean) reject("Pick a name first.");
			const taken = new Set(s.seats.map((x) => x.cat));
			const cat = CATS.find((c) => !taken.has(c)) ?? CATS[seat % CATS.length];
			s.seats.push({
				id: seat,
				name: clean,
				cat,
				connected: true,
				away: false,
			});
			s.nextSeatId++;
			s.hostId ??= seat;
			s.seq++;
		},
		draft,
	);
	if (!result.ok) return result;
	const token = newToken();
	return {
		ok: true,
		seat,
		token,
		room: {
			...room,
			state: result.state,
			tokens: { ...room.tokens, [token]: seat },
			presence: {
				...room.presence,
				[seat]: { online: true, since: now, lastActive: now },
			},
			emptySince: null,
		},
	};
}

// ---------------------------------------------------------------- intents

const currentPlayer = <S, M, R>(def: Game<S, M, R>, s: RoomState<S, R>) =>
	s.phase === "playing" && s.game ? def.currentPlayer(s.game) : null;

const isOut = <S, M, R>(def: Game<S, M, R>, s: RoomState<S, R>, id: SeatId) =>
	s.phase !== "lobby" && !!s.game && def.isOut(s.game, id);

function seatOf(s: RoomState<unknown, unknown>, id: SeatId): Seat {
	const seat = seatById(s, id);
	if (!seat) reject("That player isn't in this room.");
	return seat;
}

function unwrap<S>(result: Result<S>): S {
	if (!result.ok) reject(result.error);
	return result.state;
}

function inLobby(s: RoomState<unknown, unknown>) {
	if (s.phase !== "lobby") reject("The game has already started.");
}

function playing<S>(s: RoomState<S, unknown>): S {
	if (s.phase !== "playing" || !s.game) reject("The game isn't running.");
	return s.game;
}

function hostOnly(s: RoomState<unknown, unknown>, me: Seat) {
	if (s.hostId !== me.id) reject("Only the host can do that.");
}

function removeFromLobby(s: RoomState<unknown, unknown>, id: SeatId) {
	s.seats = s.seats.filter((x) => x.id !== id);
}

function apply<S, M, R>(
	def: Game<S, M, R>,
	s: RoomState<S, R>,
	actor: SeatId,
	intent: Intent<M, R>,
	ctx: Context,
) {
	const me = seatById(s, actor);
	if (!me) reject("You're watching this game.");

	switch (intent.type) {
		case "move":
			s.game = unwrap(def.reduce(playing(s), me.id, intent.move, ctx));
			return;
		case "updateMe": {
			inLobby(s);
			if (intent.name !== undefined) {
				const name = cleanName(intent.name);
				if (!name) reject("Pick a name first.");
				me.name = name;
			}
			if (intent.cat !== undefined) {
				if (!CATS.includes(intent.cat)) reject("That's not a cat.");
				if (s.seats.some((x) => x.id !== me.id && x.cat === intent.cat))
					reject("Another player has that cat.");
				me.cat = intent.cat;
			}
			return;
		}
		case "setRules":
			inLobby(s);
			hostOnly(s, me);
			s.rules = def.sanitizeRules(intent.rules);
			return;
		case "start":
			inLobby(s);
			hostOnly(s, me);
			if (s.seats.length < def.minPlayers)
				reject(`You need at least ${def.minPlayers} cats to play.`);
			s.game = def.start(s.seats, s.rules, ctx);
			s.phase = "playing";
			s.round++;
			return;
		case "leave":
			inLobby(s);
			removeFromLobby(s, me.id);
			return;
		case "playAgain":
			if (s.phase !== "finished") reject("The game isn't over yet.");
			hostOnly(s, me);
			// Only the cats still around carry over to the next game.
			s.seats = s.seats
				.filter((x) => x.connected)
				.map((x) => ({ ...x, away: false }));
			s.phase = "lobby";
			s.game = null;
			return;
		case "hostSkip": {
			const game = playing(s);
			hostOnly(s, me);
			const target = seatOf(s, intent.seat);
			if (def.currentPlayer(game) !== target.id) reject("It isn't their turn.");
			if (!target.away) reject(`${target.name} is still here.`);
			s.game = unwrap(def.skipTurn(game, ctx));
			return;
		}
		case "hostRemove": {
			hostOnly(s, me);
			const target = seatOf(s, intent.seat);
			if (target.id === me.id) reject("You can't remove yourself.");
			if (s.phase === "lobby") return removeFromLobby(s, target.id);
			const game = playing(s);
			if (def.isOut(game, target.id)) reject(`${target.name} is already out.`);
			if (!target.away) reject(`${target.name} is still here.`);
			s.game = unwrap(def.removeSeat(game, target.id, ctx));
			return;
		}
		default:
			intent satisfies never;
			reject("Unknown move.");
	}
}

/** After any change: end a finished game and keep a host who's still in it. */
function settle<S, M, R>(def: Game<S, M, R>, s: RoomState<S, R>) {
	if (s.phase === "playing" && s.game && def.isOver(s.game))
		s.phase = "finished";
	const host = seatById(s, s.hostId);
	if (!host || isOut(def, s, host.id))
		s.hostId =
			s.seats.find((x) => !isOut(def, s, x.id))?.id ?? host?.id ?? null;
	s.seq++;
}

/** Runs one change and keeps the room's bookkeeping in step. */
function advance<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	actor: SeatId | null,
	change: (s: RoomState<S, R>) => void,
	now: number,
): Acted<S, R> {
	const result = attempt(
		room.state,
		(s) => {
			change(s);
			settle(def, s);
		},
		draft,
	);
	if (!result.ok) return result;
	const next: Room<S, R> = {
		...room,
		state: result.state,
		presence: { ...room.presence },
	};
	if (actor !== null && next.presence[actor])
		next.presence[actor] = { ...next.presence[actor], lastActive: now };
	if (currentPlayer(def, room.state) !== currentPlayer(def, next.state))
		next.turnSince = now;
	if (next.state.phase !== "finished") next.finishedAt = null;
	else if (room.state.phase !== "finished") next.finishedAt = now;
	return { ok: true, room: forgetMissing(next) };
}

/** Applies a seated player's intent. */
export function act<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	actor: SeatId,
	intent: Intent<M, R>,
	ctx: Context,
): Acted<S, R> {
	return advance(
		def,
		room,
		actor,
		(s) => apply(def, s, actor, intent, ctx),
		ctx.now,
	);
}

/** Drops tokens and presence for seats no longer in the room. */
function forgetMissing<S, R>(room: Room<S, R>): Room<S, R> {
	const ids = new Set(room.state.seats.map((x) => x.id));
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
			SeatId,
			Presence
		>,
	};
}

// ---------------------------------------------------------------- presence

/**
 * Updates who's connected, who has wandered off, and who hosts. Bumps `seq`
 * when anything players can see has changed.
 */
export function refresh<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	onlineIds: ReadonlySet<SeatId>,
	now: number,
): Room<S, R> {
	const state = draft(room.state);
	const presence = { ...room.presence };
	let changed = false;

	for (const seat of state.seats) {
		const was = presence[seat.id] ?? {
			online: false,
			since: now,
			lastActive: now,
		};
		const online = onlineIds.has(seat.id);
		presence[seat.id] =
			was.online === online
				? was
				: { ...was, online, since: now, lastActive: now };
		const away = isAway(def, room, state, seat.id, presence[seat.id], now);
		if (seat.connected !== online || seat.away !== away) {
			seat.connected = online;
			seat.away = away;
			changed = true;
		}
	}

	// A host who has wandered off hands the room to someone who's here.
	const host = seatById(state, state.hostId);
	if (!host || (!host.connected && host.away) || isOut(def, state, host.id)) {
		const heir = state.seats.find(
			(x) => x.connected && !isOut(def, state, x.id),
		);
		if (heir && heir.id !== state.hostId) {
			state.hostId = heir.id;
			changed = true;
		}
	}

	if (changed) state.seq++;
	const anyone = state.seats.some((x) => x.connected);
	return {
		...room,
		state: changed ? state : room.state,
		presence,
		emptySince: anyone ? null : (room.emptySince ?? now),
	};
}

function isAway<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	state: RoomState<S, R>,
	id: SeatId,
	presence: Presence,
	now: number,
) {
	if (!presence.online) return now - presence.since >= AWAY_AFTER;
	if (currentPlayer(def, state) !== id) return false;
	return now - Math.max(presence.lastActive, room.turnSince) >= AWAY_AFTER;
}

// ---------------------------------------------------------------- lifetime

export function shouldDelete<S, R>(room: Room<S, R>, now: number) {
	const { state } = room;
	if (state.seats.length === 0) return true;
	const anyone = state.seats.some((x) => x.connected);
	if (state.phase === "finished") {
		if (!anyone) return true;
		return room.finishedAt !== null && now >= room.finishedAt + FINISHED_TTL;
	}
	if (anyone || room.emptySince === null) return false;
	return now >= room.emptySince + emptyTtl(state.phase);
}

const gameTimer = <S, M, R>(def: Game<S, M, R>, s: RoomState<S, R>) =>
	s.phase === "playing" && s.game ? (def.nextTimer?.(s.game) ?? null) : null;

/** The single moment the room next needs to wake up, if any. */
export function nextWake<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
): number | null {
	const { state } = room;
	const times: number[] = [];
	const timer = gameTimer(def, state);
	if (timer !== null) times.push(timer);
	if (state.phase === "finished" && room.finishedAt !== null)
		times.push(room.finishedAt + FINISHED_TTL);
	if (room.emptySince !== null && state.phase !== "finished")
		times.push(room.emptySince + emptyTtl(state.phase));
	const current = currentPlayer(def, state);
	for (const seat of state.seats) {
		const presence = room.presence[seat.id];
		if (!presence || seat.away || isOut(def, state, seat.id)) continue;
		if (!presence.online) times.push(presence.since + AWAY_AFTER);
		else if (current === seat.id)
			times.push(Math.max(presence.lastActive, room.turnSince) + AWAY_AFTER);
	}
	return times.length ? Math.min(...times) : null;
}

/** What the alarm does for the game: let it act on its own if its time has come. */
export function wake<S, M, R>(
	def: Game<S, M, R>,
	room: Room<S, R>,
	ctx: Context,
): Room<S, R> {
	let next = room;
	const timer = gameTimer(def, room.state);
	const tick = def.tick;
	if (tick && timer !== null && ctx.now >= timer) {
		const result = advance(
			def,
			room,
			null,
			(s) => {
				s.game = unwrap(tick(playing(s), ctx));
			},
			ctx.now,
		);
		if (result.ok) next = result.room;
	}
	return next;
}
