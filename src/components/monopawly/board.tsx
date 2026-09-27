import { StethoscopeIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { CatHead } from "#/components/mastermind/pins";
import {
	BOARD,
	groupColor,
	isOwnable,
	type Space,
	VET_INDEX,
} from "#/lib/monopawly/board";
import type { GameState, Player } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import { Fur } from "./fur";
import { Art, type ArtName, FishIcon } from "./tile-art";

type Side = "bottom" | "left" | "top" | "right" | "corner";

/** Soft hyphens so the longest words break cleanly on narrow tiles. */
const tileName = (name: string) =>
	name
		.replace("Windowsill", "Win\u00addow\u00adsill")
		.replace("Scratchpost", "Scratch\u00adpost")
		.replace("Fishmonger", "Fish\u00admonger");

/** Grid cell for a board index: GO bottom-right, then clockwise. */
function cell(index: number): { row: number; col: number; side: Side } {
	if (index === 0) return { row: 11, col: 11, side: "corner" };
	if (index < 10) return { row: 11, col: 11 - index, side: "bottom" };
	if (index === 10) return { row: 11, col: 1, side: "corner" };
	if (index < 20) return { row: 21 - index, col: 1, side: "left" };
	if (index === 20) return { row: 1, col: 1, side: "corner" };
	if (index < 30) return { row: 1, col: index - 19, side: "top" };
	if (index === 30) return { row: 1, col: 11, side: "corner" };
	return { row: index - 29, col: 11, side: "right" };
}

function artFor(space: Space): ArtName | null {
	switch (space.kind) {
		case "flap":
			return "flap";
		case "utility":
			return space.name.startsWith("Laser") ? "laser" : "catnip";
		case "zoomies":
			return "zoomies";
		case "treatJar":
			return "treatJar";
		case "tax":
			return space.name.startsWith("Groomer") ? "comb" : "bill";
		case "vet":
			return "vet";
		case "caught":
			return "caught";
		case "napSpot":
			return "nap";
		case "foodBowl":
			return "bowl";
		default:
			return null;
	}
}

/**
 * Tokens walk space by space to their new spot instead of teleporting, unless
 * the player prefers reduced motion or was sent somewhere (the Vet, a card).
 */
function useWalkingPositions(players: Player[]) {
	const [shown, setShown] = useState<Record<number, number>>(() =>
		Object.fromEntries(players.map((p) => [p.id, p.position])),
	);
	const target = useRef<Record<number, number>>({});
	target.current = Object.fromEntries(players.map((p) => [p.id, p.position]));
	const key = players.map((p) => `${p.id}:${p.position}`).join(",");

	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures every position change
	useEffect(() => {
		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const timer = window.setInterval(() => {
			setShown((current) => {
				let moving = false;
				const next = { ...current };
				for (const [id, to] of Object.entries(target.current)) {
					const from = current[Number(id)] ?? to;
					if (from === to) continue;
					const ahead = (to - from + BOARD.length) % BOARD.length;
					// Short hops forward walk; long jumps and backward moves teleport.
					next[Number(id)] =
						reduce || ahead > 12 ? to : (from + 1) % BOARD.length;
					moving ||= next[Number(id)] !== to;
				}
				if (!moving) window.clearInterval(timer);
				return next;
			});
		}, 140);
		return () => window.clearInterval(timer);
	}, [key]);
	return shown;
}

export function Board({
	state,
	selected,
	onSelect,
	children,
}: {
	state: GameState;
	selected: number | null;
	onSelect: (index: number) => void;
	children: ReactNode;
}) {
	const positions = useWalkingPositions(state.players);
	const current = state.turn?.playerId;

	return (
		<div
			className="grid size-full gap-px rounded-xl border border-border bg-border shadow-table"
			// minmax(0, …) so a tall centre panel scrolls instead of stretching the board.
			style={{
				gridTemplateColumns:
					"minmax(0,1.6fr) repeat(9, minmax(0,1fr)) minmax(0,1.6fr)",
				gridTemplateRows:
					"minmax(0,1.6fr) repeat(9, minmax(0,1fr)) minmax(0,1.6fr)",
			}}
		>
			{BOARD.map((space, index) => {
				const { row, col, side } = cell(index);
				return (
					<Tile
						// biome-ignore lint/suspicious/noArrayIndexKey: the board never reorders
						key={index}
						index={index}
						space={space}
						side={side}
						row={row}
						col={col}
						state={state}
						selected={selected === index}
						onSelect={() => onSelect(index)}
					/>
				);
			})}
			<div
				className="relative flex min-h-0 min-w-0 flex-col bg-card"
				style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}
			>
				{children}
			</div>
			{BOARD.map((_, index) => {
				const here = state.players.filter(
					(p) => !p.bankrupt && positions[p.id] === index,
				);
				if (here.length === 0) return null;
				return (
					<Tokens
						// biome-ignore lint/suspicious/noArrayIndexKey: the board never reorders
						key={index}
						index={index}
						players={here}
						current={current}
					/>
				);
			})}
		</div>
	);
}

/**
 * Tokens perch on a tile's outer edge, half over the board's rim, so they never
 * hide the street name, the owner's fur or its buildings.
 */
function Tokens({
	index,
	players,
	current,
}: {
	index: number;
	players: Player[];
	current: number | undefined;
}) {
	const { row, col, side } = cell(index);
	// The row sits on the outer edge; the stack leans most of its size past the rim.
	const place = {
		bottom: ["items-end justify-center", "translate-y-[80%]"],
		top: ["items-start justify-center", "-translate-y-[80%]"],
		left: ["items-center justify-start", "-translate-x-[80%]"],
		right: ["items-center justify-end", "translate-x-[80%]"],
		corner: {
			0: ["items-end justify-end", "translate-x-1/3 translate-y-1/3"],
			10: ["items-end justify-start", "-translate-x-1/3 translate-y-1/3"],
			20: ["items-start justify-start", "-translate-x-1/3 -translate-y-1/3"],
			30: ["items-start justify-end", "translate-x-1/3 -translate-y-1/3"],
		}[index] ?? ["", ""],
	}[side];
	const stacked = side === "left" || side === "right";
	return (
		<div
			aria-hidden="true"
			style={{ gridRow: row, gridColumn: col }}
			className={cn("pointer-events-none z-20 flex", place[0])}
		>
			<div
				className={cn(
					"flex",
					stacked ? "flex-col -space-y-2.5" : "-space-x-2.5",
					place[1],
				)}
			>
				{players.map((p) => (
					<span key={p.id} className="relative">
						<CatHead
							coat={p.cat}
							size="1.75rem"
							className={cn(
								"transition-transform motion-reduce:transition-none",
								p.id === current && "relative z-10 scale-125",
								!p.connected && "opacity-50",
							)}
						/>
						{p.atVet && index === VET_INDEX && (
							<StethoscopeIcon className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-card p-px text-primary" />
						)}
					</span>
				))}
			</div>
		</div>
	);
}

function Tile({
	index,
	space,
	side,
	row,
	col,
	state,
	selected,
	onSelect,
}: {
	index: number;
	space: Space;
	side: Side;
	row: number;
	col: number;
	state: GameState;
	selected: boolean;
	onSelect: () => void;
}) {
	const holding = state.holdings[index];
	const owner = holding && state.players.find((p) => p.id === holding.owner);
	const art = artFor(space);
	const upright = side === "bottom" || side === "top";
	const edge = side !== "corner";
	// The claim slot always sits on the edge facing the centre of the board.
	const direction = {
		bottom: "flex-col",
		top: "flex-col-reverse",
		left: "flex-row-reverse",
		right: "flex-row",
		corner: "flex-col",
	}[side];
	// A street group reads as one neighbourhood: its colour, very faintly.
	const tint =
		space.kind === "street"
			? `color-mix(in oklab, ${groupColor(space.group)} 26%, var(--card))`
			: undefined;

	// Once claimed, the price gives way to the owner's fur, with any buildings
	// riding on it. A Paw White seam keeps dark coats visible on the board.
	const price = owner ? (
		<span
			className={cn(
				"relative flex h-4 w-full max-w-14 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#fff4f8]/85",
				holding.mortgaged && "opacity-40",
			)}
		>
			<span className="absolute inset-0">
				<Fur cat={owner.cat} />
			</span>
			<span className="relative">
				<Buildings count={holding.buildings} />
			</span>
		</span>
	) : isOwnable(space) ? (
		<span>
			{space.price}
			<FishIcon />
		</span>
	) : space.kind === "tax" ? (
		<span>
			{space.amount}
			<FishIcon />
		</span>
	) : null;

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-label={owner ? `${space.name}, ${owner.name}'s` : space.name}
			aria-pressed={selected}
			style={{ gridRow: row, gridColumn: col, background: tint }}
			className={cn(
				"relative flex min-h-0 min-w-0 overflow-hidden bg-card text-center outline-none transition-[filter] hover:brightness-125 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/60",
				direction,
				selected && "z-10 ring-[3px] ring-primary",
				// The frame no longer clips (tokens overhang it), so corners round themselves.
				{
					0: "rounded-br-[13px]",
					10: "rounded-bl-[13px]",
					20: "rounded-tl-[13px]",
					30: "rounded-tr-[13px]",
				}[index],
			)}
		>
			<span
				className={cn(
					"flex min-h-0 min-w-0 flex-1 flex-col items-center px-1 py-1.5 text-[11px] leading-[1.2]",
					edge ? "justify-between gap-0.5" : "justify-center gap-1.5",
					holding?.mortgaged && "opacity-55",
				)}
			>
				<span
					lang="en"
					className={cn(
						"font-medium text-foreground [hyphens:auto] [overflow-wrap:break-word]",
						!edge && "order-2 text-xs",
					)}
				>
					{tileName(space.name)}
				</span>
				{art && (upright || !edge) && (
					<span
						className={cn(
							"flex min-h-0 items-center justify-center",
							edge ? "flex-1" : "order-1",
						)}
					>
						<Art name={art} className={edge ? "size-5" : "size-10"} />
					</span>
				)}
				{(price || (art && !upright && edge)) && (
					<span className="flex w-full items-center justify-center gap-1 text-muted-foreground">
						{art && !upright && edge && <Art name={art} className="size-5" />}
						{price}
					</span>
				)}
			</span>
		</button>
	);
}

/** Boxes as one sticker and a count, or a cat house, in a pill on the fur bar. */
function Buildings({ count }: { count: number }) {
	if (count === 0) return null;
	return (
		<span className="flex items-center gap-0.5 rounded-full bg-card/90 px-1 text-[11px] leading-none font-semibold text-foreground">
			{count === 5 ? (
				<Art name="catHouse" label="cat house" plain className="size-3.5" />
			) : (
				<>
					<Art name="box" plain label="boxes" className="size-3" />
					{count}
				</>
			)}
		</span>
	);
}
