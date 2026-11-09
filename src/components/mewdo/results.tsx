import { type ReactNode, useCallback, useState } from "react";
import { KittenBurst } from "#/components/cats/kitten-burst";
import { HOME } from "#/lib/mewdo/board";
import type { GameState, Player } from "#/lib/mewdo/types";
import { Podium } from "./table";

/** Who won, and how: home first, or the last cat left at the table. */
function headline(winner: Player | undefined) {
	if (!winner) return "Game over";
	if (winner.kittens.every((k) => k === HOME))
		return `${winner.name} got every kitten to the food bowl first!`;
	return `${winner.name} wins: everyone else left.`;
}

/** Every place decided: a burst of kittens, the podium, and what next. */
export function Results({
	state,
	actions,
}: {
	state: GameState;
	actions: ReactNode;
}) {
	const winner = state.players.find((p) => p.place === 1);
	const [burst, setBurst] = useState(true);
	const endBurst = useCallback(() => setBurst(false), []);
	return (
		<section
			aria-label="Results"
			className="cat-eyes-occupied space-y-4 rounded-[14px] border bg-card p-4"
		>
			{burst && <KittenBurst onDone={endBurst} />}
			<h2 className="font-display text-xl font-semibold text-primary">
				{headline(winner)}
			</h2>
			<Podium state={state} />
			<div className="flex flex-wrap gap-2">{actions}</div>
		</section>
	);
}
