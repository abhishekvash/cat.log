import { useRoom } from "#/components/multiplayer/room-context";
import { playerById } from "#/lib/monopawly/selectors";
import type { GameState, HouseRules, Move } from "#/lib/monopawly/types";

/** The room typed for Monopawly. Works in the lobby too, before a game exists. */
export const useMonopawlyRoom = () => useRoom<GameState, Move, HouseRules>();

/**
 * The game as every Monopawly screen sees it: the live state, your player (if
 * you're in it) and `move` to make one. Only for use once the game has started.
 */
export function useGame() {
	const view = useMonopawlyRoom();
	const state = view.room.game;
	if (!state) throw new Error("useGame needs a started game.");
	return {
		...view,
		state,
		me: playerById(state, view.seat?.id),
	};
}
