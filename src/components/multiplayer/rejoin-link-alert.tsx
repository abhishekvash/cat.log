import { LinkIcon } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { roomPath } from "#/lib/multiplayer/protocol";
import { seatById } from "#/lib/multiplayer/room";
import { CopyLink } from "./copy-link";
import { useRoom } from "./room-context";

/** The host's single-use link for moving a disconnected seat to a new device. */
export function RejoinLinkAlert() {
	const { game, code, room, rejoinLink } = useRoom();
	const seat = seatById(room, rejoinLink?.seat);
	// Hidden again once that cat is back online.
	if (!rejoinLink || !seat || seat.connected) return null;
	return (
		<Alert>
			<LinkIcon />
			<AlertDescription className="gap-2">
				<p>
					Send this link to {seat.name} to rejoin from another device. It works
					once.
				</p>
				<CopyLink
					url={`${window.location.origin}${roomPath(game.id, code)}?rejoin=${rejoinLink.token}`}
				/>
			</AlertDescription>
		</Alert>
	);
}
