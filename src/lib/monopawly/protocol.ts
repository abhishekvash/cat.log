import type { GameState, Intent } from "./types";

export const PARTY = "game-room";
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_SPECTATORS = 10;

export type ClientMessage =
	| { type: "hello"; token?: string; rejoin?: string; create?: boolean }
	| { type: "join"; name: string }
	| { type: "intent"; intent: Intent }
	| { type: "issueRejoin"; playerId: number };

export type ServerMessage =
	/** `token` is only sent when it's new, for the client to store. */
	| { type: "welcome"; playerId: number | null; token?: string }
	/** `now` is the server clock, so the auction countdown ignores device clock drift. */
	| { type: "state"; state: GameState; now: number }
	| { type: "rejected"; reason: string }
	| { type: "rejoinLink"; playerId: number; token: string }
	| { type: "roomTaken" }
	| { type: "roomGone" };

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
