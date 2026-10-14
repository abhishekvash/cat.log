import { useRoom } from "#/components/multiplayer/room-context";
import { playerById } from "#/lib/meownopoly/selectors";
import type { GameState, HouseRules, Move } from "#/lib/meownopoly/types";
import { usePresentation } from "./presentation";

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
	const presented = usePresentation();
	const live = view.room.game;
	if (!live) throw new Error("useGame needs a started game.");
	const state = presented?.state ?? live;
	return {
		...view,
		live: view.live && !presented?.animating,
		state,
		me: playerById(state, view.seat?.id),
	};
}
