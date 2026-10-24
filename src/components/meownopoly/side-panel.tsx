import { PlusIcon } from "@phosphor-icons/react/Plus";
import { StethoscopeIcon } from "@phosphor-icons/react/Stethoscope";
import { GameBreadcrumb } from "#/components/catalog/game-breadcrumb";
import { IconHint } from "#/components/multiplayer/icon-hint";
import { RejoinLinkAlert } from "#/components/multiplayer/rejoin-link-alert";
import { SeatList } from "#/components/multiplayer/seat-list";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Separator } from "#/components/ui/separator";
import { MEOWNOPOLY } from "#/lib/catalog";
import { holdingsOf, playerById } from "#/lib/meownopoly/selectors";
import { cn } from "#/lib/utils";
import { BankruptButton, Fish } from "./bits";
import { FurSwatch } from "./fur";
import { usePresentation } from "./presentation";
import { PropertyList } from "./streets-panel";
import { useTradeDraftActions } from "./trade-draft";
import { newDraft, TradeList } from "./trade-panel";
import { useGame } from "./use-game";

/** Beside the board: the players and their fish, your trades and your streets. */
export function SidePanel({
	onSelectSpace,
}: {
	onSelectSpace: (index: number) => void;
}) {
	const { compose } = useTradeDraftActions();
	const {
		code,
		room: { game: state },
		me,
	} = useGame();
	const deltas = usePresentation()?.deltas ?? {};
	return (
		<aside className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 landscape:max-w-sm">
			<div className="cat-eyes-occupied flex items-center justify-between gap-2 text-sm">
				<GameBreadcrumb to={MEOWNOPOLY.path}>{MEOWNOPOLY.title}</GameBreadcrumb>
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
					const delta = deltas[seat.id];
					return (
						player && (
							<span className="inline-flex items-center gap-1.5">
								{delta && (
									<span
										key={delta.key}
										className={cn(
											"fish-delta text-xs font-semibold tabular-nums",
											delta.amount > 0 ? "text-primary" : "text-destructive",
										)}
									>
										{delta.amount > 0 ? "+" : "−"}
										{Math.abs(delta.amount)}
									</span>
								)}
								<Fish amount={player.fish} className="font-display text-sm" />
							</span>
						)
					);
				}}
			/>

			{me && !me.bankrupt && state.phase === "playing" && (
				<>
					<Separator />
					<section aria-labelledby="trades-heading" className="space-y-2">
						<div className="cat-eyes-occupied flex items-center justify-between">
							<h2 id="trades-heading" className="text-overline">
								Trades
							</h2>
							<Button size="compact" onClick={() => compose(newDraft())}>
								<PlusIcon />
								Create
							</Button>
						</div>
						<TradeList me={me} onCompose={compose} />
					</section>

					<Separator />
					<section
						aria-labelledby="props-heading"
						className="flex min-h-0 flex-1 flex-col gap-1"
					>
						<h2 id="props-heading" className="cat-eyes-occupied text-overline">
							My properties ({holdingsOf(state, me.id).length})
						</h2>
						<ScrollArea className="min-h-0 flex-1">
							<PropertyList me={me} onSelect={onSelectSpace} />
						</ScrollArea>
					</section>

					<BankruptButton
						label="Bankrupt"
						variant="ghost"
						className="cat-eyes-occupied self-end"
					/>
				</>
			)}

			<RejoinLinkAlert />
		</aside>
	);
}
