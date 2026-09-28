import { AuctionPanel } from "./auction-panel";
import { Results } from "./results";
import { TradeComposer, type TradeDraft } from "./trade-panel";
import { TurnPanel } from "./turn-panel";
import { useGame } from "./use-game";

/**
 * The board's centre: the next move by default, or whatever needs the room
 * right now (results, an auction, a trade being drafted).
 */
export function Center({
	draft,
	onDraftChange,
	onCloseDraft,
}: {
	draft: TradeDraft | null;
	onDraftChange: (draft: TradeDraft) => void;
	onCloseDraft: () => void;
}) {
	const { state, me } = useGame();
	if (state.phase === "finished") return <Results />;
	if (state.auction) return <AuctionPanel />;
	if (draft && me && !me.bankrupt)
		return (
			<TradeComposer
				me={me}
				draft={draft}
				onChange={onDraftChange}
				onClose={onCloseDraft}
			/>
		);
	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
			<TurnPanel />
		</div>
	);
}
