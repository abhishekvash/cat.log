import { CATS, type Cat } from "#/lib/cats";
import type { Seat } from "#/lib/multiplayer/types";
import { BASKET, HOME } from "./board";
import {
	type GameState,
	KITTENS,
	MAX_PLAYERS,
	MIN_PLAYERS,
	type Player,
	STATE_VERSION,
	type Turn,
} from "./types";

/**
 * Mewdo on one shared screen: the same rules, run in the browser and saved to
 * localStorage so a reload (or a sleepy iPad) picks up where it left off.
 */

const STORAGE_KEY = "mewdo:local";

export interface LocalPlayer {
	name: string;
	cat: Cat;
}

export interface LocalGame {
	/** Who's playing, in the order they were entered. */
	players: LocalPlayer[];
	/** Null while choosing players. */
	state: GameState | null;
	/** Counts games, so each new one starts with a fresh table. */
	round: number;
}

/** The shared-screen players as room seats, ids from 1. */
export const localSeats = (players: LocalPlayer[]): Seat[] =>
	players.map((p, i) => ({
		id: i + 1,
		name: p.name,
		cat: p.cat,
		connected: true,
		away: false,
	}));

export function loadLocal(): LocalGame {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const saved = JSON.parse(raw);
			if (saved?.version === STATE_VERSION && isLocalGame(saved))
				return {
					players: saved.players,
					state: saved.state,
					round: saved.round,
				};
		}
	} catch {
		// Corrupt or unavailable storage: start fresh.
	}
	return { players: [], state: null, round: 0 };
}

export function saveLocal(game: LocalGame) {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ version: STATE_VERSION, ...game }),
		);
	} catch {
		// Private mode / quota: the game still works, it just won't survive a reload.
	}
}

// ---------------------------------------------------------------- checking a save

// A save is only trusted once it looks exactly like a game this version makes:
// anything else (edited, truncated, from a bug) starts fresh instead of
// crashing the board on every reload.

type Loose = Record<string, unknown>;
const isObject = (x: unknown): x is Loose =>
	typeof x === "object" && x !== null && !Array.isArray(x);
const isCat = (x: unknown): x is Cat => CATS.includes(x as Cat);
const isInt = (x: unknown, min: number, max: number): x is number =>
	Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

function isLocalPlayer(x: unknown): x is LocalPlayer {
	return isObject(x) && typeof x.name === "string" && isCat(x.cat);
}

function isPlayer(x: unknown): x is Player {
	return (
		isObject(x) &&
		Number.isInteger(x.id) &&
		typeof x.name === "string" &&
		isCat(x.cat) &&
		isInt(x.corner, 0, 3) &&
		Array.isArray(x.kittens) &&
		x.kittens.length === KITTENS &&
		x.kittens.every((k) => isInt(k, BASKET, HOME)) &&
		(x.place === null || isInt(x.place, 1, MAX_PLAYERS)) &&
		typeof x.gone === "boolean"
	);
}

function isTurn(x: unknown, players: Player[]): x is Turn {
	return (
		isObject(x) &&
		players.some((p) => p.id === x.playerId) &&
		(x.phase === "roll" || x.phase === "move") &&
		(x.roll === null || isInt(x.roll, 1, 6)) &&
		isInt(x.sixes, 0, 2) &&
		Array.isArray(x.movable) &&
		x.movable.every((k) => isInt(k, 0, KITTENS - 1))
	);
}

function isGameState(x: unknown): x is GameState {
	if (!isObject(x)) return false;
	const { players } = x;
	if (
		!Array.isArray(players) ||
		players.length < MIN_PLAYERS ||
		players.length > MAX_PLAYERS ||
		!players.every(isPlayer)
	)
		return false;
	const turnOk =
		x.phase === "finished"
			? x.turn === null
			: x.phase === "playing" && isTurn(x.turn, players);
	return (
		turnOk &&
		Array.isArray(x.log) &&
		x.log.every(isLogEntry) &&
		(x.lastRoll === null || isLastRoll(x.lastRoll)) &&
		(x.lastMove === null || isLastMove(x.lastMove))
	);
}

const isLogEntry = (x: unknown) =>
	isObject(x) && Number.isInteger(x.id) && typeof x.text === "string";

const isLastRoll = (x: unknown) =>
	isObject(x) &&
	Number.isInteger(x.id) &&
	Number.isInteger(x.playerId) &&
	isInt(x.value, 1, 6);

const isBoop = (x: unknown) =>
	isObject(x) &&
	Number.isInteger(x.playerId) &&
	isInt(x.kitten, 0, KITTENS - 1) &&
	isInt(x.from, BASKET, HOME);

const isLastMove = (x: unknown) =>
	isObject(x) &&
	Number.isInteger(x.id) &&
	Number.isInteger(x.playerId) &&
	isInt(x.kitten, 0, KITTENS - 1) &&
	isInt(x.from, BASKET, HOME) &&
	isInt(x.to, BASKET, HOME) &&
	Array.isArray(x.booped) &&
	x.booped.every(isBoop);

export function isLocalGame(x: unknown): x is LocalGame {
	if (!isObject(x) || !isInt(x.round, 0, Number.MAX_SAFE_INTEGER)) return false;
	const { players } = x;
	if (
		!Array.isArray(players) ||
		players.length > MAX_PLAYERS ||
		!players.every(isLocalPlayer) ||
		new Set(players.map((p) => p.cat)).size !== players.length
	)
		return false;
	return x.state === null || isGameState(x.state);
}
