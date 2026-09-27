import {
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/react-start/server";
import { routePartykitRequest } from "partyserver";

export { GameRoom } from "./server/monopawly/game-room";

const startFetch = createStartHandler(defaultStreamHandler);

// Game rooms live at /parties/game-room/<code>; everything else is the site.
export default {
	async fetch(request: Request, env: Env) {
		return (await routePartykitRequest(request, env)) ?? startFetch(request);
	},
} satisfies ExportedHandler<Env>;
