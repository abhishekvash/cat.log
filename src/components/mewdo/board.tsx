import type { CSSProperties } from "react";
import { CatHead, Paw } from "#/components/cats/cat-face";
import { INK, STICKER } from "#/components/cats/palette";
import {
	advance,
	BASKET,
	HOME,
	isSafe,
	LAST_TRACK,
	ordinal,
	TRACK,
} from "#/lib/mewdo/board";
import type { Corner, GameState, Player, Progress } from "#/lib/mewdo/types";
import type { SeatId } from "#/lib/multiplayer/types";
import { cn } from "#/lib/utils";
import {
	cornerParts,
	GRID,
	kittenPoint,
	loopPoint,
	type Point,
} from "./geometry";
import { tintOf } from "./palette";
import { kittenKey, type Motion } from "./use-motion";

const SQUARE = "oklch(0.31 0.045 305)";
const SEAM = "oklch(0.36 0.05 310)";
const RAISED = "oklch(0.25 0.04 305)";
const EMPTY_YARD = "oklch(0.28 0.03 305)";

/** A corner's tint mixed down toward the board, `amount` percent of it. */
const tinted = (corner: Corner, amount: number) =>
	`color-mix(in oklab, ${tintOf(corner)} ${amount}%, ${RAISED})`;

/** Grid units to a percentage of the board. */
const pct = (units: number) => `${(units / GRID) * 100}%`;

/** The loop square a corner starts on. */
const startSquare = (corner: Corner) => corner * (TRACK / 4);

export interface Pick {
	/** Kittens (by index) the player at the table can move right now. */
	kittens: Set<number>;
	roll: number;
	onPick: (kitten: number) => void;
}

/**
 * The Mewdo board: a loop of squares round four yards, with a home lane up
 * to the food bowl in the middle for each corner. `view` turns the board so
 * the viewer's corner is at the bottom left. When `pick` is given, the
 * current player's movable kittens (and where they'd land) can be tapped.
 */
export function Board({
	state,
	view,
	motion,
	pick,
	current,
}: {
	state: GameState;
	view: number;
	motion: Motion;
	pick: (Pick & { player: Player }) | null;
	/** Whose turn to show: the roller, until their roll has played out. */
	current: SeatId | undefined;
}) {
	const seated = new Map(state.players.map((p) => [p.corner, p]));
	return (
		<section
			className="@container relative aspect-square w-full select-none rounded-[14px] border bg-card shadow-sm [-webkit-touch-callout:none]"
			aria-label="Mewdo board"
		>
			<svg
				viewBox={`0 0 ${GRID} ${GRID}`}
				className="absolute inset-0 size-full"
				aria-hidden="true"
			>
				{([0, 1, 2, 3] as Corner[]).map((corner) => (
					<CornerArt
						key={corner}
						corner={corner}
						view={view}
						seated={seated.has(corner)}
						current={
							current !== undefined && seated.get(corner)?.id === current
						}
					/>
				))}
				{Array.from({ length: TRACK }, (_, square) => (
					<LoopSquare
						// biome-ignore lint/suspicious/noArrayIndexKey: squares are fixed
						key={square}
						square={square}
						view={view}
						seated={seated}
					/>
				))}
				<FoodBowl />
				{pick && <Landings pick={pick} view={view} />}
			</svg>

			{state.players.map((p) => (
				<YardLabel
					key={p.id}
					player={p}
					view={view}
					current={p.id === current}
				/>
			))}

			<Kittens state={state} view={view} motion={motion} pick={pick} />
		</section>
	);
}

function CornerArt({
	corner,
	view,
	seated,
	current,
}: {
	corner: Corner;
	view: number;
	seated: boolean;
	current: boolean;
}) {
	const parts = cornerParts(corner, view);
	const [a, b] = parts.yard;
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	const fill = (amount: number) =>
		seated ? tinted(corner, amount) : EMPTY_YARD;
	return (
		<g>
			<rect
				x={x + 0.15}
				y={y + 0.15}
				width={5.7}
				height={5.7}
				rx={0.7}
				style={{ fill: fill(38) }}
				stroke={current ? tintOf(corner) : "none"}
				strokeWidth={current ? 0.12 : 0}
			/>
			{/* The basket: a soft round bed the kittens wait in. */}
			<rect
				x={x + 0.9}
				y={y + 0.9}
				width={4.2}
				height={4.2}
				rx={1.2}
				style={{ fill: RAISED }}
				opacity={0.9}
			/>
			{parts.basketSpots.map((spot) => (
				<circle
					key={`${spot.x}-${spot.y}`}
					cx={spot.x}
					cy={spot.y}
					r={0.62}
					style={{ fill: fill(30) }}
				/>
			))}
			{parts.lane.map((spot) => (
				<Cell
					key={`${spot.x}-${spot.y}`}
					at={spot}
					fill={seated ? tinted(corner, 70) : SQUARE}
				/>
			))}
			<polygon
				points={parts.bowl.map((p) => `${p.x},${p.y}`).join(" ")}
				style={{ fill: seated ? tinted(corner, 75) : SQUARE }}
				stroke={SEAM}
				strokeWidth={0.04}
			/>
		</g>
	);
}

function Cell({ at, fill }: { at: Point; fill: string }) {
	return (
		<rect
			x={at.x - 0.5 + 0.04}
			y={at.y - 0.5 + 0.04}
			width={0.92}
			height={0.92}
			rx={0.16}
			style={{ fill }}
			stroke={SEAM}
			strokeWidth={0.03}
		/>
	);
}

function LoopSquare({
	square,
	view,
	seated,
}: {
	square: number;
	view: number;
	seated: Map<Corner, Player>;
}) {
	const at = loopPoint(square, view);
	const startOf = ([0, 1, 2, 3] as Corner[]).find(
		(c) => startSquare(c) === square,
	);
	const fill =
		startOf !== undefined && seated.has(startOf) ? tinted(startOf, 75) : SQUARE;
	return (
		<g>
			<Cell at={at} fill={fill} />
			{isSafe(square) && (
				<g transform={`translate(${at.x - 0.33} ${at.y - 0.33}) scale(0.0066)`}>
					<Paw fill={STICKER} opacity={startOf === undefined ? 0.4 : 0.55} />
				</g>
			)}
		</g>
	);
}

/** The food bowl in the middle, where every kitten is headed. */
function FoodBowl() {
	const m = GRID / 2;
	return (
		<g>
			<ellipse
				cx={m}
				cy={m + 0.1}
				rx={0.56}
				ry={0.34}
				fill={STICKER}
				stroke={INK}
				strokeWidth={0.06}
			/>
			<ellipse cx={m} cy={m - 0.04} rx={0.42} ry={0.14} fill="#f4a259" />
		</g>
	);
}

/** Soft rings where each movable kitten would land, tappable too. */
function Landings({
	pick,
	view,
}: {
	pick: Pick & { player: Player };
	view: number;
}) {
	const { player } = pick;
	return (
		<g>
			{[...pick.kittens].map((k) => {
				const to = advance(player.kittens[k], pick.roll);
				if (to === null) return null;
				const at = kittenPoint(player.corner, to, k, view);
				return (
					<circle
						key={k}
						cx={at.x}
						cy={at.y}
						r={0.36}
						fill="none"
						stroke={tintOf(player.corner)}
						strokeWidth={0.08}
						strokeDasharray="0.18 0.12"
						className="landing-ring"
					/>
				);
			})}
		</g>
	);
}

function YardLabel({
	player,
	view,
	current,
}: {
	player: Player;
	view: number;
	current: boolean;
}) {
	const [a, b] = cornerParts(player.corner, view).yard;
	const x = (a.x + b.x) / 2;
	const y = (a.y + b.y) / 2;
	return (
		<div
			className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
			style={{ left: pct(x), top: pct(y), width: pct(4) }}
		>
			<span
				className={cn(
					"max-w-full truncate rounded-full px-1.5 font-display text-[clamp(0.6rem,1.6cqw,0.85rem)] leading-tight font-semibold",
					current ? "bg-sticker text-primary-foreground" : "text-foreground/85",
					player.gone && "line-through opacity-60",
				)}
			>
				{player.name}
			</span>
			{player.place !== null && (
				<span className="font-display text-[clamp(0.6rem,1.5cqw,0.8rem)] font-semibold text-primary">
					{ordinal(player.place)}
				</span>
			)}
		</div>
	);
}

interface Placed {
	key: string;
	player: Player;
	kitten: number;
	point: Point;
	/** On its way (hopping), or bounced back home after a boop. */
	motion: "hop" | "boop" | null;
	step: number;
	small: boolean;
}

function Kittens({
	state,
	view,
	motion,
	pick,
}: {
	state: GameState;
	view: number;
	motion: Motion;
	pick: (Pick & { player: Player }) | null;
}) {
	const { hop } = motion;
	const placed: Placed[] = [];
	for (const player of state.players) {
		if (player.gone) continue;
		player.kittens.forEach((progress, kitten) => {
			let point = kittenPoint(player.corner, progress, kitten, view);
			let move: Placed["motion"] = null;
			let step = 0;
			if (hop?.playerId === player.id && hop.kitten === kitten) {
				move = "hop";
				step = hop.step;
				point =
					hop.step < 0
						? kittenPoint(player.corner, hop.from, kitten, view)
						: hop.path[hop.step];
			}
			const booped = hop?.booped.find(
				(b) => b.playerId === player.id && b.kitten === kitten,
			);
			if (booped) point = kittenPoint(player.corner, booped.from, kitten, view);
			else if (motion.booping.has(kittenKey(player.id, kitten))) move = "boop";
			placed.push({
				key: kittenKey(player.id, kitten),
				player,
				kitten,
				point,
				motion: move,
				step,
				small: progress === HOME,
			});
		});
	}

	// Kittens sharing a square huddle up, a little smaller.
	const groups = new Map<string, Placed[]>();
	for (const k of placed) {
		const id = `${k.point.x.toFixed(2)},${k.point.y.toFixed(2)}`;
		groups.set(id, [...(groups.get(id) ?? []), k]);
	}
	const offsets = new Map<string, { dx: number; dy: number; scale: number }>();
	for (const group of groups.values()) {
		if (group.length < 2) continue;
		group.forEach((k, i) => {
			const angle = (i / group.length) * Math.PI * 2 - Math.PI / 4;
			offsets.set(k.key, {
				dx: Math.cos(angle) * 0.24,
				dy: Math.sin(angle) * 0.24,
				scale: 0.68,
			});
		});
	}

	const pickable = (p: Player, kitten: number) => {
		if (!pick || pick.player.id !== p.id) return false;
		const at = p.kittens[kitten];
		return [...pick.kittens].some((k) => p.kittens[k] === at);
	};

	return (
		<>
			{placed.map((k) => {
				const off = offsets.get(k.key) ?? { dx: 0, dy: 0, scale: 1 };
				const size = (k.small ? 0.62 : 0.88) * off.scale;
				const canPick = pickable(k.player, k.kitten);
				const style: CSSProperties = {
					left: pct(k.point.x + off.dx),
					top: pct(k.point.y + off.dy),
					width: pct(size),
					height: pct(size),
					"--corner": tintOf(k.player.corner),
				} as CSSProperties;
				const face = (
					<span
						key={k.motion === "hop" ? `hop${k.step}` : "still"}
						className={cn(
							"block size-full rounded-full border-[0.18em] border-(--corner) bg-(--corner) p-[6%] shadow-sm",
							k.motion === "hop" && k.step >= 0 && "token-hop",
							k.motion === "boop" && "kitten-tumble",
							canPick && "kitten-ready",
						)}
					>
						<CatHead cat={k.player.cat} size="100%" />
					</span>
				);
				const where = describe(k.player.kittens[k.kitten]);
				return canPick && pick ? (
					<button
						key={k.key}
						type="button"
						className="kitten absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
						style={style}
						aria-label={`Move ${k.player.name}'s kitten ${where} by ${pick.roll}`}
						onClick={() => pick.onPick(k.kitten)}
					>
						{/* A finger-sized target however small the kitten is drawn
						    (huddled kittens shrink), without reaching the next square. */}
						<span
							className="absolute rounded-full"
							style={{ inset: hitInset(size) }}
						/>
						{face}
					</button>
				) : (
					<span
						key={k.key}
						role="img"
						aria-label={`${k.player.name}'s kitten, ${where}`}
						className={cn(
							"kitten pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2",
							k.motion === "boop" && "kitten-booped",
						)}
						style={style}
					>
						{face}
					</span>
				);
			})}
			{pick && <LandingTargets pick={pick} view={view} />}
		</>
	);
}

/** Tap targets are at least this many squares across, whatever the kitten's size. */
const HIT = 0.92;

/** How far a tap target reaches past a kitten drawn `size` squares wide. */
const hitInset = (size: number) =>
	`${(-Math.max(0, (HIT - size) / 2) / size) * 100}%`;

/** Tapping where a kitten would land moves it, too. */
function LandingTargets({
	pick,
	view,
}: {
	pick: Pick & { player: Player };
	view: number;
}) {
	const { player } = pick;
	return [...pick.kittens].map((k) => {
		const to = advance(player.kittens[k], pick.roll);
		if (to === null) return null;
		const at = kittenPoint(player.corner, to, k, view);
		return (
			<button
				key={k}
				type="button"
				tabIndex={-1}
				aria-hidden="true"
				className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
				style={{
					left: pct(at.x),
					top: pct(at.y),
					width: pct(1),
					height: pct(1),
				}}
				onClick={() => pick.onPick(k)}
			/>
		);
	});
}

function describe(at: Progress) {
	if (at === BASKET) return "in the basket";
	if (at === HOME) return "in the food bowl";
	if (at > LAST_TRACK) return `${HOME - at} from the food bowl`;
	return `${at + 1} squares out`;
}
