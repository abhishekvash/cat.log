import { notFound } from "@tanstack/react-router";
import { CODE_PATTERN, roomPath } from "#/lib/multiplayer/protocol";
import { seo } from "#/lib/seo";
import type { GameInfo } from "./room-context";

/** One-shot flags on a room link: `new` creates the room, `rejoin` claims a seat. */
export interface RoomSearch {
	new?: boolean;
	rejoin?: string;
}

/**
 * The route options every game's `/<game>/$code` page shares: search flags,
 * code checking, head tags and browser-only rendering.
 */
export function roomRoute(game: GameInfo) {
	return {
		validateSearch: (search: Record<string, unknown>): RoomSearch => ({
			new: search.new === true || search.new === "true" ? true : undefined,
			rejoin: typeof search.rejoin === "string" ? search.rejoin : undefined,
		}),
		beforeLoad: ({ params }: { params: { code: string } }) => {
			if (!CODE_PATTERN.test(params.code)) throw notFound();
		},
		head: ({ params }: { params: { code: string } }) =>
			seo({
				title: `Room ${params.code} · ${game.name} · cat.log`,
				description: `Join a game of ${game.name} on cat.log.`,
				path: roomPath(game.id, params.code),
				noindex: true,
			}),
		// Rooms are live sockets, so the room itself only renders in the browser.
		// "data-only" still runs beforeLoad on the server, so a bad code renders
		// the same not-found page on both sides instead of a hydration mismatch.
		ssr: "data-only" as const,
	};
}
