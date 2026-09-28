import {
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/react-start/server";
import { routePartykitRequest } from "partyserver";
import { monopawly } from "./lib/monopawly/definition";
import { createRoomServer } from "./server/multiplayer/room-server";

/** One Durable Object class per online game; see wrangler.jsonc for the bindings. */
export class MonopawlyRoom extends createRoomServer(monopawly) {}

const startFetch = createStartHandler(defaultStreamHandler);

// Game rooms live at /parties/<game>-room/<code>; everything else is the site.
export default {
	async fetch(request: Request, env: Env) {
		return (await routePartykitRequest(request, env)) ?? startFetch(request);
	},
} satisfies ExportedHandler<Env>;
