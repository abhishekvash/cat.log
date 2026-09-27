import { InfoIcon, MoonIcon, WarningIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmAction } from "#/components/confirm-action";
import { KittenBurst } from "#/components/mastermind/kitten-burst";
import { CatHead } from "#/components/mastermind/pins";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "#/components/ui/table";
import {
	BOARD,
	groupColor,
	isOwnable,
	mortgageValue,
	VET_FEE,
} from "#/lib/monopawly/board";
import type { GameState, Intent } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import {
	byId,
	Fish,
	lastRollId,
	PlayerChip,
	RollingDice,
	useServerNow,
} from "./bits";
import { StreetActions } from "./streets-panel";
import { FishIcon, withFish } from "./tile-art";
import { TradeComposer, type TradeDraft } from "./trade-panel";
import type { GameConnection } from "./use-game";

/**
 * The board's centre: the next move by default, or whatever needs the room
 * right now (results, an auction, a trade being drafted).
 */
export function Center({
	game,
	state,
	draft,
	onDraftChange,
	onCloseDraft,
}: {
	game: GameConnection;
	state: GameState;
	draft: TradeDraft | null;
	onDraftChange: (draft: TradeDraft) => void;
	onCloseDraft: () => void;
}) {
	const me = byId(state, game.me);

	if (state.phase === "finished") return <Results game={game} state={state} />;
	if (state.auction) return <AuctionPanel game={game} state={state} />;
	if (draft && me && !me.bankrupt)
		return (
			<TradeComposer
				game={game}
				state={state}
				me={me}
				draft={draft}
				onChange={onDraftChange}
				onClose={onCloseDraft}
			/>
		);
	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
			<TurnPanel game={game} state={state} />
		</div>
	);
}

function TurnPanel({
	game,
	state,
}: {
	game: GameConnection;
	state: GameState;
}) {
	const turn = state.turn;
	const current = byId(state, turn?.playerId);
	const me = byId(state, game.me);
	if (!turn || !current) return null;
	const mine = current.id === game.me;
	const send = (intent: Intent) => game.send(intent);
	const space = BOARD[current.position];
	const live = game.status === "live";
	const isHost = state.hostId === game.me;

	return (
		<div className="flex min-h-full flex-col items-center text-center">
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
				{turn.dice && (
					<RollingDice dice={turn.dice} rollId={lastRollId(state)} />
				)}
				<div className="space-y-1.5">
					<h2 className="flex items-center justify-center gap-2 font-display text-lg font-semibold">
						<CatHead coat={current.cat} size="1.5rem" />
						{mine ? `Your turn, ${current.name}` : `${current.name}'s turn`}
					</h2>
				</div>

				{me && me.fish < 0 && !me.bankrupt && (
					<Alert variant="destructive" className="max-w-[44ch] text-left">
						<WarningIcon />
						<AlertTitle>
							You owe <Fish amount={-me.fish} />
						</AlertTitle>
						<AlertDescription className="gap-2">
							<p>Sell boxes, mortgage streets or trade to cover it.</p>
							<ConfirmAction
								title="Go bankrupt?"
								description="Everything you own goes to whoever you owe, and you're out. You can keep watching."
								action="Go bankrupt"
								onConfirm={() => send({ type: "declareBankruptcy" })}
							>
								<Button size="compact" variant="outline">
									Declare bankruptcy
								</Button>
							</ConfirmAction>
						</AlertDescription>
					</Alert>
				)}

				{mine && (
					<div className="flex flex-wrap justify-center gap-2">
						{turn.phase === "awaitingRoll" &&
							(current.atVet ? (
								<>
									<Button
										size="compact-lg"
										disabled={!live}
										onClick={() => send({ type: "roll" })}
									>
										Roll for doubles
									</Button>
									<Button
										size="compact-lg"
										variant="outline"
										disabled={!live || current.fish < VET_FEE}
										onClick={() => send({ type: "payVet" })}
									>
										Pay {VET_FEE}
										<FishIcon /> to leave
									</Button>
									{current.getOutCards.length > 0 && (
										<Button
											size="compact-lg"
											variant="outline"
											disabled={!live}
											onClick={() => send({ type: "useCard" })}
										>
											Use your free pass
										</Button>
									)}
								</>
							) : (
								<Button
									size="compact-lg"
									disabled={!live || current.fish < 0}
									onClick={() => send({ type: "roll" })}
								>
									{turn.rollAgain ? "Doubles! Roll again" : "Roll the dice"}
								</Button>
							))}
						{turn.phase === "awaitingBuy" && isOwnable(space) && (
							<>
								<Button
									size="compact-lg"
									disabled={!live || current.fish < space.price}
									onClick={() => send({ type: "buy" })}
								>
									Buy {space.name} for {space.price}
									<FishIcon />
								</Button>
								<Button
									size="compact-lg"
									variant="outline"
									disabled={!live}
									onClick={() => send({ type: "decline" })}
								>
									Send it to auction
								</Button>
								{current.fish < space.price && (
									<Alert className="text-left">
										<InfoIcon />
										<AlertDescription>
											<p>
												You have {current.fish}
												<FishIcon />. Mortgage a street from My properties, or
												send it to auction.
											</p>
										</AlertDescription>
									</Alert>
								)}
							</>
						)}
						{turn.phase === "postRoll" && (
							<Button
								size="compact-lg"
								disabled={!live || current.fish < 0}
								onClick={() => send({ type: "endTurn" })}
							>
								End turn
							</Button>
						)}
					</div>
				)}

				{!mine && isHost && current.away && (
					<Alert className="max-w-[44ch] text-left">
						<MoonIcon />
						<AlertTitle>
							{current.name} wandered off
							{current.connected ? " mid-turn" : " (disconnected)"}
						</AlertTitle>
						<AlertDescription>
							<div className="flex flex-wrap gap-2 pt-1">
								<Button
									size="compact"
									onClick={() =>
										send({ type: "hostSkip", playerId: current.id })
									}
								>
									Skip their turn
								</Button>
								<ConfirmAction
									title={`Remove ${current.name}?`}
									description="Their streets go back to the bank and they're out of the game."
									action="Remove"
									onConfirm={() =>
										send({ type: "hostRemove", playerId: current.id })
									}
								>
									<Button size="compact" variant="outline">
										Remove them
									</Button>
								</ConfirmAction>
							</div>
						</AlertDescription>
					</Alert>
				)}

				{state.rules.napSpotJackpot && (
					<p className="text-sm text-muted-foreground">
						Nap Spot jackpot: <Fish amount={state.jackpot} />
					</p>
				)}
				{me?.bankrupt && (
					<p className="text-sm text-muted-foreground">
						You're out of this game, but you can keep watching.
					</p>
				)}
			</div>
			<ActivityTrail log={state.log} />
		</div>
	);
}

/**
 * The last few things that happened, newest first, tapering and fading out
 * toward the bottom of the board so it never competes with the next move.
 */
function ActivityTrail({ log }: { log: GameState["log"] }) {
	const recent = log.slice(-6).reverse();
	const step = [
		"max-w-[46ch] text-sm text-foreground/90",
		"max-w-[40ch] text-[13px] text-muted-foreground",
		"max-w-[34ch] text-xs text-muted-foreground",
		"max-w-[30ch] text-xs text-muted-foreground",
		"max-w-[26ch] text-xs text-muted-foreground",
		"max-w-[22ch] text-xs text-muted-foreground",
	];
	return (
		<ol
			role="log"
			aria-label="Activity"
			aria-live="polite"
			className="flex w-full flex-col items-center gap-1 pt-2 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
		>
			{recent.map((line, i) => (
				<li
					key={line.id}
					className={cn(
						"w-full",
						i === 0 ? "text-balance" : "truncate",
						step[i],
					)}
				>
					{withFish(line.text)}
				</li>
			))}
		</ol>
	);
}

function AuctionPanel({
	game,
	state,
}: {
	game: GameConnection;
	state: GameState;
}) {
	const auction = state.auction;
	const now = useServerNow(game.clockOffset);
	const me = byId(state, game.me);
	if (!auction) return null;
	const space = BOARD[auction.space];
	const leader = byId(state, auction.highBidder);
	const left = Math.max(0, auction.endsAt - now);
	const canBid = me && !me.bankrupt && game.status === "live" && left > 0;

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
			<p className="text-overline">Auction</p>
			<SpaceTitle index={auction.space} />
			<div className="relative flex size-28 items-center justify-center">
				<ClockRing fraction={Math.min(1, left / 6000)} />
				<div>
					<p className="font-display text-2xl font-semibold tabular-nums">
						{auction.highBid}
						<FishIcon />
					</p>
					<p className="text-sm text-muted-foreground">
						{leader ? leader.name : "No bids yet"}
					</p>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">
				{left > 0
					? withFish(
							`Listed at ${isOwnable(space) ? space.price : 0} 🐟. Every bid restarts the clock.`,
						)
					: "Going, going…"}
			</p>
			{me && !me.bankrupt && (
				<div className="flex flex-wrap justify-center gap-2">
					{[1, 10, 50, 100].map((step) => {
						const amount = auction.highBid + step;
						return (
							<Button
								size="compact"
								key={step}
								variant={step === 10 ? "default" : "outline"}
								disabled={!canBid || amount > me.fish}
								onClick={() => game.send({ type: "bid", amount })}
							>
								+{step} → {amount}
							</Button>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ClockRing({ fraction }: { fraction: number }) {
	const r = 46;
	const length = 2 * Math.PI * r;
	return (
		<svg
			viewBox="0 0 100 100"
			className="absolute inset-0 -rotate-90"
			aria-hidden="true"
		>
			<circle
				cx="50"
				cy="50"
				r={r}
				fill="none"
				stroke="currentColor"
				strokeWidth="4"
				className="text-border"
			/>
			<circle
				cx="50"
				cy="50"
				r={r}
				fill="none"
				strokeWidth="4"
				strokeLinecap="round"
				className="stroke-primary transition-[stroke-dashoffset] duration-100 ease-linear"
				strokeDasharray={length}
				strokeDashoffset={length * (1 - fraction)}
			/>
		</svg>
	);
}

function SpaceTitle({ index }: { index: number }) {
	const space = BOARD[index];
	return (
		<div className="overflow-hidden rounded-md border border-border">
			{space.kind === "street" && (
				<div className="h-3" style={{ background: groupColor(space.group) }} />
			)}
			<h2 className="px-4 py-1.5 font-display text-lg font-semibold">
				{space.name}
			</h2>
		</div>
	);
}

/** A space's card: owner, rent, and your build and mortgage controls. */
export function SpaceCard({
	game,
	state,
	index,
}: {
	game: GameConnection;
	state: GameState;
	index: number;
}) {
	const me = byId(state, game.me);
	const space = BOARD[index];
	const holding = state.holdings[index];
	const owner = byId(state, holding?.owner);
	const rows: [string, number][] =
		space.kind === "street"
			? [
					["Rent", space.rent[0]],
					["Rent with the whole group", space.rent[0] * 2],
					["With 1 box", space.rent[1]],
					["With 2 boxes", space.rent[2]],
					["With 3 boxes", space.rent[3]],
					["With 4 boxes", space.rent[4]],
					["With a cat house", space.rent[5]],
					["Each box or cat house costs", space.buildCost],
				]
			: space.kind === "flap"
				? [
						["Rent with 1 cat flap", 25],
						["With 2 cat flaps", 50],
						["With 3 cat flaps", 100],
						["With all 4", 200],
					]
				: [];

	return (
		<div className="flex flex-col items-center gap-3 text-center text-sm">
			<SpaceTitle index={index} />
			{owner ? (
				<p className="flex items-center gap-2 text-muted-foreground">
					Owned by <PlayerChip player={owner} size="1.25rem" />
					{holding?.mortgaged && " (mortgaged)"}
				</p>
			) : isOwnable(space) ? (
				<p className="text-muted-foreground">
					For sale: {space.price}
					<FishIcon />
				</p>
			) : null}
			{me && !me.bankrupt && holding?.owner === me.id && (
				<StreetActions game={game} state={state} me={me} index={index} />
			)}
			{rows.length > 0 && (
				<div className="w-full">
					<Table>
						<TableBody>
							{rows.map(([label, value]) => (
								<TableRow key={label} className="hover:bg-transparent">
									<TableCell className="h-8 py-1 text-left text-muted-foreground">
										{label}
									</TableCell>
									<TableCell className="h-8 py-1 text-right tabular-nums">
										{value}
										<FishIcon />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
			{space.kind === "utility" && (
				<p className="max-w-[36ch] text-sm text-muted-foreground">
					Rent is 4 times the dice, or 10 times if one cat owns both Laser
					Pointer Co. and Catnip Works.
				</p>
			)}
			{isOwnable(space) && (
				<p className="text-sm text-muted-foreground">
					Mortgage value: {mortgageValue(space)}
					<FishIcon />
				</p>
			)}
			{!isOwnable(space) && (
				<p className="max-w-[36ch] text-muted-foreground">
					{withFish(describe(space.kind))}
				</p>
			)}
		</div>
	);
}

function describe(kind: string) {
	switch (kind) {
		case "foodBowl":
			return "Collect 200 🐟 every time you pass the Food Bowl.";
		case "tax":
			return "Pay the bank when you land here.";
		case "zoomies":
			return "Draw a Zoomies card. Anything can happen.";
		case "treatJar":
			return "Dip into the Treat Jar for a card.";
		case "vet":
			return "Just visiting, unless you were sent here. Leave by rolling doubles, paying 50 🐟 or using a free pass.";
		case "caught":
			return "Caught on the counter! Go straight to the Vet without passing the Food Bowl.";
		case "napSpot":
			return "A free place to nap.";
		default:
			return "";
	}
}

function Results({ game, state }: { game: GameConnection; state: GameState }) {
	const winner = byId(state, state.winnerId);
	const [burst, setBurst] = useState(true);
	const isHost = state.hostId === game.me;
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
			{burst && <KittenBurst onDone={() => setBurst(false)} />}
			{winner && <CatHead coat={winner.cat} size="5rem" />}
			<h2 className="font-display text-2xl font-semibold text-primary">
				{winner ? `${winner.name} is the last cat standing!` : "Game over"}
			</h2>
			<p className="max-w-[40ch] text-muted-foreground">
				This room tidies itself away in a few minutes, or as soon as everyone
				leaves.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				{isHost ? (
					<Button
						size="compact-lg"
						onClick={() => game.send({ type: "playAgain" })}
					>
						Play again
					</Button>
				) : (
					<p className="text-sm text-muted-foreground">
						The host can start another game.
					</p>
				)}
				<Button asChild size="compact-lg" variant="outline">
					<Link to="/">Back to cat.log</Link>
				</Button>
			</div>
		</div>
	);
}
