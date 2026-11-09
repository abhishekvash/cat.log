import {
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/react-start/server";
import { routePartykitRequest } from "partyserver";
import { meownopoly } from "./lib/meownopoly/definition";
import { mewdo } from "./lib/mewdo/definition";
import { createRoomServer } from "./server/multiplayer/room-server";

/** One Durable Object class per online game; see wrangler.jsonc for the bindings. */
export class MeownopolyRoom extends createRoomServer(meownopoly) {}
export class MewdoRoom extends createRoomServer(mewdo) {}

const startFetch = createStartHandler(defaultStreamHandler);

// Game rooms live at /parties/<game>-room/<code>; everything else is the site.
export default {
	async fetch(request: Request, env: Env) {
		return (await routePartykitRequest(request, env)) ?? startFetch(request);
	},
} satisfies ExportedHandler<Env>;
