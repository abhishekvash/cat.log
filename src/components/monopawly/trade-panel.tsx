import {
	ArrowsLeftRightIcon,
	PaperPlaneTiltIcon,
	XIcon,
} from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Separator } from "#/components/ui/separator";
import { Slider } from "#/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { BOARD, isOwnable } from "#/lib/monopawly/board";
import {
	activePlayers,
	holdingsOf,
	playerById,
} from "#/lib/monopawly/selectors";
import type { Offer, Player, Trade } from "#/lib/monopawly/types";
import { GroupDot, PlayerChip } from "./bits";
import { FishIcon } from "./tile-art";
import { useGame } from "./use-game";

const empty = (): Offer => ({ fish: 0, spaces: [], getOutCards: 0 });

/** One side of a trade as small chips: streets with their colour, fish, passes. */
function OfferItems({ offer }: { offer: Offer }) {
	if (!offer.spaces.length && !offer.fish && !offer.getOutCards)
		return <span className="text-muted-foreground">Nothing</span>;
	return (
		<span className="flex min-w-0 flex-wrap gap-1">
			{offer.spaces.map((i) => {
				const space = BOARD[i];
				return (
					<Badge key={i} variant="outline" className="font-normal">
						<GroupDot space={space} className="size-2" />
						{space.name}
					</Badge>
				);
			})}
			{offer.fish > 0 && (
				<Badge variant="outline" className="font-normal tabular-nums">
					{offer.fish}
					<FishIcon className="ml-0" />
				</Badge>
			)}
			{offer.getOutCards > 0 && (
				<Badge variant="outline" className="font-normal">
					Free pass{offer.getOutCards > 1 ? ` ×${offer.getOutCards}` : ""}
				</Badge>
			)}
		</span>
	);
}

/** "You give" and "You get" lines, from your side of the table. */
function TradeTerms({ give, get }: { give: Offer; get: Offer }) {
	return (
		<dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1.5 text-xs">
			<dt className="text-muted-foreground">You give</dt>
			<dd>
				<OfferItems offer={give} />
			</dd>
			<dt className="text-muted-foreground">You get</dt>
			<dd>
				<OfferItems offer={get} />
			</dd>
		</dl>
	);
}

/** A trade being drafted in the board centre. */
export interface TradeDraft {
	to: number | null;
	give: Offer;
	get: Offer;
}

export const newDraft = (to: number | null = null): TradeDraft => ({
	to,
	give: empty(),
	get: empty(),
});

/** Offers in and out, one line each, for the side panel. */
export function TradeList({
	me,
	onCompose,
}: {
	me: Player;
	onCompose: (draft: TradeDraft) => void;
}) {
	const { state, move } = useGame();
	const incoming = state.trades.filter((t) => t.to === me.id);
	const outgoing = state.trades.filter((t) => t.from === me.id);
	const respond = (trade: Trade, accept: boolean) =>
		move({ type: "respondTrade", id: trade.id, accept });

	if (incoming.length === 0 && outgoing.length === 0)
		return (
			<p className="text-sm text-muted-foreground">No offers right now.</p>
		);

	return (
		<ul className="space-y-2">
			{incoming.map((trade) => {
				const from = playerById(state, trade.from);
				if (!from) return null;
				return (
					<li key={trade.id}>
						<Card className="gap-2 border-primary/50 bg-primary/10 p-2.5 text-sm shadow-none">
							<p className="flex items-center gap-1.5">
								<PlayerChip player={from} size="1.25rem" />
								<span className="text-muted-foreground">offers you</span>
							</p>
							{/* Their give is your get. */}
							<TradeTerms give={trade.get} get={trade.give} />
							<div className="flex gap-1">
								<Button size="compact" onClick={() => respond(trade, true)}>
									Accept
								</Button>
								<Button
									size="compact"
									variant="outline"
									onClick={() => {
										respond(trade, false);
										onCompose({
											to: trade.from,
											give: { ...trade.get },
											get: { ...trade.give },
										});
									}}
								>
									Counter
								</Button>
								<Button
									size="compact"
									variant="ghost"
									onClick={() => respond(trade, false)}
								>
									Decline
								</Button>
							</div>
						</Card>
					</li>
				);
			})}
			{outgoing.map((trade) => {
				const to = playerById(state, trade.to);
				if (!to) return null;
				return (
					<li key={trade.id}>
						<Card className="gap-2 p-2.5 text-sm shadow-none">
							<div className="flex items-center gap-1.5">
								<PlayerChip player={to} size="1.25rem" />
								<span className="flex-1 text-muted-foreground">
									is thinking…
								</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="compact-icon"
											className="-my-1.5 -mr-1.5"
											aria-label={`Withdraw your offer to ${to.name}`}
											onClick={() =>
												move({ type: "cancelTrade", id: trade.id })
											}
										>
											<XIcon />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Withdraw</TooltipContent>
								</Tooltip>
							</div>
							<TradeTerms give={trade.give} get={trade.get} />
						</Card>
					</li>
				);
			})}
		</ul>
	);
}

/** Builds an offer in the board centre. */
export function TradeComposer({
	me,
	draft,
	onChange,
	onClose,
}: {
	me: Player;
	draft: TradeDraft;
	onChange: (draft: TradeDraft) => void;
	onClose: () => void;
}) {
	const { state, live, move } = useGame();
	const others = activePlayers(state).filter((p) => p.id !== me.id);
	const them = playerById(state, draft.to);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col gap-3 p-4">
			<Button
				variant="ghost"
				size="compact-icon"
				className="absolute top-2 right-2"
				aria-label="Close"
				onClick={onClose}
			>
				<XIcon />
			</Button>
			<p className="text-overline text-center">Create a trade</p>
			<ToggleGroup
				type="single"
				variant="choice"
				spacing={1.5}
				value={draft.to === null ? "" : String(draft.to)}
				onValueChange={(v) => v && onChange(newDraft(Number(v)))}
				aria-label="Trade with"
				className="mx-auto flex-wrap justify-center"
			>
				{others.map((p) => (
					<ToggleGroupItem key={p.id} value={String(p.id)}>
						<PlayerChip player={p} size="1.25rem" />
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{them ? (
				<>
					<ScrollArea className="min-h-0 flex-1">
						<div className="grid grid-cols-[1fr_auto_1fr] gap-3 pr-2">
							<OfferEditor
								owner={me}
								offer={draft.give}
								onChange={(give) => onChange({ ...draft, give })}
							/>
							<div className="flex flex-col items-center gap-2 pt-1 text-muted-foreground">
								<ArrowsLeftRightIcon className="size-5" aria-hidden="true" />
								<Separator orientation="vertical" className="flex-1" />
							</div>
							<OfferEditor
								owner={them}
								offer={draft.get}
								onChange={(get) => onChange({ ...draft, get })}
							/>
						</div>
					</ScrollArea>
					<div className="flex justify-center">
						<Button
							size="compact-lg"
							disabled={!live}
							onClick={() => {
								move({
									type: "proposeTrade",
									to: them.id,
									give: draft.give,
									get: draft.get,
								});
								onClose();
							}}
						>
							<PaperPlaneTiltIcon />
							Send trade
						</Button>
					</div>
				</>
			) : (
				<p className="text-center text-muted-foreground">
					Who do you want to trade with?
				</p>
			)}
		</div>
	);
}

const rowClass =
	"w-full justify-start px-2.5 text-row font-normal text-muted-foreground";

function OfferEditor({
	owner,
	offer,
	onChange,
}: {
	owner: Player;
	offer: Offer;
	onChange: (offer: Offer) => void;
}) {
	const { state } = useGame();
	const tradable = holdingsOf(state, owner.id);
	const max = Math.max(0, owner.fish);

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<p className="flex justify-center">
				<PlayerChip player={owner} size="1.25rem" />
			</p>
			<div className="space-y-1">
				<Slider
					aria-label={`Fish from ${owner.name}`}
					min={0}
					max={Math.max(max, 1)}
					step={10}
					value={[Math.min(offer.fish, max)]}
					disabled={max === 0}
					onValueChange={([fish]) => onChange({ ...offer, fish })}
					className="py-2"
				/>
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>0</span>
					<Badge className="font-semibold">
						{offer.fish}
						<FishIcon />
					</Badge>
					<span>{max}</span>
				</div>
			</div>
			{tradable.length === 0 && owner.getOutCards.length === 0 ? (
				<p className="text-center text-sm text-muted-foreground">
					Nothing to trade.
				</p>
			) : (
				<ToggleGroup
					type="multiple"
					value={[
						...offer.spaces.map(String),
						...(offer.getOutCards ? ["pass"] : []),
					]}
					onValueChange={(values) =>
						onChange({
							...offer,
							spaces: values.filter((v) => v !== "pass").map(Number),
							getOutCards: values.includes("pass") ? 1 : 0,
						})
					}
					variant="choice"
					size="sm"
					spacing={1}
					aria-label={`What ${owner.name} puts in`}
					className="w-full flex-col items-stretch"
				>
					{tradable.map(({ index, holding }) => {
						const space = BOARD[index];
						return (
							<ToggleGroupItem
								key={index}
								value={String(index)}
								className={rowClass}
							>
								<GroupDot space={space} />
								<span className="min-w-0 flex-1 truncate text-left">
									{space.name}
									{holding.mortgaged && " (mortgaged)"}
								</span>
								{isOwnable(space) && (
									<span className="tabular-nums">
										{space.price}
										<FishIcon />
									</span>
								)}
							</ToggleGroupItem>
						);
					})}
					{owner.getOutCards.length > 0 && (
						<ToggleGroupItem value="pass" className={rowClass}>
							<span className="flex-1 text-left">Free pass out of the Vet</span>
						</ToggleGroupItem>
					)}
				</ToggleGroup>
			)}
		</div>
	);
}
