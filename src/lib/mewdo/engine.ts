import {
	attempt,
	type Context,
	type Result,
	reject,
	type Seat,
	type SeatId,
} from "#/lib/multiplayer/types";
import { type Rng, rollDie, shuffle } from "#/lib/rng";
import {
	advance,
	BASKET,
	CORNERS_FOR,
	HOME,
	isSafe,
	LEAVE_ROLL,
	ordinal,
	trackSquare,
} from "./board";
import {
	type GameState,
	KITTENS,
	LOG_LIMIT,
	MAX_PLAYERS,
	MIN_PLAYERS,
	type Move,
	type Player,
	type Turn,
	type TurnPhase,
} from "./types";

/**
 * Mewdo's rules. Seats, the lobby and hosting belong to the shared room
 * (lib/multiplayer), and the shared-screen game runs the same reducer locally.
 *
 * A 6 lets a kitten out of its basket and earns another roll; three 6s in a
 * row and the turn is over. Landing on another cat's kitten boops it back to
 * its basket (never on a cushion) and earns another roll. Kittens need the
 * exact roll to reach the food bowl. Play goes on until every place is decided.
 */

/** Deals a fresh game: the seated cats take corners in a shuffled order. */
export function start(seats: readonly Seat[], ctx: Context): GameState {
	if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS)
		throw new Error(`Mewdo needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
	const corners = CORNERS_FOR[seats.length];
	const players: Player[] = shuffle(seats, ctx.rng).map((seat, i) => ({
		id: seat.id,
		name: seat.name,
		cat: seat.cat,
		corner: corners[i],
		kittens: Array.from({ length: KITTENS }, () => BASKET),
		place: null,
		gone: false,
	}));
	const s: GameState = {
		phase: "playing",
		players,
		turn: freshTurn(players[0].id),
		lastRoll: null,
		lastMove: null,
		log: [],
	};
	log(s, `The game begins! ${players[0].name} goes first.`);
	return s;
}

/** Applies one player's move. Never mutates `state`; a rejected move changes nothing. */
export function reduce(
	state: GameState,
	actor: SeatId,
	move: Move,
	ctx: Context,
): Result<GameState> {
	return attempt(state, (s) => {
		const me = player(s, actor);
		switch (move.type) {
			case "roll":
				return roll(s, myTurn(s, me, "roll"), ctx.rng);
			case "move":
				return chooseKitten(s, myTurn(s, me, "move"), move.kitten);
			default:
				reject("That's not a Mewdo move.");
		}
	});
}

/** The host moves on past the current player. */
export function skipTurn(state: GameState): Result<GameState> {
	return attempt(state, (s) => {
		const turn = turnOf(s);
		log(s, `${player(s, turn.playerId).name}'s turn was skipped.`);
		nextTurn(s);
	});
}

/** A player is taken out (or leaves): their kittens go and they're unplaced. */
export function removePlayer(
	state: GameState,
	id: SeatId,
	_ctx: Context,
	reason: "removed" | "left" = "removed",
): Result<GameState> {
	return attempt(state, (s) => {
		const target = player(s, id);
		if (s.phase !== "playing" || !stillPlaying(target))
			reject(`${target.name} isn't playing.`);
		target.gone = true;
		target.kittens.fill(BASKET);
		log(
			s,
			reason === "left"
				? `${target.name} left the game.`
				: `${target.name} was removed from the game.`,
		);
		if (s.turn?.playerId === id) nextTurn(s);
		checkFinished(s);
	});
}

/** Still racing: not home with every kitten, and hasn't left. */
export const stillPlaying = (p: Player) => !p.gone && p.place === null;

/**
 * The kittens that can take `roll`, one per square: kittens sharing a square
 * would all move the same way, so only the first of them is offered.
 */
export function movableKittens(p: Player, roll: number): number[] {
	const seen = new Set<number>();
	const out: number[] = [];
	p.kittens.forEach((at, i) => {
		if (advance(at, roll) === null || seen.has(at)) return;
		seen.add(at);
		out.push(i);
	});
	return out;
}

// ---------------------------------------------------------------- turns

function roll(s: GameState, p: Player, rng: Rng) {
	const turn = turnOf(s);
	const value = rollDie(rng);
	s.lastRoll = { id: (s.lastRoll?.id ?? 0) + 1, playerId: p.id, value };
	turn.sixes = value === LEAVE_ROLL ? turn.sixes + 1 : 0;
	if (turn.sixes === 3) {
		log(s, `${p.name} rolled three 6s in a row and has to take a nap.`);
		return nextTurn(s);
	}

	const options = movableKittens(p, value);
	if (options.length === 0) {
		log(s, `${p.name} rolled a ${value}. No kitten can move.`);
		if (value === LEAVE_ROLL) return rollAgain(turn);
		return nextTurn(s);
	}
	// One real choice is no choice: move it for them.
	if (options.length === 1) return moveKitten(s, p, options[0], value);
	turn.phase = "move";
	turn.roll = value;
	turn.movable = options;
}

function chooseKitten(s: GameState, p: Player, kitten: number) {
	const turn = turnOf(s);
	const value = turn.roll;
	if (value === null) reject("Roll the die first.");
	// Moves arrive over the wire, so check it's really one of their kittens.
	if (!Number.isInteger(kitten) || kitten < 0 || kitten >= KITTENS)
		reject("That kitten isn't in this game.");
	// Any kitten on an offered square will do, not just the first one there.
	const at = p.kittens[kitten];
	if (!turn.movable.some((k) => p.kittens[k] === at))
		reject("That kitten can't move that far.");
	moveKitten(s, p, kitten, value);
}

function moveKitten(s: GameState, p: Player, kitten: number, value: number) {
	const turn = turnOf(s);
	const from = p.kittens[kitten];
	const to = advance(from, value);
	if (to === null) reject("That kitten can't move that far.");
	p.kittens[kitten] = to;

	const booped = boopAt(s, p, to);
	s.lastMove = {
		id: (s.lastMove?.id ?? 0) + 1,
		playerId: p.id,
		kitten,
		from,
		to,
		booped,
	};

	if (from === BASKET) log(s, `${p.name} rolled a 6. A kitten hops out!`);
	else if (to === HOME)
		log(s, `${p.name} rolled a ${value}. A kitten reaches the food bowl!`);
	else log(s, `${p.name} rolled a ${value}.`);
	for (const b of booped)
		log(s, `${p.name} booped ${player(s, b.playerId).name}'s kitten home!`);

	if (p.kittens.every((k) => k === HOME)) {
		p.place = placesTaken(s) + 1;
		log(s, `${p.name} brought every kitten home: ${ordinal(p.place)} place!`);
		nextTurn(s);
		return checkFinished(s);
	}
	if (value === LEAVE_ROLL || booped.length > 0) {
		if (value !== LEAVE_ROLL) turn.sixes = 0;
		return rollAgain(turn);
	}
	nextTurn(s);
}

/** Sends every other cat's kitten on the square `p` just landed on back home. */
function boopAt(s: GameState, p: Player, to: number) {
	const square = trackSquare(p.corner, to);
	const booped: NonNullable<GameState["lastMove"]>["booped"] = [];
	if (square === null || isSafe(square)) return booped;
	for (const other of s.players) {
		if (other.id === p.id || !stillPlaying(other)) continue;
		other.kittens.forEach((at, kitten) => {
			if (trackSquare(other.corner, at) !== square) return;
			other.kittens[kitten] = BASKET;
			booped.push({ playerId: other.id, kitten, from: at });
		});
	}
	return booped;
}

function rollAgain(turn: Turn) {
	turn.phase = "roll";
	turn.roll = null;
	turn.movable = [];
}

/** Hands the turn clockwise to the next cat still racing. */
function nextTurn(s: GameState) {
	const turn = turnOf(s);
	const order = s.players;
	const at = order.findIndex((p) => p.id === turn.playerId);
	for (let step = 1; step <= order.length; step++) {
		const next = order[(at + step) % order.length];
		if (stillPlaying(next)) {
			s.turn = freshTurn(next.id);
			return;
		}
	}
	s.turn = null;
}

/** With one cat left racing, they take the last place and the game is over. */
function checkFinished(s: GameState) {
	const racing = s.players.filter(stillPlaying);
	if (racing.length > 1) return;
	const last = racing[0];
	if (last) {
		last.place = placesTaken(s) + 1;
		log(s, `${last.name} comes in ${ordinal(last.place)}.`);
	}
	s.phase = "finished";
	s.turn = null;
	log(s, "Every place is decided. Good game!");
}

// ---------------------------------------------------------------- helpers

const freshTurn = (playerId: SeatId): Turn => ({
	playerId,
	phase: "roll",
	roll: null,
	sixes: 0,
	movable: [],
});

const placesTaken = (s: GameState) =>
	s.players.filter((p) => p.place !== null).length;

function player(s: GameState, id: SeatId) {
	const p = s.players.find((x) => x.id === id);
	if (!p) reject("That player isn't in this game.");
	return p;
}

function turnOf(s: GameState) {
	if (s.phase !== "playing" || !s.turn) reject("The game isn't running.");
	return s.turn;
}

function myTurn(s: GameState, me: Player, phase: TurnPhase) {
	const turn = turnOf(s);
	if (!stillPlaying(me)) reject("You're not racing any more.");
	if (turn.playerId !== me.id) reject("It's not your turn.");
	if (turn.phase !== phase)
		reject(phase === "roll" ? "Pick a kitten to move first." : "Roll first.");
	return me;
}

function log(s: GameState, text: string) {
	const id = (s.log.at(-1)?.id ?? 0) + 1;
	s.log.push({ id, text });
	if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}
