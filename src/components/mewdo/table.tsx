import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CatHead } from "#/components/cats/cat-face";
import { Die } from "#/components/meownopoly/dice";
import { Button } from "#/components/ui/button";
import { BASKET, HOME, ordinal } from "#/lib/mewdo/board";
import type { GameState, Move, Player } from "#/lib/mewdo/types";
import type { SeatId } from "#/lib/multiplayer/types";
import { cn } from "#/lib/utils";
import { Board } from "./board";
import { tintOf } from "./palette";
import { type Motion, useMotion } from "./use-motion";

/** Who this device plays for: one seat, whoever's turn it is, or nobody. */
export type Controls = SeatId | "anyone" | null;

/**
 * A Mewdo game on screen, online or on one shared screen: the board, whose
 * turn it is with the die, the players and what just happened. The page
 * supplies the header, the player list, extras (leaving, the host's tools)
 * and what to show once every place is decided.
 */
export function MewdoTable({
	state,
	controls,
	onMove,
	live = true,
	view,
	header,
	players,
	extras,
	results,
}: {
	state: GameState;
	controls: Controls;
	onMove: (seat: SeatId, move: Move) => void;
	live?: boolean;
	view: number;
	header: ReactNode;
	/** The players, given whose turn to show (held on the roller mid-roll). */
	players: (current: SeatId | undefined) => ReactNode;
	extras?: ReactNode;
	results: ReactNode;
}) {
	const motion = useMotion(state, view);
	// What's on screen can lag `state` while moves play out; act only once settled.
	const shown = motion.state;
	const turn = shown.turn;
	const actor = controls === "anyone" ? (turn?.playerId ?? null) : controls;
	const mine = !!turn && actor === turn.playerId;
	// A move sent but not yet answered: no second tap until the reply arrives
	// (or a while passes, in case it was turned down).
	const [sent, setSent] = useState<GameState | null>(null);
	useEffect(() => {
		if (!sent) return;
		const clear = window.setTimeout(() => setSent(null), SENT_TIMEOUT_MS);
		return () => window.clearTimeout(clear);
	}, [sent]);
	const ready = mine && live && !motion.busy && sent !== state;
	const send = (seat: SeatId, move: Move) => {
		setSent(state);
		onMove(seat, move);
	};
	const current = shown.players.find((p) => p.id === turn?.playerId);
	const pick =
		ready && turn?.phase === "move" && turn.roll !== null && current
			? {
					player: current,
					kittens: new Set(turn.movable),
					roll: turn.roll,
					onPick: (kitten: number) =>
						send(current.id, { type: "move", kitten }),
				}
			: null;
	const finished = shown.phase === "finished" && !motion.busy;
	const shownId = shownTurn(motion);

	return (
		<main className="flex min-h-dvh flex-col items-center gap-3 p-3 md:landscape:h-dvh md:landscape:flex-row md:landscape:items-stretch md:landscape:justify-center md:landscape:overflow-hidden">
			<div className="mewdo-board shrink-0 self-center">
				<Board
					state={shown}
					view={view}
					motion={motion}
					pick={pick}
					current={shownId}
				/>
			</div>
			<aside className="flex w-full min-w-0 max-w-xl flex-col gap-4 md:landscape:max-w-sm md:landscape:overflow-y-auto">
				{header}
				{finished ? (
					results
				) : (
					<TurnCard
						motion={motion}
						ready={ready}
						controls={controls}
						onRoll={() => turn && send(turn.playerId, { type: "roll" })}
					/>
				)}
				{players(shownId)}
				<Activity log={shown.log} />
				{extras}
			</aside>
		</main>
	);
}

/** How long a sent move holds the controls if no reply comes back. */
const SENT_TIMEOUT_MS = 4000;

/** Whose turn it looks like: the cat who rolled, until the roll has played out. */
function shownTurn(motion: Motion) {
	const { state } = motion;
	return motion.busy && state.lastRoll
		? state.lastRoll.playerId
		: state.turn?.playerId;
}

function TurnCard({
	motion,
	ready,
	controls,
	onRoll,
}: {
	motion: Motion;
	ready: boolean;
	controls: Controls;
	onRoll: () => void;
}) {
	const { state } = motion;
	const turn = state.turn;
	// Until the roll has played out, keep showing the cat who rolled it.
	const shown = state.players.find((p) => p.id === shownTurn(motion));
	if (!turn || !shown) return null;
	const roll = state.lastRoll;
	const settled = !motion.busy;
	// Everything here is about the cat shown, so the heading never says
	// "Your turn" over someone else's cat.
	const yours = controls === "anyone" || controls === shown.id;
	const name = controls === shown.id ? "Your turn" : `${shown.name}'s turn`;
	const phase = shown.id === turn.playerId ? turn.phase : "roll";

	let hint: ReactNode;
	if (!settled) hint = motion.rolling ? "Rolling…" : "Hop, hop…";
	else if (!yours)
		hint = `Waiting for ${shown.name} to ${phase === "roll" ? "roll" : "pick a kitten"}.`;
	else if (phase === "roll") {
		// Still their roll after rolling: a 6 or a boop earned another.
		const again = roll?.playerId === shown.id;
		const booped =
			again &&
			state.lastMove?.playerId === shown.id &&
			state.lastMove.booped.length > 0 &&
			roll.value !== 6;
		if (booped) hint = "Boop! That earns another roll.";
		else if (again) hint = "A 6! Roll again.";
		else if (shown.kittens.every((k) => k === BASKET))
			hint = "Roll a 6 to let a kitten out.";
		else hint = "Roll the die.";
	} else hint = `Tap a glowing kitten to move it ${turn.roll}.`;

	return (
		<section
			aria-label="Turn"
			className="cat-eyes-occupied flex items-center gap-4 rounded-[14px] border bg-card p-4"
			style={{ borderColor: tintOf(shown.corner) }}
		>
			<RollingDie
				value={roll?.value ?? 6}
				rollId={roll?.id}
				rolling={motion.rolling}
				faded={!roll || roll.playerId !== shown.id}
			/>
			<div className="min-w-0 flex-1 space-y-2">
				<div className="flex items-center gap-2">
					<CatHead cat={shown.cat} size="1.6rem" />
					<h2 className="truncate font-display text-lg font-semibold">
						{name}
					</h2>
				</div>
				<p className="text-sm text-muted-foreground" aria-live="polite">
					{hint}
				</p>
				{yours && phase === "roll" && (
					<Button
						size="lg"
						className="w-full"
						disabled={!ready}
						onClick={onRoll}
					>
						Roll
					</Button>
				)}
			</div>
		</section>
	);
}

/** The die: tumbling through faces for a fresh roll, then the roll. */
function RollingDie({
	value,
	rollId,
	rolling,
	faded,
}: {
	value: number;
	rollId: number | undefined;
	rolling: boolean;
	faded: boolean;
}) {
	const [face, setFace] = useState<number | null>(null);
	useEffect(() => {
		if (!rolling) {
			setFace(null);
			return;
		}
		const flick = window.setInterval(
			() => setFace(1 + Math.floor(Math.random() * 6)),
			70,
		);
		return () => window.clearInterval(flick);
	}, [rolling]);
	return (
		<div
			key={rollId}
			className={cn(
				"shrink-0 transition-opacity",
				rolling && "dice-tumble",
				faded && !rolling && "opacity-40",
			)}
		>
			<Die value={face ?? value} className="size-16" />
		</div>
	);
}

/** Every cat in turn order, with how many kittens are home and any place won. */
export function PlayerList({
	state,
	current,
	you,
	extra,
}: {
	state: GameState;
	current: SeatId | undefined;
	you?: SeatId;
	extra?: (p: Player) => ReactNode;
}) {
	return (
		<ul className="space-y-1" aria-label="Players">
			{state.players.map((p) => (
				<li
					key={p.id}
					className={cn(
						"cat-eyes-occupied flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5",
						current === p.id && "border-primary/50 bg-primary/10",
						p.gone && "opacity-45",
					)}
				>
					<PlayerToken player={p} size="1.6rem" />
					<span className="min-w-0 flex-1 truncate font-display text-sm font-medium">
						{p.name}
						{p.id === you && (
							<span className="ml-1.5 text-xs text-muted-foreground">
								(you)
							</span>
						)}
					</span>
					{extra?.(p)}
					<PlayerStatus player={p} />
				</li>
			))}
		</ul>
	);
}

/** A cat head in its corner's ring, as on the board. */
export function PlayerToken({
	player,
	size,
}: {
	player: Player;
	size: string;
}) {
	return (
		<span
			className="block shrink-0 rounded-full p-[3px]"
			style={{ background: tintOf(player.corner) }}
		>
			<CatHead cat={player.cat} size={size} />
		</span>
	);
}

/** "2nd", "Left", or four dots filling in as kittens reach the food bowl. */
export function PlayerStatus({ player }: { player: Player }) {
	if (player.gone)
		return <span className="text-xs text-muted-foreground">Left</span>;
	if (player.place !== null)
		return (
			<span className="font-display text-sm font-semibold text-primary">
				{ordinal(player.place)}
			</span>
		);
	const home = player.kittens.filter((k) => k === HOME).length;
	return (
		<span
			className="flex gap-1"
			role="img"
			aria-label={`${home} of ${player.kittens.length} kittens home`}
		>
			{player.kittens.map((_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of dots
					key={i}
					className="size-2 rounded-full"
					style={{
						background: i < home ? tintOf(player.corner) : "var(--color-well)",
					}}
				/>
			))}
		</span>
	);
}

function Activity({ log }: { log: GameState["log"] }) {
	const recent = log.slice(-5).reverse();
	return (
		<ol
			role="log"
			aria-label="Activity"
			className="cat-eyes-occupied space-y-1 text-sm"
		>
			{recent.map((line, i) => (
				<li
					key={line.id}
					className={cn(
						i === 0 ? "text-foreground/90" : "text-xs text-muted-foreground",
						i > 2 && "opacity-70",
					)}
				>
					{line.text}
				</li>
			))}
		</ol>
	);
}

/** Every cat in finishing order, for the results. */
export function Podium({ state }: { state: GameState }) {
	const ranked = [...state.players].sort(
		(a, b) => (a.place ?? 99) - (b.place ?? 99),
	);
	return (
		<ol className="space-y-2">
			{ranked.map((p) => (
				<li key={p.id} className="flex items-center gap-3">
					<span className="w-9 font-display text-lg font-semibold text-primary">
						{p.place ? ordinal(p.place) : "–"}
					</span>
					<PlayerToken player={p} size={p.place === 1 ? "2.4rem" : "1.8rem"} />
					<span className="font-display font-medium">{p.name}</span>
					{p.gone && (
						<span className="text-xs text-muted-foreground">left</span>
					)}
				</li>
			))}
		</ol>
	);
}
