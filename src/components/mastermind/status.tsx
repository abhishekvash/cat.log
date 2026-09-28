import { breakerOf, type GameState, mastermindOf } from "#/lib/mastermind";
import { cn } from "#/lib/utils";

/** Whose move it is and what to do, in words. */
export function Status({ state }: { state: GameState }) {
	const { match } = state;
	const mastermind = match ? match.players[mastermindOf(match)] : "Mastermind";
	const breaker = match ? match.players[breakerOf(match)] : "Codebreaker";
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
			<p className="text-overline">
				{state.phase === "guessing" || state.phase === "scoring"
					? `Try ${tries} of ${state.rows.length}`
					: match
						? `Round ${match.round + 1}`
						: " "}
			</p>
			<p
				className={cn(
					"font-display text-xl font-semibold",
					state.phase === "won" && "text-3xl text-primary",
				)}
			>
				{who}
			</p>
			<p className="text-sm text-muted-foreground">{what}</p>
		</div>
	);
}
