import { ArrowUUpLeftIcon, EyeIcon, ShuffleIcon } from "@phosphor-icons/react";
import type { Dispatch } from "react";
import { Button } from "#/components/ui/button";
import {
	type Action,
	breakerOf,
	type GameState,
	isFull,
	randomCode,
} from "#/lib/mastermind";
import { cryptoRng } from "#/lib/rng";

/** The buttons for this phase: hide, guess, score, or on to the next round. */
export function Actions({
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
						onClick={() =>
							dispatch({ type: "randomSecret", secret: randomCode(cryptoRng) })
						}
					>
						<ShuffleIcon /> Random code
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
						<EyeIcon /> Hold to peek at code
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => dispatch({ type: "editGuess" })}
					>
						<ArrowUUpLeftIcon /> Let codebreaker edit
					</Button>
				</div>
			);
		default: {
			// Roles swap next round: this round's codebreaker hides the next code.
			const next = state.match?.players[breakerOf(state.match)];
			return (
				<Button
					size="lg"
					className="h-auto min-h-12 py-2 whitespace-normal text-balance"
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
