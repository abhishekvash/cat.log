import { PlusIcon, StethoscopeIcon } from "@phosphor-icons/react";
import { GameBreadcrumb } from "#/components/catalog/game-breadcrumb";
import { IconHint } from "#/components/multiplayer/icon-hint";
import { RejoinLinkAlert } from "#/components/multiplayer/rejoin-link-alert";
import { SeatList } from "#/components/multiplayer/seat-list";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Separator } from "#/components/ui/separator";
import { MONOPAWLY } from "#/lib/catalog";
import { holdingsOf, playerById } from "#/lib/monopawly/selectors";
import { BankruptButton, Fish } from "./bits";
import { FurSwatch } from "./fur";
import { PropertyList } from "./streets-panel";
import { newDraft, type TradeDraft, TradeList } from "./trade-panel";
import { useGame } from "./use-game";

/** Beside the board: the players and their fish, your trades and your streets. */
export function SidePanel({
	onSelectSpace,
	onCompose,
}: {
	onSelectSpace: (index: number) => void;
	onCompose: (draft: TradeDraft) => void;
}) {
	const { code, state, me } = useGame();
	return (
		<aside className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 landscape:max-w-sm">
			<div className="flex items-center justify-between gap-2 text-sm">
				<GameBreadcrumb to={MONOPAWLY.path}>{MONOPAWLY.title}</GameBreadcrumb>
				<span className="text-muted-foreground">Room {code}</span>
			</div>

			<SeatList
				badges={(seat) => (
					<>
						<FurSwatch cat={seat.cat} />
						{playerById(state, seat.id)?.atVet && (
							<IconHint icon={StethoscopeIcon} label="At the Vet" />
						)}
					</>
				)}
				extra={(seat) => {
					const player = playerById(state, seat.id);
					return (
						player && (
							<Fish amount={player.fish} className="font-display text-sm" />
						)
					);
				}}
			/>

			{me && !me.bankrupt && state.phase === "playing" && (
				<>
					<Separator />
					<section aria-labelledby="trades-heading" className="space-y-2">
						<div className="flex items-center justify-between">
							<h2 id="trades-heading" className="text-overline">
								Trades
							</h2>
							<Button size="compact" onClick={() => onCompose(newDraft())}>
								<PlusIcon />
								Create
							</Button>
						</div>
						<TradeList me={me} onCompose={onCompose} />
					</section>

					<Separator />
					<section
						aria-labelledby="props-heading"
						className="flex min-h-0 flex-1 flex-col gap-1"
					>
						<h2 id="props-heading" className="text-overline">
							My properties ({holdingsOf(state, me.id).length})
						</h2>
						<ScrollArea className="min-h-0 flex-1">
							<PropertyList me={me} onSelect={onSelectSpace} />
						</ScrollArea>
					</section>

					<BankruptButton
						label="Bankrupt"
						variant="ghost"
						className="self-end"
					/>
				</>
			)}

			<RejoinLinkAlert />
		</aside>
	);
}
