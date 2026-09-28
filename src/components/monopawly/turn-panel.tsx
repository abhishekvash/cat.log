import { InfoIcon, MoonIcon, WarningIcon } from "@phosphor-icons/react";
import { CatHead } from "#/components/cats/cat-face";
import { ConfirmAction } from "#/components/confirm-action";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { BOARD, isOwnable, VET_FEE } from "#/lib/monopawly/board";
import { lastRollId, playerById } from "#/lib/monopawly/selectors";
import type { GameState, Player, Turn } from "#/lib/monopawly/types";
import { seatById } from "#/lib/multiplayer/room";
import { cn } from "#/lib/utils";
import { BankruptButton, Fish } from "./bits";
import { RollingDice } from "./dice";
import { FishIcon, withFish } from "./tile-art";
import { useGame } from "./use-game";

/** The board centre between the big moments: whose turn it is and what they can do. */
export function TurnPanel() {
	const { state, me } = useGame();
	const turn = state.turn;
	const current = playerById(state, turn?.playerId);
	if (!turn || !current) return null;

	return (
		<div className="flex min-h-full flex-col items-center text-center">
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
				{turn.dice && (
					<RollingDice dice={turn.dice} rollId={lastRollId(state)} />
				)}
				<h2 className="flex items-center justify-center gap-2 font-display text-lg font-semibold">
					<CatHead cat={current.cat} size="1.5rem" />
					{current.id === me?.id
						? `Your turn, ${current.name}`
						: `${current.name}'s turn`}
				</h2>

				{me && me.fish < 0 && !me.bankrupt && (
					<Alert variant="destructive" className="max-w-measure text-left">
						<WarningIcon />
						<AlertTitle>
							You owe <Fish amount={-me.fish} />
						</AlertTitle>
						<AlertDescription className="gap-2">
							<p>Sell boxes, mortgage streets or trade to cover it.</p>
							<BankruptButton label="Declare bankruptcy" variant="outline" />
						</AlertDescription>
					</Alert>
				)}

				{current.id === me?.id && <TurnActions turn={turn} me={current} />}
				<WanderedOff current={current} />

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

/** Your moves this turn: roll (or get out of the Vet), buy or auction, end. */
function TurnActions({ turn, me }: { turn: Turn; me: Player }) {
	const { live, move } = useGame();
	const space = BOARD[me.position];

	return (
		<div className="flex flex-wrap justify-center gap-2">
			{turn.phase === "awaitingRoll" &&
				(me.atVet ? (
					<>
						<Button
							size="compact-lg"
							disabled={!live}
							onClick={() => move({ type: "roll" })}
						>
							Roll for doubles
						</Button>
						<Button
							size="compact-lg"
							variant="outline"
							disabled={!live || me.fish < VET_FEE}
							onClick={() => move({ type: "payVet" })}
						>
							Pay {VET_FEE}
							<FishIcon /> to leave
						</Button>
						{me.getOutCards.length > 0 && (
							<Button
								size="compact-lg"
								variant="outline"
								disabled={!live}
								onClick={() => move({ type: "useCard" })}
							>
								Use your free pass
							</Button>
						)}
					</>
				) : (
					<Button
						size="compact-lg"
						disabled={!live || me.fish < 0}
						onClick={() => move({ type: "roll" })}
					>
						{turn.rollAgain ? "Doubles! Roll again" : "Roll the dice"}
					</Button>
				))}
			{turn.phase === "awaitingBuy" && isOwnable(space) && (
				<>
					<Button
						size="compact-lg"
						disabled={!live || me.fish < space.price}
						onClick={() => move({ type: "buy" })}
					>
						Buy {space.name} for {space.price}
						<FishIcon />
					</Button>
					<Button
						size="compact-lg"
						variant="outline"
						disabled={!live}
						onClick={() => move({ type: "decline" })}
					>
						Send it to auction
					</Button>
					{me.fish < space.price && (
						<Alert className="text-left">
							<InfoIcon />
							<AlertDescription>
								<p>
									You have {me.fish}
									<FishIcon />. Mortgage a street from My properties, or send it
									to auction.
								</p>
							</AlertDescription>
						</Alert>
					)}
				</>
			)}
			{turn.phase === "postRoll" && (
				<Button
					size="compact-lg"
					disabled={!live || me.fish < 0}
					onClick={() => move({ type: "endTurn" })}
				>
					End turn
				</Button>
			)}
		</div>
	);
}

/** For the host: the current player has wandered off, so skip or remove them. */
function WanderedOff({ current }: { current: Player }) {
	const { room, isHost, me, act } = useGame();
	const seat = seatById(room, current.id);
	if (!isHost || current.id === me?.id || !seat?.away) return null;
	return (
		<Alert className="max-w-measure text-left">
			<MoonIcon />
			<AlertTitle>
				{current.name} wandered off
				{seat.connected ? " mid-turn" : " (disconnected)"}
			</AlertTitle>
			<AlertDescription>
				<div className="flex flex-wrap gap-2 pt-1">
					<Button
						size="compact"
						onClick={() => act({ type: "hostSkip", seat: current.id })}
					>
						Skip their turn
					</Button>
					<ConfirmAction
						title={`Remove ${current.name}?`}
						description="Their streets go back to the bank and they're out of the game."
						action="Remove"
						onConfirm={() => act({ type: "hostRemove", seat: current.id })}
					>
						<Button size="compact" variant="outline">
							Remove them
						</Button>
					</ConfirmAction>
				</div>
			</AlertDescription>
		</Alert>
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
		"max-w-[40ch] text-row text-muted-foreground",
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
			className="flex w-full flex-col items-center gap-1 pt-2 mask-b-from-40%"
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
