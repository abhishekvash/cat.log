import { PartySocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ClientMessage,
	partyFor,
	type ServerMessage,
} from "#/lib/multiplayer/protocol";
import type { RoomIntent } from "#/lib/multiplayer/room";
import type { RoomState, SeatId } from "#/lib/multiplayer/types";

export type Status = "connecting" | "live" | "reconnecting" | "gone";

/**
 * What the UI knows about a room. Screens never touch the socket, so a local
 * pass-and-play connection could slot in later without changing them.
 */
export interface RoomConnection<Game, Move, Rules> {
	room: RoomState<Game, Rules> | null;
	/** The viewer's seat, or null for a spectator. */
	me: SeatId | null;
	status: Status;
	/** Server time minus device time, for countdowns. */
	clockOffset: number;
	/** A move in the game. */
	move(move: Move): void;
	/** Something for the room itself: start, leave, house rules, host controls. */
	act(intent: RoomIntent<Rules>): void;
	join(name: string): void;
	issueRejoin(seat: SeatId): void;
	rejoinLink: { seat: SeatId; token: string } | null;
	/** The last thing the server turned down, with a fresh id per message. */
	notice: { id: number; text: string } | null;
}

const tokenKey = (gameId: string, code: string) =>
	`catlog:${gameId}:token:${code}`;

export function useRoomConnection<Game, Move, Rules>(
	gameId: string,
	code: string,
	opts: { create: boolean; rejoin?: string; onTaken: () => void },
): RoomConnection<Game, Move, Rules> {
	const [room, setRoom] = useState<RoomState<Game, Rules> | null>(null);
	const [me, setMe] = useState<SeatId | null>(null);
	const [status, setStatus] = useState<Status>("connecting");
	const [clockOffset, setClockOffset] = useState(0);
	const [notice, setNotice] =
		useState<RoomConnection<Game, Move, Rules>["notice"]>(null);
	const [rejoinLink, setRejoinLink] =
		useState<RoomConnection<Game, Move, Rules>["rejoinLink"]>(null);
	const socketRef = useRef<PartySocket | null>(null);
	const optsRef = useRef(opts);
	optsRef.current = opts;

	useEffect(() => {
		let create = optsRef.current.create;
		let rejoin = optsRef.current.rejoin;
		const key = tokenKey(gameId, code);
		const socket = new PartySocket({
			host: window.location.host,
			party: partyFor(gameId),
			room: code,
		});
		socketRef.current = socket;
		const post = (message: ClientMessage<Move, Rules>) =>
			socket.send(JSON.stringify(message));

		const onOpen = () => {
			const token = localStorage.getItem(key) ?? undefined;
			post({ type: "hello", token, rejoin, create: create && !token });
		};
		const onClose = () => setStatus((s) => (s === "gone" ? s : "reconnecting"));
		const onMessage = (event: MessageEvent) => {
			const message = JSON.parse(event.data) as ServerMessage<Game, Rules>;
			switch (message.type) {
				case "welcome":
					// Only the first connection may create; reconnects just rejoin.
					create = false;
					rejoin = undefined;
					if (message.token) localStorage.setItem(key, message.token);
					setMe(message.seat);
					return;
				case "state":
					setRoom(message.room);
					setClockOffset(message.now - Date.now());
					setStatus("live");
					return;
				case "rejected":
					setNotice({ id: Date.now(), text: message.reason });
					return;
				case "rejoinLink":
					setRejoinLink({ seat: message.seat, token: message.token });
					return;
				case "roomTaken":
					socket.close();
					optsRef.current.onTaken();
					return;
				case "roomGone":
					localStorage.removeItem(key);
					setStatus("gone");
					socket.close();
					return;
			}
		};

		socket.addEventListener("open", onOpen);
		socket.addEventListener("close", onClose);
		socket.addEventListener("message", onMessage);
		return () => {
			socket.removeEventListener("open", onOpen);
			socket.removeEventListener("close", onClose);
			socket.removeEventListener("message", onMessage);
			socket.close();
			socketRef.current = null;
		};
	}, [gameId, code]);

	const post = useCallback((message: ClientMessage<Move, Rules>) => {
		socketRef.current?.send(JSON.stringify(message));
	}, []);

	return {
		room,
		me,
		status,
		clockOffset,
		notice,
		rejoinLink,
		move: useCallback(
			(move: Move) => post({ type: "intent", intent: { type: "move", move } }),
			[post],
		),
		act: useCallback(
			(intent: RoomIntent<Rules>) => post({ type: "intent", intent }),
			[post],
		),
		join: useCallback((name: string) => post({ type: "join", name }), [post]),
		issueRejoin: useCallback(
			(seat: SeatId) => post({ type: "issueRejoin", seat }),
			[post],
		),
	};
}
