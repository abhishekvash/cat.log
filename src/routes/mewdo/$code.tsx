import { createFileRoute } from "@tanstack/react-router";
import { MewdoRoomTable } from "#/components/mewdo/room-table";
import { RoomGate } from "#/components/multiplayer/room-gate";
import { RoomLobby } from "#/components/multiplayer/room-lobby";
import { roomRoute } from "#/components/multiplayer/room-route";
import { MEWDO } from "#/lib/catalog";
import { mewdoClient } from "#/lib/mewdo/client";

export const Route = createFileRoute("/mewdo/$code")({
	...roomRoute(mewdoClient),
	component: Room,
});

function Room() {
	const { code } = Route.useParams();
	const search = Route.useSearch();
	return (
		// A fresh room per code, so nothing carries over when it changes.
		<RoomGate
			key={code}
			game={mewdoClient}
			code={code}
			search={search}
			lobby={<RoomLobby backTo={MEWDO.path} />}
		>
			<MewdoRoomTable />
		</RoomGate>
	);
}
