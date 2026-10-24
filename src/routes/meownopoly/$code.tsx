import { createFileRoute } from "@tanstack/react-router";
import { HouseRules } from "#/components/meownopoly/house-rules";
import { MeownopolyTable } from "#/components/meownopoly/table";
import { withFish } from "#/components/meownopoly/tile-art";
import { RoomGate } from "#/components/multiplayer/room-gate";
import { RoomLobby } from "#/components/multiplayer/room-lobby";
import { roomRoute } from "#/components/multiplayer/room-route";
import { MEOWNOPOLY } from "#/lib/catalog";
import { meownopolyClient } from "#/lib/meownopoly/client";

export const Route = createFileRoute("/meownopoly/$code")({
	...roomRoute(meownopolyClient),
	component: Room,
});

function Room() {
	const { code } = Route.useParams();
	const search = Route.useSearch();
	return (
		// A fresh room per code, so nothing carries over when it changes.
		<RoomGate
			key={code}
			game={meownopolyClient}
			code={code}
			search={search}
			formatNotice={withFish}
			lobby={<RoomLobby backTo={MEOWNOPOLY.path} rules={<HouseRules />} />}
		>
			<MeownopolyTable />
		</RoomGate>
	);
}
