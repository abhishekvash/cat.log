import { useEffect, useRef, useState } from "react";
import type { GameState, Progress } from "#/lib/mewdo/types";
import type { SeatId } from "#/lib/multiplayer/types";
import { prefersReducedMotion } from "#/lib/utils";
import { hopPath, type Point } from "./geometry";

/** How long a fresh roll tumbles before it lands. */
export const ROLL_MS = 600;
/** One square of a kitten's walk. */
export const HOP_MS = 190;
/** A booped kitten's tumble back to its basket. */
export const BOOP_MS = 620;

export interface Hop {
	playerId: SeatId;
	kitten: number;
	from: Progress;
	/** The squares it walks through; `step` is where it is now (-1: not off yet). */
	path: Point[];
	step: number;
	/** Kittens it boops, kept where they were until it lands. */
	booped: { playerId: SeatId; kitten: number; from: Progress }[];
}

export interface Motion {
	/** The game as it should look right now: behind the latest while moves play out. */
	state: GameState;
	/** A fresh roll is still tumbling. */
	rolling: boolean;
	hop: Hop | null;
	/** Kittens (`playerId:kitten`) tumbling back to their basket after a boop. */
	booping: ReadonlySet<string>;
	/** Something is still playing out: hold the next move until it's done. */
	busy: boolean;
}

export const kittenKey = (playerId: SeatId, kitten: number) =>
	`${playerId}:${kitten}`;

const NONE: ReadonlySet<string> = new Set();

/**
 * Plays each new game state in turn: the die tumbles, the kitten hops square
 * by square, anyone booped tumbles home, and only then does the next state
 * (an opponent's quick follow-up, say) start. Whatever was on the board when
 * this mounted shows still, so a reload or reconnect doesn't replay it.
 * Under reduced motion every state shows at once.
 */
export function useMotion(latest: GameState, view: number): Motion {
	const [shown, setShown] = useState(latest);
	const [rolling, setRolling] = useState(false);
	const [hop, setHop] = useState<Hop | null>(null);
	const [booping, setBooping] = useState<ReadonlySet<string>>(NONE);
	const [cue, setCue] = useState(0);
	const queue = useRef<GameState[]>([]);
	const playing = useRef(false);
	const shownRef = useRef(latest);
	const timers = useRef<number[]>([]);
	const viewRef = useRef(view);
	viewRef.current = view;

	// Timers outlive re-renders (new states queue up mid-hop); only unmounting stops them.
	useEffect(
		() => () => {
			for (const t of timers.current) window.clearTimeout(t);
		},
		[],
	);

	useEffect(() => {
		if (latest === shownRef.current) return;
		if (prefersReducedMotion()) {
			queue.current = [];
			shownRef.current = latest;
			setShown(latest);
			return;
		}
		queue.current.push(latest);
		setCue((c) => c + 1);
	}, [latest]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `cue` is the trigger to play the next queued state
	useEffect(() => {
		if (playing.current) return;
		const next = queue.current.shift();
		if (!next) return;
		const prev = shownRef.current;
		playing.current = true;
		shownRef.current = next;
		setShown(next);
		const later = (ms: number, fn: () => void) =>
			timers.current.push(window.setTimeout(fn, ms));

		let at = 0;
		if (next.lastRoll && next.lastRoll.id !== prev.lastRoll?.id) {
			setRolling(true);
			later(ROLL_MS, () => setRolling(false));
			at = ROLL_MS;
		}
		const move = next.lastMove;
		const mover = next.players.find((p) => p.id === move?.playerId);
		if (move && mover && move.id !== prev.lastMove?.id) {
			// Let the die all but land before the kitten sets off.
			at = Math.max(0, at - 120);
			const path = hopPath(
				mover.corner,
				move.from,
				move.to,
				move.kitten,
				viewRef.current,
			);
			const base: Hop = { ...move, path, step: -1 };
			setHop(base);
			path.forEach((_, step) => {
				later(at + step * HOP_MS, () => setHop({ ...base, step }));
			});
			at += path.length * HOP_MS;
			// Landing and the boop start together, in one render, so a booped
			// kitten goes straight from its square into the tumble.
			const keys = new Set(
				move.booped.map((b) => kittenKey(b.playerId, b.kitten)),
			);
			later(at, () => {
				setHop(null);
				if (keys.size > 0) setBooping(keys);
			});
			if (keys.size > 0) {
				at += BOOP_MS;
				later(at, () => setBooping(NONE));
			}
		}
		later(at, () => {
			playing.current = false;
			setCue((c) => c + 1);
		});
	}, [cue]);

	return {
		state: shown,
		rolling,
		hop,
		booping,
		busy: rolling || hop !== null || shown !== latest,
	};
}
