import type { ReactNode } from "react";
import { CatEars } from "#/components/cats/cat-ears";
import { SleepyCat } from "#/components/cats/cat-face";
import { Card } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";
import { type GameState, PEGS } from "#/lib/mastermind";
import { cn } from "#/lib/utils";
import { PIN_SIZE, Slot } from "./pins";

const positions = Array.from({ length: PEGS }, (_, i) => i);

/** Ten guess rows with their score paws, and the hidden code underneath. */
export function Board({
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
		<Card className="relative mt-8 gap-0 p-3">
			<CatEars />
			<BoardLine className="pb-1 text-xs font-medium text-muted-foreground">
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
							"rounded-lg py-[calc(var(--pin)*0.1)] transition-colors",
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
									label={`Try ${r + 1}, position ${i + 1}: ${color ?? "empty"}`}
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
									label={`Score for try ${r + 1}, position ${i + 1}: ${color ?? "empty"}`}
									onTap={() => onTapKey(i, color)}
								/>
							))}
						</Cols>
					</BoardLine>
				);
			})}

			{/* The divider sits on its own so the code row pads evenly, like guess rows. */}
			<Separator className="mx-2 my-2 w-auto!" />
			<BoardLine
				className={cn(
					"rounded-lg py-[calc(var(--pin)*0.1)]",
					state.phase === "setup" && "bg-primary/10 ring-1 ring-primary/35",
				)}
			>
				<span className="text-overline text-right tracking-wider">Code</span>
				<Cols
					kind="code"
					className={cn(
						over &&
							"animate-in zoom-in-50 fade-in duration-700 motion-reduce:animate-none",
					)}
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
		</Card>
	);
}

function BoardLine({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-[2.5rem_auto_auto] items-center gap-x-3 px-2",
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
	children: ReactNode;
}) {
	const size = PIN_SIZE[kind];
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
