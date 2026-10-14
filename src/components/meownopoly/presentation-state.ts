import { BOARD, type GroupId } from "#/lib/meownopoly/board";
import { completeGroups, playerById } from "#/lib/meownopoly/selectors";
import type { GameState, MovePath, Step } from "#/lib/meownopoly/types";

/** How long fresh dice take to land before cats walk (see RollingDice). */
const DICE_SETTLE_MS = 650;
/** One tile of walking. The glide and hop both fit inside it. */
export const STEP_MS = 200;
const FAST_STEP_MS = 110;
const LONG_WALK = 12;
const JUMP_MS = 560;
const BEAT_MS = 350;
const CARD_MS = 2200;
const FLASH_MS = 2600;

/** Where the cats stand on screen. Only tokens need updates on each step. */
export interface Motion {
	positions: Record<number, number>;
	glideMs: number;
	leg: "walk" | "jump";
}

export interface Presented extends Motion {
	/** Results are held back until movement finishes, except for live auctions. */
	state: GameState;
	animating: boolean;
	card: Step["card"] | null;
	deltas: Record<number, { amount: number; key: number }>;
	freshSets: Set<GroupId>;
}

const positionsOf = (s: GameState) =>
	Object.fromEntries(s.players.map((p) => [p.id, p.position]));

export function initialPresentation(state: GameState): Presented {
	return {
		state,
		positions: positionsOf(state),
		glideMs: STEP_MS,
		leg: "walk",
		animating: false,
		card: null,
		deltas: {},
		freshSets: new Set(),
	};
}

/**
 * Owns snapshot playback and feedback expiry. Auctions interrupt playback so
 * every client can bid against the server clock, regardless of motion settings.
 * Disposing cancels timers and prevents any pending work from publishing.
 */
export function createPresentation(
	initial: GameState,
	options: {
		publish: (shown: Presented) => void;
		rollAge: (roll: number | undefined) => number;
		reducedMotion: () => boolean;
	},
) {
	let shown = initialPresentation(initial);
	let current = initial;
	const queue: GameState[] = [];
	let busy = false;
	let disposed = false;
	let generation = 0;
	let flashKey = 0;
	let flashTimer: ReturnType<typeof setTimeout> | undefined;
	let delay:
		| {
				timer: ReturnType<typeof setTimeout>;
				resolve: () => void;
		  }
		| undefined;

	const publish = (next: Presented) => {
		if (disposed) return;
		shown = next;
		options.publish(shown);
	};
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => {
			delay = {
				resolve,
				timer: setTimeout(() => {
					delay = undefined;
					resolve();
				}, ms),
			};
		});

	const cancelPlayback = () => {
		generation++;
		queue.length = 0;
		busy = false;
		if (delay) {
			clearTimeout(delay.timer);
			delay.resolve();
			delay = undefined;
		}
	};

	const commit = (next: GameState) => {
		const deltas: Presented["deltas"] = {};
		for (const p of next.players) {
			const before = playerById(current, p.id);
			if (before && before.fish !== p.fish)
				deltas[p.id] = { amount: p.fish - before.fish, key: flashKey + 1 };
		}
		const freshSets = new Set<GroupId>();
		for (const p of next.players) {
			const had = completeGroups(current, p.id);
			for (const g of completeGroups(next, p.id))
				if (!had.has(g)) freshSets.add(g);
		}
		current = next;
		publish({
			...initialPresentation(next),
			deltas: Object.keys(deltas).length ? deltas : shown.deltas,
			freshSets: freshSets.size ? freshSets : shown.freshSets,
		});
		// A snapshot without new feedback must not invalidate the existing expiry.
		if (Object.keys(deltas).length || freshSets.size) {
			flashKey++;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => {
				flashTimer = undefined;
				publish({ ...shown, deltas: {}, freshSets: new Set() });
			}, FLASH_MS);
		}
	};

	const play = async (
		next: GameState,
		move: MovePath,
		valid: () => boolean,
	) => {
		// Hold the old game on screen, but let the dice show the new roll.
		const staging: GameState = {
			...current,
			rolls: next.rolls,
			turn: current.turn && {
				...current.turn,
				dice: next.turn?.dice ?? current.turn.dice,
			},
		};
		const positions = positionsOf(current);
		const show = (patch: Partial<Presented>) => {
			if (!valid()) return;
			publish({
				...shown,
				state: staging,
				positions: { ...positions },
				animating: true,
				...patch,
			});
		};
		show({ card: null, glideMs: STEP_MS, leg: "walk" });
		await sleep(Math.max(0, DICE_SETTLE_MS - options.rollAge(next.rolls)));
		if (!valid()) return;

		let at = move.from;
		for (const [i, leg] of move.steps.entries()) {
			if (i > 0) {
				await sleep(BEAT_MS);
				if (!valid()) return;
			}
			if (leg.kind === "jump") {
				at = leg.to;
				positions[move.playerId] = at;
				show({ glideMs: JUMP_MS, leg: "jump" });
				await sleep(JUMP_MS);
				if (!valid()) return;
			} else {
				const dir = leg.kind === "back" ? -1 : 1;
				const tiles = (dir * (leg.to - at) + BOARD.length * 2) % BOARD.length;
				const ms = tiles > LONG_WALK ? FAST_STEP_MS : STEP_MS;
				for (let t = 0; t < tiles; t++) {
					at = (at + dir + BOARD.length) % BOARD.length;
					positions[move.playerId] = at;
					show({ glideMs: ms - 20, leg: "walk" });
					await sleep(ms);
					if (!valid()) return;
				}
			}
			if (leg.card) {
				show({ card: leg.card });
				await sleep(CARD_MS);
				if (!valid()) return;
				show({ card: null });
			}
		}
		await sleep(BEAT_MS);
	};

	const drain = async () => {
		busy = true;
		const id = ++generation;
		const valid = () => !disposed && id === generation;
		while (valid() && queue.length > 0) {
			const next = queue.shift() as GameState;
			const move = next.lastMove;
			const fresh =
				move &&
				move.roll !== current.lastMove?.roll &&
				next.turn &&
				!options.reducedMotion() &&
				options.rollAge(move.roll) !== Infinity;
			if (fresh) await play(next, move, valid);
			if (!valid()) return;
			commit(next);
		}
		// A cancelled runner must not release a newer runner's lock.
		if (valid()) busy = false;
	};

	return {
		update(next: GameState) {
			if (disposed || next === current) return;
			if (next.auction) {
				cancelPlayback();
				commit(next);
				return;
			}
			queue.push(next);
			if (!busy) void drain();
		},
		dispose() {
			disposed = true;
			cancelPlayback();
			clearTimeout(flashTimer);
		},
	};
}
