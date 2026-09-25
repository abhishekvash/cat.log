export const PEGS = 5;
export const ROWS = 10;

// Code pins are cats. The scoring paws are pink and white; a white *cat* is fine
// because pins are always tagged with their kind.
export const CODE_COLORS = [
	"grey",
	"white",
	"black",
	"ginger",
	"siamese",
] as const;
export type CodeColor = (typeof CODE_COLORS)[number];

// pink = right cat in the right spot, white = right cat in the wrong spot.
export const KEY_COLORS = ["pink", "white"] as const;
export type KeyColor = (typeof KEY_COLORS)[number];

export type PinColor = CodeColor | KeyColor;

export type CodeTarget = "secret" | "guess";

export type Phase =
	| "players"
	| "setup"
	| "guessing"
	| "scoring"
	| "won"
	| "lost";

export interface Row {
	guess: (CodeColor | null)[];
	keys: (KeyColor | null)[];
}

/** Two named players who swap roles every round. */
export interface Match {
	players: [string, string];
	scores: [number, number];
	/** 0-based. Player 1 is the mastermind on even rounds, player 2 on odd. */
	round: number;
	/** Points the codebreaker earned in the round that just ended. */
	lastPoints: number | null;
}

export interface GameState {
	match: Match | null;
	phase: Phase;
	secret: (CodeColor | null)[];
	rows: Row[];
	current: number;
}

export type Action =
	| { type: "placeCode"; target: CodeTarget; index: number; color: CodeColor }
	| { type: "clearCode"; target: CodeTarget; index: number }
	| { type: "moveCode"; target: CodeTarget; from: number; to: number }
	| { type: "setKey"; index: number; color: KeyColor | null }
	| { type: "moveKey"; from: number; to: number }
	| { type: "cycleKey"; index: number }
	| { type: "randomSecret" }
	| { type: "startGame" }
	| { type: "submitGuess" }
	| { type: "editGuess" }
	| { type: "confirmScore" }
	| { type: "startMatch"; players: [string, string] }
	| { type: "nextRound" }
	| { type: "reset" };

const empty = <T>(): (T | null)[] => Array.from({ length: PEGS }, () => null);

export function createGame(match: Match | null = null): GameState {
	return {
		match,
		phase: match ? "setup" : "players",
		secret: empty(),
		rows: Array.from({ length: ROWS }, () => ({
			guess: empty(),
			keys: empty(),
		})),
		current: 0,
	};
}

export const isFull = (pins: readonly unknown[]) =>
	pins.every((pin) => pin !== null);

export const mastermindOf = (match: Match) => match.round % 2;
export const breakerOf = (match: Match) => 1 - mastermindOf(match);

/**
 * The codebreaker scores for cracking fast: 10 points on the first try down to 1
 * on the tenth, nothing if the code survives. Roles alternate, so over a pair of
 * rounds both players get the same chance.
 */
export const pointsFor = (attempts: number | null) =>
	attempts === null ? 0 : ROWS + 1 - attempts;

function finishRound(state: GameState, cracked: boolean): GameState {
	const points = pointsFor(cracked ? state.current + 1 : null);
	const match = state.match && {
		...state.match,
		scores: set(
			state.match.scores,
			breakerOf(state.match),
			state.match.scores[breakerOf(state.match)] + points,
		) as [number, number],
		lastPoints: points,
	};
	return { ...state, match, phase: cracked ? "won" : "lost" };
}

/** Which code row (if any) currently accepts pins. */
export function activeCodeTarget(state: GameState): CodeTarget | null {
	if (state.phase === "setup") return "secret";
	if (state.phase === "guessing") return "guess";
	return null;
}

function set<T>(pins: readonly T[], index: number, value: T): T[] {
	const next = [...pins];
	next[index] = value;
	return next;
}

function swap<T>(pins: readonly T[], from: number, to: number): T[] {
	const next = [...pins];
	[next[from], next[to]] = [next[to], next[from]];
	return next;
}

function updateCurrentRow(state: GameState, patch: Partial<Row>): GameState {
	const rows = [...state.rows];
	rows[state.current] = { ...rows[state.current], ...patch };
	return { ...state, rows };
}

function updateCode(
	state: GameState,
	target: CodeTarget,
	fn: (pins: (CodeColor | null)[]) => (CodeColor | null)[],
): GameState {
	if (activeCodeTarget(state) !== target) return state;
	if (target === "secret") return { ...state, secret: fn(state.secret) };
	return updateCurrentRow(state, {
		guess: fn(state.rows[state.current].guess),
	});
}

function updateKeys(
	state: GameState,
	fn: (keys: (KeyColor | null)[]) => (KeyColor | null)[],
): GameState {
	if (state.phase !== "scoring") return state;
	return updateCurrentRow(state, { keys: fn(state.rows[state.current].keys) });
}

const nextKey: Record<string, KeyColor | null> = {
	empty: "pink",
	pink: "white",
	white: null,
};

export function reducer(state: GameState, action: Action): GameState {
	switch (action.type) {
		case "placeCode":
			return updateCode(state, action.target, (pins) =>
				set(pins, action.index, action.color),
			);
		case "clearCode":
			return updateCode(state, action.target, (pins) =>
				set(pins, action.index, null),
			);
		case "moveCode":
			return updateCode(state, action.target, (pins) =>
				swap(pins, action.from, action.to),
			);
		case "setKey":
			return updateKeys(state, (keys) => set(keys, action.index, action.color));
		case "moveKey":
			return updateKeys(state, (keys) => swap(keys, action.from, action.to));
		case "cycleKey":
			return updateKeys(state, (keys) =>
				set(keys, action.index, nextKey[keys[action.index] ?? "empty"]),
			);
		case "randomSecret":
			if (state.phase !== "setup") return state;
			return {
				...state,
				secret: Array.from(
					{ length: PEGS },
					() => CODE_COLORS[Math.floor(Math.random() * CODE_COLORS.length)],
				),
			};
		case "startGame":
			if (state.phase !== "setup" || !isFull(state.secret)) return state;
			return { ...state, phase: "guessing" };
		case "submitGuess": {
			const { guess } = state.rows[state.current];
			if (state.phase !== "guessing" || !isFull(guess)) return state;
			// A perfect guess needs no scoring: fill in the pinks and end the round.
			if (guess.every((cat, i) => cat === state.secret[i]))
				return finishRound(
					updateCurrentRow(state, { keys: guess.map(() => "pink") }),
					true,
				);
			return { ...state, phase: "scoring" };
		}
		case "editGuess":
			if (state.phase !== "scoring") return state;
			return {
				...updateCurrentRow(state, { keys: empty() }),
				phase: "guessing",
			};
		case "confirmScore": {
			if (state.phase !== "scoring") return state;
			const { keys } = state.rows[state.current];
			if (keys.every((key) => key === "pink")) return finishRound(state, true);
			if (state.current === ROWS - 1) return finishRound(state, false);
			return { ...state, phase: "guessing", current: state.current + 1 };
		}
		case "startMatch":
			if (state.phase !== "players") return state;
			return createGame({
				players: action.players,
				scores: [0, 0],
				round: 0,
				lastPoints: null,
			});
		case "nextRound":
			if (!state.match || (state.phase !== "won" && state.phase !== "lost"))
				return state;
			return createGame({
				...state.match,
				round: state.match.round + 1,
				lastPoints: null,
			});
		case "reset":
			return createGame();
	}
}

// Bumped when pin values change so old saves don't load unknown pins.
const STORAGE_KEY = "mastermind:game:v4";

export function loadGame(): GameState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as GameState;
			if (
				"match" in parsed &&
				parsed.rows?.length === ROWS &&
				parsed.secret?.length === PEGS
			)
				return parsed;
		}
	} catch {
		// Corrupt or unavailable storage: fall through to a fresh game.
	}
	return createGame();
}

export function saveGame(state: GameState) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Private mode / quota: the game still works, it just won't survive a reload.
	}
}
