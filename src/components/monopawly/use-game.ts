import { PartySocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ClientMessage,
	PARTY,
	type ServerMessage,
} from "#/lib/monopawly/protocol";
import type { GameState, Intent } from "#/lib/monopawly/types";

export type Status = "connecting" | "live" | "reconnecting" | "gone";

/**
 * What the UI knows about a game. It never touches a socket directly, so a
 * local pass-and-play connection can slot in later without changing the UI.
 */
export interface GameConnection {
	state: GameState | null;
	/** The viewer's player id, or null for a spectator. */
	me: number | null;
	status: Status;
	/** Server time minus device time, for countdowns. */
	clockOffset: number;
	send(intent: Intent): void;
	join(name: string): void;
	issueRejoin(playerId: number): void;
	rejoinLink: { playerId: number; token: string } | null;
	/** The last thing the server turned down, with a fresh id per message. */
	notice: { id: number; text: string } | null;
}

const tokenKey = (code: string) => `monopawly:token:${code}`;

export function usePartyGame(
	code: string,
	opts: { create: boolean; rejoin?: string; onTaken: () => void },
): GameConnection {
	const [state, setState] = useState<GameState | null>(null);
	const [me, setMe] = useState<number | null>(null);
	const [status, setStatus] = useState<Status>("connecting");
	const [clockOffset, setClockOffset] = useState(0);
	const [notice, setNotice] = useState<GameConnection["notice"]>(null);
	const [rejoinLink, setRejoinLink] =
		useState<GameConnection["rejoinLink"]>(null);
	const socketRef = useRef<PartySocket | null>(null);
	const optsRef = useRef(opts);
	optsRef.current = opts;

	useEffect(() => {
		let create = optsRef.current.create;
		let rejoin = optsRef.current.rejoin;
		const socket = new PartySocket({
			host: window.location.host,
			party: PARTY,
			room: code,
		});
		socketRef.current = socket;
		const post = (message: ClientMessage) =>
			socket.send(JSON.stringify(message));

		const onOpen = () => {
			const token = localStorage.getItem(tokenKey(code)) ?? undefined;
			post({ type: "hello", token, rejoin, create: create && !token });
		};
		const onClose = () => setStatus((s) => (s === "gone" ? s : "reconnecting"));
		const onMessage = (event: MessageEvent) => {
			const message = JSON.parse(event.data) as ServerMessage;
			switch (message.type) {
				case "welcome":
					// Only the first connection may create; reconnects just rejoin.
					create = false;
					rejoin = undefined;
					if (message.token)
						localStorage.setItem(tokenKey(code), message.token);
					setMe(message.playerId);
					return;
				case "state":
					setState(message.state);
					setClockOffset(message.now - Date.now());
					setStatus("live");
					return;
				case "rejected":
					setNotice({ id: Date.now(), text: message.reason });
					return;
				case "rejoinLink":
					setRejoinLink({ playerId: message.playerId, token: message.token });
					return;
				case "roomTaken":
					socket.close();
					optsRef.current.onTaken();
					return;
				case "roomGone":
					localStorage.removeItem(tokenKey(code));
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
	}, [code]);

	const post = useCallback((message: ClientMessage) => {
		socketRef.current?.send(JSON.stringify(message));
	}, []);

	return {
		state,
		me,
		status,
		clockOffset,
		notice,
		rejoinLink,
		send: useCallback((intent) => post({ type: "intent", intent }), [post]),
		join: useCallback((name) => post({ type: "join", name }), [post]),
		issueRejoin: useCallback(
			(playerId) => post({ type: "issueRejoin", playerId }),
			[post],
		),
	};
}
