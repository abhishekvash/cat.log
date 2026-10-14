import { DECK_NAMES, DECKS } from "#/lib/meownopoly/cards";
import type { Step } from "#/lib/meownopoly/types";
import { AuctionPanel } from "./auction-panel";
import { usePresentation } from "./presentation";
import { Results } from "./results";
import { Art, withFish } from "./tile-art";
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
	const card = usePresentation()?.card;
	if (card) return <CardReveal card={card} />;
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

/** The card a cat just drew, read out while it waits on the card space. */
function CardReveal({ card }: { card: NonNullable<Step["card"]> }) {
	const { text } = DECKS[card.deck][card.index];
	return (
		<div className="flex min-h-0 flex-1 items-center justify-center p-6 perspective-distant">
			<output className="card-reveal block w-full max-w-xs space-y-3 rounded-2xl border border-border bg-popover p-6 text-center shadow-table">
				<Art name={card.deck} className="mx-auto size-12" />
				<p className="text-overline">{DECK_NAMES[card.deck]}</p>
				<p className="font-display text-lg text-balance">{withFish(text)}</p>
			</output>
		</div>
	);
}
