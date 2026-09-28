import { LinkIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { CatHead } from "#/components/cats/cat-face";
import { Button } from "#/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { Seat, SeatId } from "#/lib/multiplayer/types";
import { cn } from "#/lib/utils";
import { Disconnected, HostCrown } from "./icon-hint";
import { useRoom } from "./room-context";

/**
 * Everyone at the table during a game: whose turn it is, who's out, who's
 * wandered off, and (for the host) new-device links for anyone disconnected.
 * Games add their own bits beside the name (`badges`) and at the end (`extra`).
 */
export function SeatList({
	badges,
	extra,
}: {
	badges?: (seat: Seat) => ReactNode;
	extra?: (seat: Seat) => ReactNode;
}) {
	const { game, room, seat: me, isHost, issueRejoin } = useRoom();
	const current = room.game !== null ? game.currentPlayer(room.game) : null;
	const isOut = (id: SeatId) => room.game !== null && game.isOut(room.game, id);
	return (
		<ul className="space-y-1" aria-label="Players">
			{room.seats.map((seat) => {
				const out = isOut(seat.id);
				return (
					<li
						key={seat.id}
						className={cn(
							"rounded-md border border-transparent px-2.5 py-1.5",
							current === seat.id && "border-primary/50 bg-primary/10",
							out && "opacity-45",
						)}
					>
						<div className="flex items-center gap-2.5">
							<CatHead cat={seat.cat} size="1.4rem" />
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-1.5 font-display text-sm font-medium">
									<span className="truncate">{seat.name}</span>
									{badges?.(seat)}
									{seat.id === me?.id && (
										<span className="text-xs text-muted-foreground">(you)</span>
									)}
									{room.hostId === seat.id && <HostCrown />}
									{!seat.connected && <Disconnected />}
								</span>
								<span className="block text-xs text-muted-foreground">
									{out ? "Out" : seat.away ? "Wandered off 💤" : null}
								</span>
							</span>
							{!out && extra?.(seat)}
							{isHost && !seat.connected && !out && seat.id !== me?.id && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="compact-icon"
											aria-label={`New device link for ${seat.name}`}
											onClick={() => issueRejoin(seat.id)}
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
	);
}
