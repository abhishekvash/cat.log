import { CrownIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { CatHead } from "#/components/mastermind/pins";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { GameState, Player } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import { FishIcon } from "./tile-art";

export const byId = (state: GameState, id: number | null | undefined) =>
	state.players.find((p) => p.id === id);

export function Fish({
	amount,
	className,
}: {
	amount: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"tabular-nums",
				amount < 0 && "text-destructive",
				className,
			)}
		>
			{amount.toLocaleString("en")}
			<FishIcon />
		</span>
	);
}

export function PlayerChip({
	player,
	size = "1.5rem",
}: {
	player: Player;
	size?: string;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 font-display font-medium">
			<CatHead coat={player.cat} size={size} />
			{player.name}
		</span>
	);
}

/** The host's crown, named on hover. */
export function HostCrown() {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<CrownIcon className="size-3.5 text-primary" aria-label="host" />
			</TooltipTrigger>
			<TooltipContent>Host</TooltipContent>
		</Tooltip>
	);
}

/** Ticks while mounted, for countdowns against the server clock. */
export function useServerNow(offset: number, every = 100) {
	const [now, setNow] = useState(() => Date.now() + offset);
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now() + offset), every);
		return () => window.clearInterval(id);
	}, [offset, every]);
	return now;
}

const PIPS: Record<number, [number, number][]> = {
	1: [[50, 50]],
	2: [
		[28, 28],
		[72, 72],
	],
	3: [
		[26, 26],
		[50, 50],
		[74, 74],
	],
	4: [
		[28, 28],
		[72, 28],
		[28, 72],
		[72, 72],
	],
	5: [
		[26, 26],
		[74, 26],
		[50, 50],
		[26, 74],
		[74, 74],
	],
	6: [
		[28, 24],
		[72, 24],
		[28, 50],
		[72, 50],
		[28, 76],
		[72, 76],
	],
};

export function Die({ value }: { value: number }) {
	return (
		<svg
			viewBox="0 0 100 100"
			role="img"
			aria-label={`${value}`}
			className="size-10 drop-shadow-sticker"
		>
			<rect x="4" y="4" width="92" height="92" rx="22" fill="#fff4f8" />
			{PIPS[value]?.map(([cx, cy]) => (
				<circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="#2a1f26" />
			))}
		</svg>
	);
}

/** The last roll's log line, so a new roll is spotted even when the faces repeat. */
export function lastRollId(state: GameState) {
	for (let i = state.log.length - 1; i >= 0; i--)
		if (/ rolled \d and \d/.test(state.log[i].text)) return state.log[i].id;
	return undefined;
}

// When each roll was first seen, so the dice and the walking cats agree on how
// long ago it happened. Rolls from before the room loaded count as long ago,
// so arriving mid-game or reconnecting doesn't replay them.
let loadedRoll: number | undefined;
const rollSeenAt = new Map<number, number>();
export const markRollSeen = (rollId: number | undefined) => {
	loadedRoll = rollId;
};
/** Milliseconds since this roll first showed up here (Infinity if it's old). */
export function rollAge(rollId: number | undefined) {
	if (rollId === undefined || rollId === loadedRoll) return Infinity;
	if (!rollSeenAt.has(rollId)) rollSeenAt.set(rollId, performance.now());
	return performance.now() - (rollSeenAt.get(rollId) ?? 0);
}

/** Faces flicker until the dice land; the bounce to rest runs a bit longer. */
const LAND_MS = 480;
const REST_MS = 640;

/** The pair of dice. A fresh roll tumbles in, flicking through faces, then lands. */
export function RollingDice({
	dice,
	rollId,
}: {
	dice: [number, number];
	rollId: number | undefined;
}) {
	// Faces flicked through mid-roll; null once they land on the real roll.
	const [faces, setFaces] = useState<[number, number] | null>(null);
	const [tumbling, setTumbling] = useState(false);
	// Before paint, so a fresh roll never flashes its final faces first.
	useLayoutEffect(() => {
		const age = rollAge(rollId);
		if (age >= LAND_MS) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const face = () => 1 + Math.floor(Math.random() * 6);
		setTumbling(true);
		setFaces([face(), face()]);
		const flick = window.setInterval(() => setFaces([face(), face()]), 70);
		const land = window.setTimeout(() => {
			window.clearInterval(flick);
			setFaces(null);
		}, LAND_MS - age);
		const rest = window.setTimeout(() => setTumbling(false), REST_MS - age);
		return () => {
			window.clearInterval(flick);
			window.clearTimeout(land);
			window.clearTimeout(rest);
			setFaces(null);
			setTumbling(false);
		};
	}, [rollId]);
	const [a, b] = faces ?? dice;
	return (
		<div className="flex gap-3">
			<div key={`a${rollId}`} className={cn(tumbling && "dice-tumble")}>
				<Die value={a} />
			</div>
			<div key={`b${rollId}`} className={cn(tumbling && "dice-tumble-reverse")}>
				<Die value={b} />
			</div>
		</div>
	);
}
