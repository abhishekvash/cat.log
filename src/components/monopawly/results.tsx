import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CatHead } from "#/components/cats/cat-face";
import { KittenBurst } from "#/components/cats/kitten-burst";
import { Button } from "#/components/ui/button";
import { playerById } from "#/lib/monopawly/selectors";
import { useGame } from "./use-game";

/** The last cat standing, a burst of kittens, and a rematch. */
export function Results() {
	const { state, isHost, act } = useGame();
	const winner = playerById(state, state.winnerId);
	const [burst, setBurst] = useState(true);
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
			{burst && <KittenBurst onDone={() => setBurst(false)} />}
			{winner && <CatHead cat={winner.cat} size="5rem" />}
			<h2 className="font-display text-2xl font-semibold text-primary">
				{winner ? `${winner.name} is the last cat standing!` : "Game over"}
			</h2>
			<p className="max-w-measure text-muted-foreground">
				This room tidies itself away in a few minutes, or as soon as everyone
				leaves.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				{isHost ? (
					<Button size="compact-lg" onClick={() => act({ type: "playAgain" })}>
						Play again
					</Button>
				) : (
					<p className="text-sm text-muted-foreground">
						The host can start another game.
					</p>
				)}
				<Button asChild size="compact-lg" variant="outline">
					<Link to="/">Back to cat.log</Link>
				</Button>
			</div>
		</div>
	);
}
