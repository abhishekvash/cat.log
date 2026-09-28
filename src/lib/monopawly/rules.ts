import {
	BOARD,
	CAT_HOUSE,
	groupSpaces,
	isOwnable,
	type OwnableSpace,
	unmortgageCost,
} from "./board";
import { groupHasBuildings, ownsGroup, playerById } from "./selectors";
import type { GameState, Holding } from "./types";

/**
 * "Why not?" for the moves a player can make on their own streets at any time.
 * Each returns the reason as it's shown to the player, or null when the move is
 * allowed. The engine rejects with these, and the UI disables its buttons with
 * the same answers, so the two can't disagree.
 */

type Owned = { space: OwnableSpace; holding: Holding };

function owned(s: GameState, playerId: number, index: number): string | Owned {
	if (s.phase !== "playing") return "The game isn't running.";
	if (s.auction) return "Wait for the auction to finish.";
	const space = BOARD[index];
	const holding = s.holdings[index];
	if (!holding || holding.owner !== playerId || !isOwnable(space))
		return "You don't own that.";
	return { space, holding };
}

export function buildBlocker(
	s: GameState,
	playerId: number,
	index: number,
): string | null {
	const found = owned(s, playerId, index);
	if (typeof found === "string") return found;
	const { space, holding } = found;
	if (space.kind !== "street") return "You can only build on streets.";
	if (!ownsGroup(s, playerId, space.group))
		return `Own all ${groupSpaces(space.group).length} in this group to build.`;
	const group = groupSpaces(space.group).map((i) => s.holdings[i]);
	if (group.some((h) => h.mortgaged))
		return "Lift the mortgages on this group first.";
	if (holding.buildings >= CAT_HOUSE)
		return "That street already has a cat house.";
	if (holding.buildings > Math.min(...group.map((h) => h.buildings)))
		return "Build evenly across the group.";
	const upgrade = holding.buildings === CAT_HOUSE - 1;
	if (upgrade ? s.bank.houses < 1 : s.bank.boxes < 1)
		return `The bank is out of ${upgrade ? "cat houses" : "boxes"}.`;
	if ((playerById(s, playerId)?.fish ?? 0) < space.buildCost)
		return "Not enough fish 🐟";
	return null;
}

export function sellBlocker(
	s: GameState,
	playerId: number,
	index: number,
): string | null {
	const found = owned(s, playerId, index);
	if (typeof found === "string") return found;
	const { space, holding } = found;
	if (space.kind !== "street" || holding.buildings === 0)
		return "Nothing to sell there.";
	const group = groupSpaces(space.group).map((i) => s.holdings[i]);
	if (holding.buildings < Math.max(...group.map((h) => h.buildings)))
		return "Sell evenly across the group.";
	if (holding.buildings === CAT_HOUSE && s.bank.boxes < CAT_HOUSE - 1)
		return "The bank doesn't have 4 boxes to swap back.";
	return null;
}

export function mortgageBlocker(
	s: GameState,
	playerId: number,
	index: number,
): string | null {
	const found = owned(s, playerId, index);
	if (typeof found === "string") return found;
	const { space, holding } = found;
	if (holding.mortgaged) return "It's already mortgaged.";
	if (space.kind === "street" && groupHasBuildings(s, space.group))
		return "Sell the buildings in this group first.";
	return null;
}

export function unmortgageBlocker(
	s: GameState,
	playerId: number,
	index: number,
): string | null {
	const found = owned(s, playerId, index);
	if (typeof found === "string") return found;
	const { space, holding } = found;
	if (!holding.mortgaged) return "It isn't mortgaged.";
	if ((playerById(s, playerId)?.fish ?? 0) < unmortgageCost(space))
		return "Not enough fish 🐟";
	return null;
}
