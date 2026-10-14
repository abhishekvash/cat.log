import { useRoom } from "#/components/multiplayer/room-context";
import { playerById } from "#/lib/meownopoly/selectors";
import type { GameState, HouseRules, Move } from "#/lib/meownopoly/types";

/** The room typed for Meownopoly. Works in the lobby too, before a game exists. */
export const useMeownopolyRoom = () => useRoom<GameState, Move, HouseRules>();

/**
 * The game as every Meownopoly screen sees it: the state on screen (held back
 * while a move plays out), your player (if you're in it) and `move` to make
 * one. `live` is false mid-move too, so buttons wait for the cat to arrive.
 * Only for use once the game has started.
 */
export function useGame() {
	const view = useMeownopolyRoom();
	const state = view.room.game;
	if (!state) throw new Error("useGame needs a started game.");
	return {
		...view,
		room: { ...view.room, game: state },
		me: playerById(state, view.seat?.id),
	};
}
