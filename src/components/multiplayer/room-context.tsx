import { createContext, type ReactNode, useContext } from "react";
import type { GameDefinition, RoomState, Seat } from "#/lib/multiplayer/types";
import type { RoomConnection } from "./use-room";

/** The parts of a game's definition a route needs. */
export type GameInfo = Pick<
	GameDefinition<unknown, unknown, unknown>,
	"id" | "name" | "minPlayers" | "maxPlayers"
>;

/** A live room as every screen inside it sees it. */
export interface RoomView<Game, Move, Rules>
	extends Omit<RoomConnection<Game, Move, Rules>, "me"> {
	/** The game's rules, for asking whose turn it is or who's out. */
	game: GameDefinition<Game, Move, Rules>;
	code: string;
	room: RoomState<Game, Rules>;
	/** The viewer's own seat (undefined for a spectator). */
	seat: Seat | undefined;
	isHost: boolean;
	/** Connected and up to date, so buttons can act. */
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
		<RoomContext.Provider
			value={value as unknown as RoomView<unknown, unknown, unknown>}
		>
			{children}
		</RoomContext.Provider>
	);
}

/** The room this screen is in. Each game wraps this with its own types. */
export function useRoom<Game, Move, Rules>() {
	const room = useContext(RoomContext);
	if (!room) throw new Error("useRoom needs a <RoomGate> above it.");
	return room as unknown as RoomView<Game, Move, Rules>;
}
