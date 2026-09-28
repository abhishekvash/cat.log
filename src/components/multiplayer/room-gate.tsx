import { Link, useNavigate } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { WakingKitties } from "#/components/catalog/waking-kitties";
import { SleepyScreen } from "#/components/cats/sleepy-screen";
import { Button } from "#/components/ui/button";
import { seatById } from "#/lib/multiplayer/room";
import type { GameDefinition } from "#/lib/multiplayer/types";
import { RoomProvider, type RoomView } from "./room-context";
import type { RoomSearch } from "./room-route";
import { type RoomConnection, useRoomConnection } from "./use-room";
import { useStartRoom } from "./use-start-room";

/**
 * Everything between a room link and the game: connecting, the room having
 * ended, the lobby, and toasts for turned-down moves. Once the room is live,
 * `lobby` or `children` render inside a `RoomProvider`.
 */
export function RoomGate({
	game,
	code,
	search,
	lobby,
	formatNotice = (text) => text,
	children,
}: {
	game: GameDefinition<unknown, unknown, unknown>;
	code: string;
	search: RoomSearch;
	/** Shown while players gather. */
	lobby: ReactNode;
	/** How a game shows the server's messages (e.g. swapping 🐟 for an icon). */
	formatNotice?: (text: string) => ReactNode;
	/** The game itself, once started. Remounted for every new game in the room. */
	children: ReactNode;
}) {
	const navigate = useNavigate();
	const startRoom = useStartRoom(game.id);
	const connection = useRoomConnection<unknown, unknown, unknown>(
		game.id,
		code,
		{
			create: !!search.new,
			rejoin: search.rejoin,
			onTaken: () => startRoom({ replace: true }),
		},
	);
	useRoomToasts(connection, formatNotice);

	// Once in, drop the one-shot flags so a refresh just reconnects.
	useEffect(() => {
		if (connection.me !== null && (search.new || search.rejoin))
			navigate({ to: ".", search: {}, replace: true });
	}, [connection.me, search.new, search.rejoin, navigate]);

	if (connection.status === "gone") return <RoomGone gameId={game.id} />;
	const { room } = connection;
	if (!room) return <WakingKitties />;

	const { me, ...rest } = connection;
	const view: RoomView<unknown, unknown, unknown> = {
		...rest,
		game,
		code,
		room,
		seat: seatById(room, me),
		isHost: room.hostId !== null && room.hostId === me,
		live: connection.status === "live",
	};
	return (
		<RoomProvider value={view}>
			{room.phase === "lobby" ? (
				lobby
			) : (
				<Fragment key={room.round}>{children}</Fragment>
			)}
		</RoomProvider>
	);
}

/** Moves the server turned down, and connection trouble, as Sonner toasts. */
function useRoomToasts(
	connection: RoomConnection<unknown, unknown, unknown>,
	format: (text: string) => ReactNode,
) {
	const { notice, status } = connection;
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new notice is the only trigger
	useEffect(() => {
		if (notice) toast(format(notice.text), { id: notice.id });
	}, [notice]);
	useEffect(() => {
		if (status === "reconnecting")
			toast.loading("Reconnecting…", { id: "reconnect" });
		else toast.dismiss("reconnect");
	}, [status]);
}

function RoomGone({ gameId }: { gameId: string }) {
	const startRoom = useStartRoom(gameId);
	return (
		<SleepyScreen
			title="This game has ended 💤"
			actions={
				<>
					<Button size="compact-lg" onClick={() => startRoom()}>
						Start a new room
					</Button>
					<Button asChild size="compact-lg" variant="outline">
						<Link to="/">Back to cat.log</Link>
					</Button>
				</>
			}
		>
			Rooms tidy themselves away once a game is over or everyone has left.
		</SleepyScreen>
	);
}
