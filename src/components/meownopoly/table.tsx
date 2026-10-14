import { useState } from "react";
import { lastRollId } from "#/lib/meownopoly/selectors";
import { Board } from "./board";
import { Center } from "./center";
import { PresentationProvider } from "./presentation";
import { RollClockProvider } from "./roll-clock";
import { SidePanel } from "./side-panel";
import { SpaceCard } from "./space-card";
import type { TradeDraft } from "./trade-panel";
import { useGame } from "./use-game";

/** A Meownopoly game in progress: the board with its centre, and the side panel. */
export function MeownopolyTable() {
	const { state } = useGame();
	const [selected, setSelected] = useState<number | null>(null);
	const [draft, setDraft] = useState<TradeDraft | null>(null);
	// Rolls from before the table mounted show still; only new ones tumble.
	const [loadedRoll] = useState(() => lastRollId(state));

	return (
		<RollClockProvider loadedRoll={loadedRoll}>
			<PresentationProvider live={state}>
				<main className="flex h-dvh flex-col gap-3 overflow-hidden p-2 landscape:flex-row landscape:justify-center sm:p-3">
					{/* The board is always the biggest thing on screen: a square as large as fits. */}
					<div className="board-frame m-5 aspect-square shrink-0 self-center">
						<Board
							selected={selected}
							onSelect={setSelected}
							card={(i) => <SpaceCard index={i} />}
						>
							<Center
								draft={draft}
								onDraftChange={setDraft}
								onCloseDraft={() => setDraft(null)}
							/>
						</Board>
					</div>
					<SidePanel onSelectSpace={setSelected} onCompose={setDraft} />
				</main>
			</PresentationProvider>
		</RollClockProvider>
	);
}
