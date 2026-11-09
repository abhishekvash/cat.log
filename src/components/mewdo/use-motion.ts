import { useLayoutEffect, useRef, useState } from "react";
import type { GameState, Progress } from "#/lib/mewdo/types";
import type { SeatId } from "#/lib/multiplayer/types";
import { prefersReducedMotion } from "#/lib/utils";
import { hopPath, type Point } from "./geometry";

/** How long a fresh roll tumbles before it lands. */
export const ROLL_MS = 600;
/** One square of a kitten's walk. */
export const HOP_MS = 190;

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
	/** A fresh roll is still tumbling. */
	rolling: boolean;
	hop: Hop | null;
	/** Something is still playing out: hold the next move until it's done. */
	busy: boolean;
}

/**
 * Plays the latest roll and move: the die tumbles, then the kitten hops square
 * by square. Whatever was on the board when this mounted shows still, so a
 * reload or reconnect doesn't replay it. Skipped under reduced motion.
 */
export function useMotion(state: GameState, view: number): Motion {
	const loaded = useRef({
		roll: state.lastRoll?.id,
		move: state.lastMove?.id,
	});
	const rollStarted = useRef(0);
	const [rolling, setRolling] = useState(false);
	const [hop, setHop] = useState<Hop | null>(null);

	const rollId = state.lastRoll?.id;
	useLayoutEffect(() => {
		if (rollId === undefined || rollId === loaded.current.roll) return;
		if (prefersReducedMotion()) return;
		rollStarted.current = performance.now();
		setRolling(true);
		const done = window.setTimeout(() => setRolling(false), ROLL_MS);
		return () => {
			window.clearTimeout(done);
			setRolling(false);
		};
	}, [rollId]);

	const move = state.lastMove;
	const moveId = move?.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: only a new move starts a hop
	useLayoutEffect(() => {
		if (!move || move.id === loaded.current.move) return;
		if (prefersReducedMotion()) return;
		const mover = state.players.find((p) => p.id === move.playerId);
		if (!mover) return;
		const path = hopPath(mover.corner, move.from, move.to, move.kitten, view);
		const base: Hop = { ...move, path, step: -1 };
		setHop(base);
		// Let the die land first if this move came straight off a roll.
		const wait = Math.max(
			0,
			ROLL_MS - 120 - (performance.now() - rollStarted.current),
		);
		const timers = path.map((_, step) =>
			window.setTimeout(() => setHop({ ...base, step }), wait + step * HOP_MS),
		);
		timers.push(
			window.setTimeout(() => setHop(null), wait + path.length * HOP_MS),
		);
		return () => {
			for (const t of timers) window.clearTimeout(t);
			setHop(null);
		};
	}, [moveId]);

	return { rolling, hop, busy: rolling || hop !== null };
}
