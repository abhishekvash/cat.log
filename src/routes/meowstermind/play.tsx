import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CatIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { GameBreadcrumb } from "#/components/catalog/game-breadcrumb";
import { KittenBurst } from "#/components/cats/kitten-burst";
import { Actions } from "#/components/mastermind/actions";
import { Board } from "#/components/mastermind/board";
import { Pin } from "#/components/mastermind/pins";
import { PlayersForm } from "#/components/mastermind/players-form";
import { NewMatchButton, Scoreboard } from "#/components/mastermind/scoreboard";
import { Status } from "#/components/mastermind/status";
import { KittyTray, PawBox } from "#/components/mastermind/trays";
import { usePinInput } from "#/components/mastermind/use-pin-input";
import {
	activeCodeTarget,
	loadGame,
	reducer,
	saveGame,
} from "#/lib/mastermind";
import { seo } from "#/lib/seo";

// The game lives in localStorage, so there's nothing useful to render on the server.
export const Route = createFileRoute("/meowstermind/play")({
	head: () =>
		seo({
			title: "Play Meowstermind · cat.log",
			description:
				"Two players, one screen: hide a row of kitties and crack the code with paw-print clues.",
			path: "/meowstermind/play",
			noindex: true,
		}),
	ssr: false,
	component: Play,
});

function Play() {
	const [state, dispatch] = useReducer(reducer, undefined, loadGame);
	const input = usePinInput(state, dispatch);
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

	const sensors = useSensors(
		// A small travel threshold keeps taps working as taps on touch screens.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
			{...input.dnd}
		>
			<div className="game flex min-h-dvh select-none flex-col [-webkit-touch-callout:none]">
				<header className="flex flex-wrap items-center justify-between gap-y-2 border-b px-4 py-2">
					<GameBreadcrumb
						to="/meowstermind"
						className="text-lg"
						linkClassName="flex items-center gap-2 py-2 font-semibold"
						hideHomeOnMobile
					>
						<CatIcon className="size-5 text-primary" /> Meowstermind
					</GameBreadcrumb>
					{state.match && <Scoreboard match={state.match} />}
					<NewMatchButton
						needsConfirm={state.match !== null}
						onReset={() => dispatch({ type: "reset" })}
					/>
				</header>

				{state.phase === "players" ? (
					<PlayersForm
						onStart={(players) => dispatch({ type: "startMatch", players })}
					/>
				) : (
					// Landscape: panel | board | paws. Portrait: panel strip above board | paws.
					// "-safe" alignment: if space ever runs out, overflow scrolls instead of clipping the top.
					<main className="flex flex-1 items-center-safe justify-center-safe gap-6 p-4 md:gap-10 portrait:flex-col portrait:gap-4">
						<aside className="flex w-52 shrink-0 flex-col gap-5 portrait:w-auto portrait:flex-row portrait:flex-wrap portrait:items-center portrait:justify-center portrait:gap-6">
							<Status state={state} />
							{activeCodeTarget(state) && (
								<KittyTray
									selection={input.selection}
									onSelect={input.toggle}
								/>
							)}
							<Actions state={state} dispatch={dispatch} onPeek={setPeeking} />
						</aside>

						<div className="flex items-center gap-6 md:gap-10 portrait:gap-5 portrait:max-sm:flex-col">
							<Board
								state={state}
								revealed={revealed}
								onTapCode={input.tapCode}
								onTapKey={input.tapKey}
							/>
							<PawBox
								active={state.phase === "scoring"}
								selection={input.selection}
								onSelect={input.toggle}
							/>
						</div>
					</main>
				)}
			</div>

			{bursting && <KittenBurst onDone={endBurst} />}

			<DragOverlay dropAnimation={null}>
				{input.dragging && (
					<Pin
						color={input.dragging.color}
						kind={input.dragging.kind}
						size={input.dragging.kind === "key" ? "1.75rem" : "3rem"}
						className="scale-110 -rotate-6"
					/>
				)}
			</DragOverlay>
		</DndContext>
	);
}
