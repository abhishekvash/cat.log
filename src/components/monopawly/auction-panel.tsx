import { Button } from "#/components/ui/button";
import { BOARD, isOwnable } from "#/lib/monopawly/board";
import { playerById } from "#/lib/monopawly/selectors";
import { AUCTION_CLOCK_MS } from "#/lib/monopawly/types";
import { useServerNow } from "./bits";
import { SpaceTitle } from "./space-card";
import { FishIcon, withFish } from "./tile-art";
import { useGame } from "./use-game";

/** A live auction: the clock, the top bid, and quick bid buttons. */
export function AuctionPanel() {
	const { state, me, live, clockOffset, move } = useGame();
	const auction = state.auction;
	const now = useServerNow(clockOffset);
	if (!auction) return null;
	const space = BOARD[auction.space];
	const leader = playerById(state, auction.highBidder);
	const left = Math.max(0, auction.endsAt - now);
	const canBid = me && !me.bankrupt && live && left > 0;

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
			<p className="text-overline">Auction</p>
			<SpaceTitle index={auction.space} />
			<div className="relative flex size-28 items-center justify-center">
				<ClockRing fraction={Math.min(1, left / AUCTION_CLOCK_MS)} />
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
								onClick={() => move({ type: "bid", amount })}
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
