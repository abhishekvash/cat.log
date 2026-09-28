import { useLayoutEffect, useState } from "react";
import { INK, STICKER } from "#/components/cats/palette";
import { cn } from "#/lib/utils";
import { useRollAge } from "./roll-clock";

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

function Die({ value }: { value: number }) {
	return (
		<svg
			viewBox="0 0 100 100"
			role="img"
			aria-label={`${value}`}
			className="size-10 drop-shadow-sticker"
		>
			<rect x="4" y="4" width="92" height="92" rx="22" fill={STICKER} />
			{PIPS[value]?.map(([cx, cy]) => (
				<circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill={INK} />
			))}
		</svg>
	);
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
	const rollAge = useRollAge();
	// Before paint, so a fresh roll never flashes its final faces first.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only a new roll restarts the tumble
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
