import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	RoomProvider,
	type RoomView,
} from "#/components/multiplayer/room-context";
import type { GameState, HouseRules, Move } from "#/lib/meownopoly/types";
import type { RoomState } from "#/lib/multiplayer/types";
import { prefersReducedMotion } from "#/lib/utils";
import {
	createPresentation,
	initialPresentation,
	type Motion,
	type Presented,
} from "./presentation-state";
import { useRollAge } from "./roll-clock";

export { STEP_MS } from "./presentation-state";

type View = Pick<Presented, "card" | "deltas" | "freshSets">;
const Presentation = createContext<View | null>(null);
const MotionContext = createContext<Motion | null>(null);

/**
 * Plays moves before showing their results. Live auctions interrupt playback so
 * every player can bid immediately, even while other clients are still walking.
 */
export function PresentationProvider({
	value,
	children,
}: {
	value: RoomView<GameState, Move, HouseRules> & {
		room: RoomState<GameState, HouseRules> & { game: GameState };
	};
	children: ReactNode;
}) {
	const live = value.room.game;
	const rollAge = useRollAge();
	const [shown, setShown] = useState(() => initialPresentation(live));
	const controller = useRef<ReturnType<typeof createPresentation> | null>(null);

	useEffect(() => {
		controller.current ??= createPresentation(live, {
			publish: setShown,
			rollAge,
			reducedMotion: prefersReducedMotion,
		});
		controller.current.update(live);
	}, [live, rollAge]);

	useEffect(
		() => () => {
			controller.current?.dispose();
			controller.current = null;
		},
		[],
	);

	const { state, animating, card, deltas, freshSets, positions, glideMs, leg } =
		shown;
	// Split so a walk step re-renders the tokens, not the whole table.
	const room = useMemo(
		() => ({
			...value,
			room: { ...value.room, game: state },
			live: value.live && !animating,
		}),
		[value, state, animating],
	);
	const view = useMemo(
		() => ({ card, deltas, freshSets }),
		[card, deltas, freshSets],
	);
	const motion = useMemo(
		() => ({ positions, glideMs, leg }),
		[positions, glideMs, leg],
	);

	return (
		<RoomProvider value={room}>
			<Presentation value={view}>
				<MotionContext value={motion}>{children}</MotionContext>
			</Presentation>
		</RoomProvider>
	);
}

/** Visual feedback for the displayed game; null outside a game table. */
export const usePresentation = () => use(Presentation);

/** Where the cats stand on screen; null outside a game table. */
export const useMotion = () => use(MotionContext);
