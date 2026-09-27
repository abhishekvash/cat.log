import { ArrowRightIcon, StethoscopeIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { CatHead } from "#/components/mastermind/pins";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	BOARD,
	groupColor,
	isOwnable,
	type Space,
	VET_INDEX,
} from "#/lib/monopawly/board";
import type { GameState, Player } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import { lastRollId, rollAge } from "./bits";
import { Fur } from "./fur";
import { Art, type ArtName, FishIcon } from "./tile-art";

type Side = "bottom" | "left" | "top" | "right" | "corner";

/** Soft hyphens so the longest words break cleanly on narrow tiles. */
const tileName = (name: string) =>
	name
		.replace("Windowsill", "Win\u00addow\u00adsill")
		.replace("Scratchpost", "Scratch\u00adpost")
		.replace("Fishmonger", "Fish\u00admonger");

/**
 * Grid cell for a board index: the Food Bowl top-left, then clockwise, so play
 * reads left to right along the top like a line of text.
 */
function cell(index: number): { row: number; col: number; side: Side } {
	if (index === 0) return { row: 1, col: 1, side: "corner" };
	if (index < 10) return { row: 1, col: index + 1, side: "top" };
	if (index === 10) return { row: 1, col: 11, side: "corner" };
	if (index < 20) return { row: index - 9, col: 11, side: "right" };
	if (index === 20) return { row: 11, col: 11, side: "corner" };
	if (index < 30) return { row: 11, col: 31 - index, side: "bottom" };
	if (index === 30) return { row: 11, col: 1, side: "corner" };
	return { row: 41 - index, col: 1, side: "left" };
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

/** How long a fresh roll's dice take to land (see RollingDice), before cats walk. */
const DICE_SETTLE_MS = 650;
/** One tile of walking. The glide and the hop both fit inside it. */
const STEP_MS = 200;

/**
 * Tokens walk space by space to their new spot instead of teleporting, unless
 * the player prefers reduced motion or was sent somewhere (the Vet, a card).
 * A move that comes with a new roll waits for the dice to land first.
 */
function useWalkingPositions(players: Player[], rollId: number | undefined) {
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
		// A move that came with this roll waits for the dice to land.
		const wait = reduce ? 0 : Math.max(0, DICE_SETTLE_MS - rollAge(rollId));
		let timer: number | undefined;
		const step = () =>
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
		const start = window.setTimeout(() => {
			step();
			timer = window.setInterval(step, STEP_MS);
		}, wait);
		return () => {
			window.clearTimeout(start);
			window.clearInterval(timer);
		};
	}, [key]);
	return shown;
}

// Where each grid line falls, as a share of the board: 1.6-wide corners and
// nine 1-wide tiles per side (see the grid template below).
const TRACKS = [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6];
const TOTAL = TRACKS.reduce((a, b) => a + b, 0);
/** The centre of grid track `n` (1-based), as a percentage of the board. */
const trackCentre = (n: number) =>
	((TRACKS.slice(0, n - 1).reduce((a, b) => a + b, 0) + TRACKS[n - 1] / 2) /
		TOTAL) *
	100;

export function Board({
	state,
	selected,
	onSelect,
	card,
	children,
}: {
	state: GameState;
	/** The space whose card is open, if any. */
	selected: number | null;
	onSelect: (index: number | null) => void;
	/** The card shown in a popover beside the open space. */
	card: (index: number) => ReactNode;
	children: ReactNode;
}) {
	const positions = useWalkingPositions(state.players, lastRollId(state));
	const current = state.turn?.playerId;

	return (
		<div
			className="relative grid size-full gap-px rounded-xl border border-border bg-border shadow-table"
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
						open={selected === index}
						onOpenChange={(open) => onSelect(open ? index : null)}
						card={selected === index ? card(index) : null}
					/>
				);
			})}
			<div
				className="relative flex min-h-0 min-w-0 flex-col bg-card"
				style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}
			>
				{children}
			</div>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-20"
			>
				{state.players
					.filter((p) => !p.bankrupt)
					.map((p) => {
						const at = positions[p.id] ?? p.position;
						const here = state.players.filter(
							(q) => !q.bankrupt && (positions[q.id] ?? q.position) === at,
						);
						return (
							<Token
								key={p.id}
								player={p}
								index={at}
								slot={here.indexOf(p)}
								count={here.length}
								current={p.id === current}
							/>
						);
					})}
			</div>
		</div>
	);
}

/**
 * One cat on the board. It perches on its tile's outer edge, mostly past the
 * rim, so it never hides a name, fur or buildings, and glides between tiles
 * with a little hop on each one. Cats sharing a tile stand side by side.
 */
function Token({
	player,
	index,
	slot,
	count,
	current,
}: {
	player: Player;
	index: number;
	slot: number;
	count: number;
	current: boolean;
}) {
	const { row, col, side } = cell(index);
	const x = col === 1 ? 0 : col === 11 ? 100 : trackCentre(col);
	const y = row === 1 ? 0 : row === 11 ? 100 : trackCentre(row);
	// Lean outward from the rim; corners sit right on their point.
	const lean = {
		top: "-50% -80%",
		bottom: "-50% -20%",
		left: "-80% -50%",
		right: "-20% -50%",
		corner: "-50% -50%",
	}[side];
	// Spread a crowd along the edge, overlapping a little.
	const spread = (slot - (count - 1) / 2) * 1.1;
	const alongY = side === "left" || side === "right";
	return (
		<div
			className={cn(
				"absolute transition-[left,top] ease-in-out motion-reduce:transition-none",
				current && "z-10",
			)}
			style={{
				left: `calc(${x}% + ${alongY ? 0 : spread}rem)`,
				top: `calc(${y}% + ${alongY ? spread : 0}rem)`,
				translate: lean,
				transitionDuration: `${STEP_MS - 20}ms`,
			}}
		>
			{/* Keyed by tile, so the hop replays on every step. */}
			<span key={index} className="token-hop relative block">
				<CatHead
					coat={player.cat}
					size="1.75rem"
					className={cn(
						"transition-transform motion-reduce:transition-none",
						current && "scale-125",
						!player.connected && "opacity-50",
					)}
				/>
				{player.atVet && index === VET_INDEX && (
					<StethoscopeIcon className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-card p-px text-primary" />
				)}
			</span>
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
	open,
	onOpenChange,
	card,
}: {
	index: number;
	space: Space;
	side: Side;
	row: number;
	col: number;
	state: GameState;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	card: ReactNode;
}) {
	const holding = state.holdings[index];
	const owner = holding && state.players.find((p) => p.id === holding.owner);
	const art = artFor(space);
	const edge = side !== "corner";
	// Every edge tile is the same card: name, art, then price or fur. The side
	// lanes lay it out upright and turn it a quarter to face the centre, like a
	// printed board; the top and bottom rows stay upright.
	const turned = side === "left" || side === "right";
	// Cards open toward the middle of the board.
	const toward = (
		{
			top: "bottom",
			bottom: "top",
			left: "right",
			right: "left",
			corner: index < 20 ? "bottom" : "top",
		} as const
	)[side];
	const direction = {
		bottom: "flex-col",
		top: "flex-col",
		left: "[container-type:size]",
		right: "[container-type:size]",
		corner: "flex-col",
	}[side];
	// A street group reads as one neighbourhood: its colour, very faintly.
	const tint =
		space.kind === "street"
			? `color-mix(in oklab, ${groupColor(space.group)} 26%, var(--card))`
			: undefined;

	// Once claimed, the price gives way to a band of the owner's fur across the
	// card's bottom edge, with any buildings riding on it. The negative margins
	// cancel the card's padding so the band runs edge to edge.
	const price = owner ? (
		<span
			className={cn(
				"relative -mx-1 -mb-1.5 flex h-5 w-[calc(100%+0.5rem)] shrink-0 items-center justify-center overflow-hidden",
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
		<span className="whitespace-nowrap">
			{space.price}
			<FishIcon />
		</span>
	) : space.kind === "tax" ? (
		<span className="whitespace-nowrap">
			{space.amount}
			<FishIcon />
		</span>
	) : null;

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={owner ? `${space.name}, ${owner.name}'s` : space.name}
					style={{ gridRow: row, gridColumn: col, background: tint }}
					className={cn(
						"relative flex min-h-0 min-w-0 overflow-hidden bg-card text-center outline-none transition-[filter] hover:brightness-125 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/60",
						direction,
						open && "z-10 ring-[3px] ring-primary",
						// The frame no longer clips (tokens overhang it), so corners round themselves.
						{
							0: "rounded-tl-[13px]",
							10: "rounded-tr-[13px]",
							20: "rounded-br-[13px]",
							30: "rounded-bl-[13px]",
						}[index],
					)}
				>
					<span
						className={cn(
							"flex min-h-0 min-w-0 flex-1 flex-col items-center px-1 py-1.5 text-[11px] leading-[1.2]",
							edge ? "justify-between gap-0.5" : "justify-center gap-1.5",
							// Sized to the tile's height and width swapped, then turned in place.
							turned &&
								"absolute top-1/2 left-1/2 h-[100cqw] w-[100cqh] -translate-x-1/2 -translate-y-1/2",
							side === "left" && "rotate-90",
							side === "right" && "-rotate-90",
							holding?.mortgaged && "opacity-55",
						)}
					>
						<span
							lang="en"
							className={cn(
								"font-semibold text-foreground [hyphens:auto] [overflow-wrap:break-word]",
								!edge && "order-2 text-xs",
							)}
						>
							{tileName(space.name)}
						</span>
						{art && (
							<span
								className={cn(
									"flex min-h-0 items-center justify-center",
									edge ? "flex-1" : "order-1",
								)}
							>
								<Art name={art} className={edge ? "size-5" : "size-10"} />
							</span>
						)}
						{index === 0 && (
							<span className="order-3 flex items-center gap-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase">
								Start
								<ArrowRightIcon className="size-3" />
							</span>
						)}
						{price && (
							<span className="flex w-full items-center justify-center font-semibold text-muted-foreground">
								{price}
							</span>
						)}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent side={toward} collisionPadding={8} className="w-80">
				{card}
			</PopoverContent>
		</Popover>
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
