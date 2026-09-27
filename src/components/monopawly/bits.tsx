import { CrownIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
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
