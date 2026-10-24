import { createContext, type ReactNode, use } from "react";
import type { ClientGame, RoomState, Seat } from "#/lib/multiplayer/types";
import type { RoomConnection } from "./use-room";

/** The parts of a game's definition a route needs. */
export type GameInfo = Pick<
	ClientGame<unknown>,
	"id" | "name" | "minPlayers" | "maxPlayers"
>;

/** The visible room supplied by the nearest provider, including any staged game. */
export interface RoomView<Game, Move, Rules>
	extends Omit<RoomConnection<Game, Move, Rules>, "me"> {
	/** The game's selectors, for asking whose turn it is or who's out. */
	game: ClientGame<Game>;
	code: string;
	room: RoomState<Game, Rules>;
	/** The viewer's own seat (undefined for a spectator). */
	seat: Seat | undefined;
	isHost: boolean;
	/** Ready for interaction; may be false during presentation while status is live. */
	live: boolean;
}

const RoomContext = createContext<RoomView<unknown, unknown, unknown> | null>(
	null,
);

export function RoomProvider<Game, Move, Rules>({
	value,
	children,
}: {
	value: RoomView<Game, Move, Rules>;
	children: ReactNode;
}) {
	return (
		<RoomContext
			value={value as unknown as RoomView<unknown, unknown, unknown>}
		>
			{children}
		</RoomContext>
	);
}

/** The room this screen is in. Each game wraps this with its own types. */
export function useRoom<Game, Move, Rules>() {
	const room = use(RoomContext);
	if (!room) throw new Error("useRoom needs a <RoomGate> above it.");
	return room as unknown as RoomView<Game, Move, Rules>;
}
