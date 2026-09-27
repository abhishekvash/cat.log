import {
	LinkIcon,
	PlusIcon,
	StethoscopeIcon,
	WifiSlashIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Wordmark } from "#/components/catalog/wordmark";
import { ConfirmAction } from "#/components/confirm-action";
import { CatHead } from "#/components/mastermind/pins";
import { Alert, AlertDescription } from "#/components/ui/alert";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Separator } from "#/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { GAME_NAME } from "#/lib/monopawly/board";
import type { GameState } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import { Fish, HostCrown } from "./bits";
import { CopyLink } from "./copy-link";
import { FurSwatch } from "./fur";
import { PropertyList } from "./streets-panel";
import { newDraft, type TradeDraft, TradeList } from "./trade-panel";
import type { GameConnection } from "./use-game";

export function SidePanel({
	game,
	state,
	code,
	onSelectSpace,
	onCompose,
}: {
	game: GameConnection;
	state: GameState;
	code: string;
	onSelectSpace: (index: number) => void;
	onCompose: (draft: TradeDraft) => void;
}) {
	const isHost = state.hostId === game.me;
	const me = state.players.find((p) => p.id === game.me);
	return (
		<aside className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 landscape:max-w-sm">
			<div className="flex items-center justify-between gap-2 text-sm">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/">
									<Wordmark />
								</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink asChild className="font-display text-foreground">
								<Link to="/monopawly">{GAME_NAME}</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<span className="text-muted-foreground">Room {code}</span>
			</div>

			<ul className="space-y-1" aria-label="Players">
				{state.players.map((p) => {
					const current = state.turn?.playerId === p.id;
					return (
						<li
							key={p.id}
							className={cn(
								"rounded-md border border-transparent px-2.5 py-1.5",
								current && "border-primary/50 bg-primary/10",
								p.bankrupt && "opacity-45",
							)}
						>
							<div className="flex items-center gap-2.5">
								<CatHead coat={p.cat} size="1.4rem" />
								<span className="min-w-0 flex-1">
									<span className="flex items-center gap-1.5 font-display text-sm font-medium">
										<span className="truncate">{p.name}</span>
										<FurSwatch cat={p.cat} />
										{p.id === game.me && (
											<span className="text-xs text-muted-foreground">
												(you)
											</span>
										)}
										{state.hostId === p.id && <HostCrown />}
										{p.atVet && (
											<Tooltip>
												<TooltipTrigger asChild>
													<StethoscopeIcon
														className="size-3.5 text-muted-foreground"
														aria-label="at the Vet"
													/>
												</TooltipTrigger>
												<TooltipContent>At the Vet</TooltipContent>
											</Tooltip>
										)}
										{!p.connected && (
											<Tooltip>
												<TooltipTrigger asChild>
													<WifiSlashIcon
														className="size-3.5 text-muted-foreground"
														aria-label="disconnected"
													/>
												</TooltipTrigger>
												<TooltipContent>Disconnected</TooltipContent>
											</Tooltip>
										)}
									</span>
									<span className="block text-xs text-muted-foreground">
										{p.bankrupt ? "Out" : p.away ? "Wandered off 💤" : null}
									</span>
								</span>
								{!p.bankrupt && (
									<Fish amount={p.fish} className="font-display text-sm" />
								)}
								{isHost && !p.connected && !p.bankrupt && p.id !== game.me && (
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="compact-icon"
												aria-label={`New device link for ${p.name}`}
												onClick={() => game.issueRejoin(p.id)}
											>
												<LinkIcon />
											</Button>
										</TooltipTrigger>
										<TooltipContent>New device link</TooltipContent>
									</Tooltip>
								)}
							</div>
						</li>
					);
				})}
			</ul>

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
						<TradeList
							game={game}
							state={state}
							me={me}
							onCompose={onCompose}
						/>
					</section>

					<Separator />
					<section
						aria-labelledby="props-heading"
						className="flex min-h-0 flex-1 flex-col gap-1"
					>
						<h2 id="props-heading" className="text-overline">
							My properties (
							{
								Object.values(state.holdings).filter((h) => h.owner === me.id)
									.length
							}
							)
						</h2>
						<ScrollArea className="min-h-0 flex-1">
							<PropertyList state={state} me={me} onSelect={onSelectSpace} />
						</ScrollArea>
					</section>

					<ConfirmAction
						title="Go bankrupt?"
						description="Everything you own goes to the bank or whoever you owe, and you're out. You can keep watching."
						action="Go bankrupt"
						onConfirm={() => game.send({ type: "declareBankruptcy" })}
					>
						<Button variant="ghost" size="compact" className="self-end">
							Bankrupt
						</Button>
					</ConfirmAction>
				</>
			)}

			{/* Hidden again once that cat is back online. */}
			{game.rejoinLink &&
				!state.players.find((p) => p.id === game.rejoinLink?.playerId)
					?.connected && (
					<Alert>
						<LinkIcon />
						<AlertDescription className="gap-2">
							<p>
								Send this link to{" "}
								{
									state.players.find((p) => p.id === game.rejoinLink?.playerId)
										?.name
								}{" "}
								to rejoin from another device. It works once.
							</p>
							<CopyLink
								url={`${window.location.origin}/monopawly/${code}?rejoin=${game.rejoinLink.token}`}
							/>
						</AlertDescription>
					</Alert>
				)}
		</aside>
	);
}
