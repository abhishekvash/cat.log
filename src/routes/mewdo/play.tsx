import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GameBreadcrumb } from "#/components/catalog/game-breadcrumb";
import { ConfirmAction } from "#/components/confirm-action";
import { viewTurns } from "#/components/mewdo/geometry";
import { PlayersForm } from "#/components/mewdo/players-form";
import { Results } from "#/components/mewdo/results";
import { MewdoTable, PlayerList } from "#/components/mewdo/table";
import { Button } from "#/components/ui/button";
import { MEWDO } from "#/lib/catalog";
import { reduce, start } from "#/lib/mewdo/engine";
import {
	type LocalGame,
	type LocalPlayer,
	loadLocal,
	localSeats,
	saveLocal,
} from "#/lib/mewdo/local";
import type { Move } from "#/lib/mewdo/types";
import type { SeatId } from "#/lib/multiplayer/types";
import { cryptoRng } from "#/lib/rng";
import { seo } from "#/lib/seo";

// The game lives in localStorage, so there's nothing useful to render on the server.
export const Route = createFileRoute("/mewdo/play")({
	head: () =>
		seo({
			title: "Play Mewdo · cat.log",
			description:
				"Two to four cats on one screen: race your kittens round the board to the food bowl.",
			path: "/mewdo/play",
			noindex: true,
		}),
	ssr: false,
	component: Play,
});

const ctx = () => ({ rng: cryptoRng, now: Date.now() });

function Play() {
	const [game, setGame] = useState<LocalGame>(loadLocal);
	useEffect(() => saveLocal(game), [game]);

	const begin = (players: LocalPlayer[]) =>
		setGame((g) => ({
			players,
			state: start(localSeats(players), ctx()),
			round: g.round + 1,
		}));
	const choosePlayers = () => setGame((g) => ({ ...g, state: null }));

	const { state } = game;
	if (!state) return <PlayersForm initial={game.players} onStart={begin} />;

	const onMove = (seat: SeatId, move: Move) => {
		const result = reduce(state, seat, move, ctx());
		if (!result.ok) toast(result.error);
		else setGame((g) => ({ ...g, state: result.state }));
	};

	return (
		<MewdoTable
			key={game.round}
			state={state}
			controls="anyone"
			onMove={onMove}
			view={viewTurns(0)}
			header={
				<div className="cat-eyes-occupied flex items-center justify-between gap-2 text-sm">
					<GameBreadcrumb to={MEWDO.path}>{MEWDO.title}</GameBreadcrumb>
					{state.phase === "playing" && (
						<ConfirmAction
							title="Start over?"
							description="This game ends and you go back to choosing players."
							action="Start over"
							onConfirm={choosePlayers}
						>
							<Button variant="ghost" size="compact">
								<ArrowCounterClockwiseIcon />
								New game
							</Button>
						</ConfirmAction>
					)}
				</div>
			}
			players={(current) => <PlayerList state={state} current={current} />}
			results={
				<Results
					state={state}
					actions={
						<>
							<Button size="compact-lg" onClick={() => begin(game.players)}>
								Play again
							</Button>
							<Button
								size="compact-lg"
								variant="outline"
								onClick={choosePlayers}
							>
								Change players
							</Button>
							<Button asChild size="compact-lg" variant="ghost">
								<Link to="/">Back to cat.log</Link>
							</Button>
						</>
					}
				/>
			}
		/>
	);
}
