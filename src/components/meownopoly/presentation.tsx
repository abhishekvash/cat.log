import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	RoomProvider,
	type RoomView,
} from "#/components/multiplayer/room-context";
import { BOARD, type GroupId } from "#/lib/meownopoly/board";
import { completeGroups, playerById } from "#/lib/meownopoly/selectors";
import type {
	GameState,
	HouseRules,
	Move,
	MovePath,
	Step,
} from "#/lib/meownopoly/types";
import type { RoomState } from "#/lib/multiplayer/types";
import { prefersReducedMotion } from "#/lib/utils";
import { useRollAge } from "./roll-clock";

/** How long a fresh roll's dice take to land (see RollingDice), before cats walk. */
const DICE_SETTLE_MS = 650;
/** One tile of walking. The glide and the hop both fit inside it. */
export const STEP_MS = 200;
/** Long walks (a card sending a cat round the board) go quicker per tile. */
const FAST_STEP_MS = 110;
const LONG_WALK = 12;
/** A jump (off to the Vet) arcs across the board in one go. */
const JUMP_MS = 560;
/** A beat between legs of a move, so each landing registers. */
const BEAT_MS = 350;
/** Long enough to read a card before it takes effect. */
const CARD_MS = 2200;
/** How long fish changes and newly completed sets stay highlighted. */
const FLASH_MS = 2600;

/** Where the cats stand on screen. Changes every step, so only tokens read it. */
export interface Motion {
	/** Where each cat stands on screen, mid-walk or not. */
	positions: Record<number, number>;
	/** How long the current glide between tiles takes. */
	glideMs: number;
	/** Whether the current leg hops tile by tile or arcs in one jump. */
	leg: "walk" | "jump";
}

interface Presented extends Motion {
	/** The game as it should look right now: held back until moves finish playing. */
	state: GameState;
	/** A move is playing out; its results aren't shown yet. */
	animating: boolean;
	/** The card being read out, while the cat waits on its space. */
	card: Step["card"] | null;
	/** Recent fish changes per player, keyed so each new one replays. */
	deltas: Record<number, { amount: number; key: number }>;
	/** Groups that just became someone's whole set. */
	freshSets: Set<GroupId>;
}

type View = Pick<Presented, "card" | "deltas" | "freshSets">;

const Presentation = createContext<View | null>(null);
const MotionContext = createContext<Motion | null>(null);

const positionsOf = (s: GameState) =>
	Object.fromEntries(s.players.map((p) => [p.id, p.position]));

/**
 * Plays each move out before showing what it caused. Snapshots from the server
 * queue up; one that carries a new roll keeps the previous game on screen
 * while the dice land and the cat walks (pausing on a card space to read the
 * card, then walking or jumping on). Only then does the new state show, so
 * rent, fish, the log and the next prompt never arrive ahead of the cat.
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
	const [shown, setShown] = useState<Presented>(() => ({
		state: live,
		positions: positionsOf(live),
		glideMs: STEP_MS,
		leg: "walk",
		animating: false,
		card: null,
		deltas: {},
		freshSets: new Set(),
	}));
	const queue = useRef<GameState[]>([]);
	const current = useRef(live);
	const busy = useRef(false);
	const alive = useRef(true);
	const flashKey = useRef(0);

	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	useEffect(() => {
		if (live === current.current) return;
		queue.current.push(live);
		if (busy.current) return;
		busy.current = true;

		const sleep = (ms: number) =>
			new Promise<void>((resolve) => window.setTimeout(resolve, ms));

		const commit = (prev: GameState, next: GameState) => {
			const key = ++flashKey.current;
			const deltas: Presented["deltas"] = {};
			for (const p of next.players) {
				const before = playerById(prev, p.id);
				if (before && before.fish !== p.fish)
					deltas[p.id] = { amount: p.fish - before.fish, key };
			}
			const freshSets = new Set<GroupId>();
			for (const p of next.players) {
				const had = completeGroups(prev, p.id);
				for (const g of completeGroups(next, p.id))
					if (!had.has(g)) freshSets.add(g);
			}
			current.current = next;
			setShown((s) => ({
				state: next,
				positions: positionsOf(next),
				glideMs: STEP_MS,
				leg: "walk",
				animating: false,
				card: null,
				deltas: Object.keys(deltas).length ? deltas : s.deltas,
				freshSets: freshSets.size ? freshSets : s.freshSets,
			}));
			if (Object.keys(deltas).length || freshSets.size)
				window.setTimeout(() => {
					if (!alive.current || flashKey.current !== key) return;
					setShown((s) => ({ ...s, deltas: {}, freshSets: new Set() }));
				}, FLASH_MS);
		};

		const play = async (prev: GameState, next: GameState, move: MovePath) => {
			// The old game stays up, but the dice show the new roll.
			const staging: GameState = {
				...prev,
				rolls: next.rolls,
				turn: prev.turn && {
					...prev.turn,
					dice: next.turn?.dice ?? prev.turn.dice,
				},
			};
			const positions = positionsOf(prev);
			const show = (patch: Partial<Presented>) =>
				alive.current &&
				setShown((s) => ({
					...s,
					state: staging,
					positions: { ...positions },
					animating: true,
					...patch,
				}));
			show({ card: null, glideMs: STEP_MS, leg: "walk" });
			await sleep(Math.max(0, DICE_SETTLE_MS - rollAge(next.rolls)));

			let at = move.from;
			for (const [i, leg] of move.steps.entries()) {
				if (!alive.current) return;
				if (i > 0) await sleep(BEAT_MS);
				if (leg.kind === "jump") {
					at = leg.to;
					positions[move.playerId] = at;
					show({ glideMs: JUMP_MS, leg: "jump" });
					await sleep(JUMP_MS);
				} else {
					const dir = leg.kind === "back" ? -1 : 1;
					const tiles = (dir * (leg.to - at) + BOARD.length * 2) % BOARD.length;
					const ms = tiles > LONG_WALK ? FAST_STEP_MS : STEP_MS;
					for (let t = 0; t < tiles; t++) {
						if (!alive.current) return;
						at = (at + dir + BOARD.length) % BOARD.length;
						positions[move.playerId] = at;
						show({ glideMs: ms - 20, leg: "walk" });
						await sleep(ms);
					}
				}
				if (leg.card) {
					show({ card: leg.card });
					await sleep(CARD_MS);
					show({ card: null });
				}
			}
			await sleep(BEAT_MS);
		};

		void (async () => {
			while (alive.current && queue.current.length > 0) {
				const next = queue.current.shift() as GameState;
				const prev = current.current;
				const move = next.lastMove;
				const reduce = prefersReducedMotion();
				const fresh =
					move &&
					move.roll !== prev.lastMove?.roll &&
					next.turn &&
					!reduce &&
					// The roll on screen when the table mounted doesn't replay.
					rollAge(move.roll) !== Infinity;
				if (fresh) await play(prev, next, move);
				if (!alive.current) return;
				commit(prev, next);
			}
			busy.current = false;
		})();
	}, [live, rollAge]);

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
			<Presentation.Provider value={view}>
				<MotionContext.Provider value={motion}>
					{children}
				</MotionContext.Provider>
			</Presentation.Provider>
		</RoomProvider>
	);
}

/** Visual feedback for the displayed game; null outside a game table. */
export const usePresentation = () => useContext(Presentation);

/** Where the cats stand on screen; null outside a game table. */
export const useMotion = () => useContext(MotionContext);
