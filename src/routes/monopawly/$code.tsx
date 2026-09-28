import { createFileRoute } from "@tanstack/react-router";
import { HouseRules } from "#/components/monopawly/house-rules";
import { MonopawlyTable } from "#/components/monopawly/table";
import { withFish } from "#/components/monopawly/tile-art";
import { RoomGate } from "#/components/multiplayer/room-gate";
import { RoomLobby } from "#/components/multiplayer/room-lobby";
import { roomRoute } from "#/components/multiplayer/room-route";
import { MONOPAWLY } from "#/lib/catalog";
import { monopawly } from "#/lib/monopawly/definition";

export const Route = createFileRoute("/monopawly/$code")({
	...roomRoute(monopawly),
	component: Room,
});

function Room() {
	const { code } = Route.useParams();
	const search = Route.useSearch();
	return (
		// A fresh room per code, so nothing carries over when it changes.
		<RoomGate
			key={code}
			game={monopawly}
			code={code}
			search={search}
			formatNotice={withFish}
			lobby={<RoomLobby backTo={MONOPAWLY.path} rules={<HouseRules />} />}
		>
			<MonopawlyTable />
		</RoomGate>
	);
}
