import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Cat, Eye, RotateCcw, Shuffle, Undo2 } from "lucide-react";
import {
	type Dispatch,
	type FormEvent,
	useCallback,
	useEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { KittenBurst } from "#/components/mastermind/kitten-burst";
import {
	type DragData,
	type DropData,
	Pin,
	type Selection,
	SleepyCat,
	Slot,
	TrayPin,
} from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	type Action,
	activeCodeTarget,
	breakerOf,
	CODE_COLORS,
	type GameState,
	isFull,
	KEY_COLORS,
	loadGame,
	type Match,
	mastermindOf,
	PEGS,
	reducer,
	saveGame,
} from "#/lib/mastermind";
import { cn } from "#/lib/utils";

// The game lives in localStorage, so there's nothing useful to render on the server.
export const Route = createFileRoute("/play")({
	ssr: false,
	component: Play,
});

const positions = Array.from({ length: PEGS }, (_, i) => i);

function Play() {
	const [state, dispatch] = useReducer(reducer, undefined, loadGame);
	const [selection, setSelection] = useState<Selection | null>(null);
	const [dragging, setDragging] = useState<DragData | null>(null);
	const [peeking, setPeeking] = useState(false);

	useEffect(() => saveGame(state), [state]);

	// Celebrate the moment a code is cracked (not when reloading a finished game).
	const [bursting, setBursting] = useState(false);
	const endBurst = useCallback(() => setBursting(false), []);
	const previousPhase = useRef(state.phase);
	useEffect(() => {
		if (state.phase === "won" && previousPhase.current !== "won")
			setBursting(true);
		previousPhase.current = state.phase;
	}, [state.phase]);
	// A selected pin from the previous turn shouldn't leak into the next one.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on phase change only
	useEffect(() => setSelection(null), [state.phase]);

	const sensors = useSensors(
		// A small travel threshold keeps taps working as taps on touch screens.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const target = activeCodeTarget(state);

	function onDragEnd({ active, over }: DragEndEvent) {
		setDragging(null);
		const src = active.data.current as DragData;
		const drop = over?.data.current as DropData | undefined;
		const dst = drop?.enabled ? drop : undefined;
		const from = src.from;

		if (dst && dst.kind === src.kind) {
			if (from === dst.index) return;
			if (src.kind === "code" && target) {
				dispatch(
					from === undefined
						? { type: "placeCode", target, index: dst.index, color: src.color }
						: { type: "moveCode", target, from, to: dst.index },
				);
			} else if (src.kind === "key") {
				dispatch(
					from === undefined
						? { type: "setKey", index: dst.index, color: src.color }
						: { type: "moveKey", from, to: dst.index },
				);
			}
			return;
		}
		// A placed pin dropped anywhere else is taken off the board.
		if (from === undefined) return;
		if (src.kind === "code" && target)
			dispatch({ type: "clearCode", target, index: from });
		if (src.kind === "key")
			dispatch({ type: "setKey", index: from, color: null });
	}

	function tapCode(index: number, current: string | null) {
		if (!target) return;
		if (selection?.kind === "code" && selection.color !== current) {
			dispatch({ type: "placeCode", target, index, color: selection.color });
		} else if (current) {
			dispatch({ type: "clearCode", target, index });
		}
	}

	function tapKey(index: number, current: string | null) {
		if (selection?.kind !== "key") return dispatch({ type: "cycleKey", index });
		dispatch({
			type: "setKey",
			index,
			color: selection.color === current ? null : selection.color,
		});
	}

	const toggle = (next: Selection) =>
		setSelection((prev) =>
			prev?.kind === next.kind && prev.color === next.color ? null : next,
		);

	const revealed =
		state.phase === "setup" ||
		state.phase === "won" ||
		state.phase === "lost" ||
		peeking;

	return (
		<DndContext
			sensors={sensors}
			// Drop into whichever hole is under the finger, not whichever overlaps most.
			collisionDetection={pointerWithin}
			onDragStart={({ active }: DragStartEvent) =>
				setDragging(active.data.current as DragData)
			}
			onDragCancel={() => setDragging(null)}
			onDragEnd={onDragEnd}
		>
			<div className="game flex min-h-dvh select-none flex-col [-webkit-touch-callout:none]">
				<header className="flex flex-wrap items-center justify-between gap-y-2 border-b px-4 py-2">
					<Link
						to="/"
						className="flex items-center gap-2 font-semibold tracking-tight"
					>
						<Cat className="size-5 text-primary" /> Meowstermind
						<span className="text-xs font-normal text-muted-foreground max-sm:hidden">
							nya~
						</span>
					</Link>
					{state.match && <Scoreboard match={state.match} />}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							if (
								!state.match ||
								window.confirm(
									"End this match and reset the scores? The kitties will be sad.",
								)
							)
								dispatch({ type: "reset" });
						}}
					>
						<RotateCcw /> <span className="max-sm:sr-only">New match</span>
					</Button>
				</header>

				{state.phase === "players" ? (
					<PlayersForm
						onStart={(players) => dispatch({ type: "startMatch", players })}
					/>
				) : (
					<>
						{/* Landscape: panel | board | paws. Portrait: panel strip above board | paws. */}
						{/* "-safe" alignment: if space ever runs out, overflow scrolls instead of clipping the top. */}
						<main className="flex flex-1 items-center-safe justify-center-safe gap-6 p-4 md:gap-10 portrait:flex-col portrait:gap-4">
							<aside className="flex w-48 shrink-0 flex-col gap-5 portrait:w-auto portrait:flex-row portrait:flex-wrap portrait:items-center portrait:justify-center portrait:gap-6">
								<Status state={state} />

								{target && (
									<Tray label="Kitties">
										{CODE_COLORS.map((color) => (
											<TrayPin
												key={color}
												selection={{ kind: "code", color }}
												selected={
													selection?.kind === "code" &&
													selection.color === color
												}
												onSelect={() => toggle({ kind: "code", color })}
											/>
										))}
									</Tray>
								)}
								<Actions
									state={state}
									dispatch={dispatch}
									onPeek={setPeeking}
								/>
							</aside>

							<div className="flex items-center gap-6 md:gap-10 portrait:gap-5 portrait:max-sm:flex-col">
								<Board
									state={state}
									revealed={revealed}
									onTapCode={tapCode}
									onTapKey={tapKey}
								/>
								<PawBox
									active={state.phase === "scoring"}
									selection={selection}
									onSelect={toggle}
								/>
							</div>
						</main>
					</>
				)}
			</div>

			{bursting && <KittenBurst onDone={endBurst} />}

			<DragOverlay dropAnimation={null}>
				{dragging && (
					<Pin
						color={dragging.color}
						kind={dragging.kind}
						size={dragging.kind === "key" ? "1.75rem" : "3rem"}
						className="scale-110 -rotate-6"
					/>
				)}
			</DragOverlay>
		</DndContext>
	);
}

function Status({ state }: { state: GameState }) {
	const { match } = state;
	const mastermind = match ? match.players[mastermindOf(match)] : "Mastermind";
	const breaker = match ? match.players[breakerOf(match)] : "Player";
	const tries = state.current + 1;
	const points = match?.lastPoints ?? 0;
	const status: Record<GameState["phase"], [string, string]> = {
		players: ["", ""],
		setup: [
			`${mastermind}, hide the code`,
			`Hide your secret kitties in the bottom row. ${breaker}, no peeking!`,
		],
		guessing: [`${breaker}'s guess`, "Drag kitties into the glowing row."],
		scoring: [
			`${mastermind}, score it`,
			"Paw-score each spot. Pink: right cat, right spot. White: right cat, wrong spot. Empty: not in the code.",
		],
		won: [
			"Purrfect!",
			`${breaker} cracked it in ${tries} ${tries === 1 ? "try" : "tries"}: +${points} points.`,
		],
		lost: [
			`${mastermind} wins the round`,
			`The kitties kept their secret. ${breaker} gets 0 points.`,
		],
	};
	const [who, what] = status[state.phase];
	return (
		<div className="space-y-1 portrait:w-52">
			<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
				{state.phase === "guessing" || state.phase === "scoring"
					? `Attempt ${tries} of ${state.rows.length}`
					: match
						? `Round ${match.round + 1}`
						: " "}
			</p>
			<p
				className={cn(
					"text-lg font-semibold",
					state.phase === "won" && "text-2xl text-primary",
				)}
			>
				{who}
			</p>
			<p className="text-sm text-muted-foreground">{what}</p>
		</div>
	);
}

/** Both players' totals; the current mastermind wears the little crown. */
function Scoreboard({ match }: { match: Match }) {
	return (
		<div className="flex items-center gap-2 text-sm max-sm:order-last max-sm:w-full max-sm:justify-center">
			{match.players.map((name, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: always exactly two players
					key={i}
					className={cn(
						"flex items-center gap-2 rounded-full border px-3 py-1",
						mastermindOf(match) === i && "border-primary/50 bg-primary/10",
					)}
				>
					<span className="max-w-24 truncate">{name}</span>
					<span className="font-semibold tabular-nums text-primary">
						{match.scores[i]}
					</span>
					<span className="text-[10px] text-muted-foreground max-sm:hidden">
						{mastermindOf(match) === i ? "hides" : "guesses"}
					</span>
				</div>
			))}
		</div>
	);
}

function PlayersForm({
	onStart,
}: {
	onStart: (players: [string, string]) => void;
}) {
	const [names, setNames] = useState<[string, string]>(["", ""]);
	const ready = names.every((name) => name.trim());
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (ready) onStart([names[0].trim(), names[1].trim()]);
	};
	return (
		<main className="flex flex-1 items-center justify-center p-6">
			<form
				onSubmit={submit}
				className="cat-ears flex w-full max-w-sm flex-col gap-5 rounded-3xl border bg-card p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
			>
				<div className="flex justify-center gap-2">
					{CODE_COLORS.map((color) => (
						<Pin key={color} color={color} kind="code" size="2.25rem" />
					))}
				</div>
				<div className="space-y-1 text-center">
					<h1 className="text-xl font-semibold">Who's playing?</h1>
					<p className="text-sm text-muted-foreground">
						You take turns hiding the code. The codebreaker scores 11 minus the
						tries they needed, so crack it fast!
					</p>
				</div>
				{(["Player 1 (hides first)", "Player 2"] as const).map((label, i) => (
					<div key={label} className="space-y-1.5 text-sm">
						<label htmlFor={`player-${i}`} className="text-muted-foreground">
							{label}
						</label>
						<Input
							id={`player-${i}`}
							value={names[i]}
							maxLength={16}
							autoComplete="off"
							autoFocus={i === 0}
							placeholder={i === 0 ? "Mochi" : "Biscuit"}
							onChange={(event) => {
								const next = [...names] as [string, string];
								next[i] = event.target.value;
								setNames(next);
							}}
							className="h-11 rounded-xl text-base"
						/>
					</div>
				))}
				<Button type="submit" size="lg" disabled={!ready}>
					Start match
				</Button>
			</form>
		</main>
	);
}

function Tray({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<div className="flex flex-wrap gap-1 rounded-2xl border bg-card p-2">
				{children}
			</div>
		</div>
	);
}

const PAW_HINTS = { pink: "right spot", white: "wrong spot" } as const;

/** The mastermind's supply of score paws, parked right next to the score column. */
function PawBox({
	active,
	selection,
	onSelect,
}: {
	active: boolean;
	selection: Selection | null;
	onSelect: (selection: Selection) => void;
}) {
	return (
		<div
			className={cn(
				"flex w-22 shrink-0 flex-col items-center gap-3 rounded-3xl border bg-card px-2 py-4 transition max-sm:w-auto max-sm:flex-row max-sm:px-4 max-sm:py-2",
				active && "border-primary/60 shadow-[0_0_30px_-8px] shadow-primary/50",
			)}
		>
			<p className="text-center text-xs font-medium text-muted-foreground">
				Paw box
			</p>
			{KEY_COLORS.map((color) => (
				<div key={color} className="flex flex-col items-center gap-0.5">
					<TrayPin
						selection={{ kind: "key", color }}
						selected={selection?.kind === "key" && selection.color === color}
						disabled={!active}
						onSelect={() => onSelect({ kind: "key", color })}
					/>
					<span className="text-center text-[10px] leading-tight text-muted-foreground">
						{PAW_HINTS[color]}
					</span>
				</div>
			))}
			<p className="text-center text-[10px] leading-tight text-muted-foreground">
				{active ? "Drag onto the glowing row" : "Unlocks when scoring"}
			</p>
		</div>
	);
}

function Actions({
	state,
	dispatch,
	onPeek,
}: {
	state: GameState;
	dispatch: Dispatch<Action>;
	onPeek: (peeking: boolean) => void;
}) {
	const row = state.rows[state.current];
	switch (state.phase) {
		case "setup":
			return (
				<div className="flex flex-col gap-2">
					<Button
						size="lg"
						disabled={!isFull(state.secret)}
						onClick={() => dispatch({ type: "startGame" })}
					>
						Hide code & start
					</Button>
					<Button
						variant="outline"
						onClick={() => dispatch({ type: "randomSecret" })}
					>
						<Shuffle /> Random code
					</Button>
				</div>
			);
		case "guessing":
			return (
				<Button
					size="lg"
					disabled={!isFull(row.guess)}
					onClick={() => dispatch({ type: "submitGuess" })}
				>
					Submit guess
				</Button>
			);
		case "scoring":
			return (
				<div className="flex flex-col gap-2">
					<Button size="lg" onClick={() => dispatch({ type: "confirmScore" })}>
						Confirm score
					</Button>
					<Button
						variant="outline"
						onPointerDown={() => onPeek(true)}
						onPointerUp={() => onPeek(false)}
						onPointerLeave={() => onPeek(false)}
						onPointerCancel={() => onPeek(false)}
						onContextMenu={(e) => e.preventDefault()}
					>
						<Eye /> Hold to peek at code
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => dispatch({ type: "editGuess" })}
					>
						<Undo2 /> Let player edit guess
					</Button>
				</div>
			);
		default: {
			// Roles swap next round: this round's codebreaker hides the next code.
			const next = state.match?.players[breakerOf(state.match)];
			return (
				<Button
					size="lg"
					onClick={() =>
						dispatch({ type: state.match ? "nextRound" : "reset" })
					}
				>
					{next ? `Next round: ${next} hides` : "Play again"}
				</Button>
			);
		}
	}
}

function Board({
	state,
	revealed,
	onTapCode,
	onTapKey,
}: {
	state: GameState;
	revealed: boolean;
	onTapCode: (index: number, current: string | null) => void;
	onTapKey: (index: number, current: string | null) => void;
}) {
	const playing = state.phase === "guessing" || state.phase === "scoring";
	const over = state.phase === "won" || state.phase === "lost";

	return (
		<div className="cat-ears mt-5 flex flex-col rounded-3xl border bg-card p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
			<BoardLine className="pb-1 text-[11px] font-medium text-muted-foreground">
				<span />
				<Cols kind="code">
					{positions.map((i) => (
						<span key={i}>{i + 1}</span>
					))}
				</Cols>
				<Cols kind="key">
					{positions.map((i) => (
						<span key={i}>{i + 1}</span>
					))}
				</Cols>
			</BoardLine>

			{state.rows.map((row, r) => {
				const current = r === state.current && playing;
				const past = r < state.current || (r === state.current && over);
				const guessing = current && state.phase === "guessing";
				const scoring = current && state.phase === "scoring";
				return (
					<BoardLine
						// biome-ignore lint/suspicious/noArrayIndexKey: rows are fixed positions
						key={r}
						className={cn(
							"rounded-xl py-[calc(var(--pin)*0.1)] transition-colors",
							current && "bg-primary/10 ring-1 ring-primary/35",
							!current && !past && "opacity-40",
						)}
					>
						<span className="text-right text-xs tabular-nums text-muted-foreground">
							{r + 1}
						</span>
						<Cols kind="code">
							{row.guess.map((color, i) => (
								<Slot
									// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed positions
									key={i}
									id={`guess-${r}-${i}`}
									kind="code"
									index={i}
									color={color}
									enabled={guessing}
									label={`Attempt ${r + 1}, position ${i + 1}: ${color ?? "empty"}`}
									onTap={() => onTapCode(i, color)}
								/>
							))}
						</Cols>
						<Cols
							kind="key"
							className={cn(
								scoring &&
									"rounded-full bg-background/70 ring-2 ring-primary/60",
							)}
						>
							{row.keys.map((color, i) => (
								<Slot
									// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed positions
									key={i}
									id={`key-${r}-${i}`}
									kind="key"
									index={i}
									color={color}
									enabled={scoring}
									label={`Score for attempt ${r + 1}, position ${i + 1}: ${color ?? "empty"}`}
									onTap={() => onTapKey(i, color)}
								/>
							))}
						</Cols>
					</BoardLine>
				);
			})}

			<BoardLine
				className={cn(
					"mt-2 border-t pt-2",
					state.phase === "setup" &&
						"rounded-xl bg-primary/10 ring-1 ring-primary/35",
				)}
			>
				<span className="text-right text-[10px] font-medium uppercase text-muted-foreground">
					Code
				</span>
				<Cols
					kind="code"
					className={cn(over && "animate-in zoom-in-50 fade-in duration-700")}
				>
					{state.secret.map((color, i) =>
						revealed ? (
							<Slot
								// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed positions
								key={i}
								id={`secret-${i}`}
								kind="code"
								index={i}
								color={color}
								enabled={state.phase === "setup"}
								label={`Secret position ${i + 1}: ${color ?? "empty"}`}
								onTap={() => onTapCode(i, color)}
							/>
						) : (
							// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed positions
							<SleepyCat key={i} />
						),
					)}
				</Cols>
				<span />
			</BoardLine>
		</div>
	);
}

function BoardLine({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-[1.75rem_auto_auto] items-center gap-x-3 px-2",
				className,
			)}
		>
			{children}
		</div>
	);
}

// Code and score columns share the same 5-position layout so each score pin sits
// in the same order as the guess pin it describes.
function Cols({
	kind,
	className,
	children,
}: {
	kind: "code" | "key";
	className?: string;
	children: React.ReactNode;
}) {
	const size = kind === "code" ? "var(--pin)" : "var(--key)";
	return (
		<div
			className={cn(
				"grid place-items-center gap-[calc(var(--pin)*0.18)] p-1",
				className,
			)}
			style={{ gridTemplateColumns: `repeat(${PEGS}, ${size})` }}
		>
			{children}
		</div>
	);
}
