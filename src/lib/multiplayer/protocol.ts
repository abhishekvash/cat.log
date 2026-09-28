import type { Intent } from "./room";
import type { RoomState, SeatId } from "./types";

/** What devices and room servers say to each other, for every online game. */

export const MAX_MESSAGE_BYTES = 4096;
export const MAX_SPECTATORS = 10;

export type ClientMessage<Move, Rules> =
	| { type: "hello"; token?: string; rejoin?: string; create?: boolean }
	| { type: "join"; name: string }
	| { type: "intent"; intent: Intent<Move, Rules> }
	| { type: "issueRejoin"; seat: SeatId };

export type ServerMessage<Game, Rules> =
	/** `token` is only sent when it's new, for the client to store. */
	| { type: "welcome"; seat: SeatId | null; token?: string }
	/** `now` is the server clock, so countdowns ignore device clock drift. */
	| { type: "state"; room: RoomState<Game, Rules>; now: number }
	| { type: "rejected"; reason: string }
	| { type: "rejoinLink"; seat: SeatId; token: string }
	| { type: "roomTaken" }
	| { type: "roomGone" };

/**
 * A game's rooms live at /parties/<party>/<code>. partyserver names the party
 * after the game's Durable Object binding in kebab case, so the binding must be
 * `<Id>Room` for a game with id `<id>` (see "Adding an online game" in README).
 */
export const partyFor = (gameId: string) => `${gameId}-room`;

/** Each game's room page lives at /<game id>/<code>. */
export const roomPath = (gameId: string, code: string) => `/${gameId}/${code}`;

/** Room codes skip look-alikes (0/O, 1/I/L) so they read well aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{5}$/;

export function newRoomCode() {
	const bytes = new Uint8Array(5);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
		"",
	);
}
