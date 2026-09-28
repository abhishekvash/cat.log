import { beforeEach, describe, expect, it } from "vitest";
import {
	type Action,
	activeCodeTarget,
	breakerOf,
	type CodeColor,
	createGame,
	type GameState,
	loadGame,
	mastermindOf,
	PEGS,
	pointsFor,
	ROWS,
	randomCode,
	reducer,
	saveGame,
} from "./mastermind";
import { seededRng } from "./rng";

const SECRET: CodeColor[] = ["grey", "white", "black", "ginger", "siamese"];
const WRONG: CodeColor[] = ["white", "grey", "black", "ginger", "siamese"];

const play = (state: GameState, ...actions: Action[]) =>
	actions.reduce(reducer, state);

const place = (target: "secret" | "guess", code: CodeColor[]): Action[] =>
	code.map((color, index) => ({ type: "placeCode", target, index, color }));

/** A match between Mochi and Biscuit, with the code hidden and guessing open. */
function guessing() {
	return play(
		createGame(),
		{ type: "startMatch", players: ["Mochi", "Biscuit"] },
		...place("secret", SECRET),
		{ type: "startGame" },
	);
}

/** Guess wrong, then score it with two pinks. */
const missAndScore = (state: GameState) =>
	play(
		state,
		...place("guess", WRONG),
		{ type: "submitGuess" },
		{ type: "setKey", index: 0, color: "white" },
		{ type: "setKey", index: 1, color: "white" },
		{ type: "confirmScore" },
	);

describe("a round", () => {
	it("starts with players, then hides the code before guessing", () => {
		let s = createGame();
		expect(s.phase).toBe("players");
		s = reducer(s, { type: "startMatch", players: ["Mochi", "Biscuit"] });
		expect(s.phase).toBe("setup");
		expect(activeCodeTarget(s)).toBe("secret");
		expect(reducer(s, { type: "startGame" })).toBe(s); // the code isn't full yet
		s = play(s, ...place("secret", SECRET), { type: "startGame" });
		expect(s.phase).toBe("guessing");
		expect(activeCodeTarget(s)).toBe("guess");
	});

	it("only lets pins into the row that's open", () => {
		const s = guessing();
		const tried = reducer(s, {
			type: "placeCode",
			target: "secret",
			index: 0,
			color: "black",
		});
		expect(tried).toBe(s);
	});

	it("spots a perfect guess and scores the codebreaker 10 on the first try", () => {
		const s = play(guessing(), ...place("guess", SECRET), {
			type: "submitGuess",
		});
		expect(s.phase).toBe("won");
		expect(s.rows[0].keys).toEqual(Array(PEGS).fill("pink"));
		expect(s.match?.scores).toEqual([0, 10]);
		expect(s.match?.lastPoints).toBe(10);
	});

	it("moves on to the next row after scoring a miss", () => {
		const s = missAndScore(guessing());
		expect(s.phase).toBe("guessing");
		expect(s.current).toBe(1);
		expect(s.rows[0].keys.slice(0, 2)).toEqual(["white", "white"]);
	});

	it("lets the mastermind hand the guess back to be edited", () => {
		let s = play(guessing(), ...place("guess", WRONG), {
			type: "submitGuess",
		});
		expect(s.phase).toBe("scoring");
		s = play(s, { type: "cycleKey", index: 0 }, { type: "editGuess" });
		expect(s.phase).toBe("guessing");
		expect(s.rows[0].keys).toEqual(Array(PEGS).fill(null));
	});

	it("cycles a score hole empty → pink → white → empty", () => {
		let s = play(guessing(), ...place("guess", WRONG), {
			type: "submitGuess",
		});
		const key = () => s.rows[0].keys[2];
		for (const expected of ["pink", "white", null]) {
			s = reducer(s, { type: "cycleKey", index: 2 });
			expect(key()).toBe(expected);
		}
	});

	it("gives the mastermind the round when the tenth guess misses", () => {
		let s = guessing();
		for (let i = 0; i < ROWS; i++) s = missAndScore(s);
		expect(s.phase).toBe("lost");
		expect(s.match?.scores).toEqual([0, 0]);
	});
});

describe("a match", () => {
	it("swaps roles every round and keeps the scores", () => {
		let s = play(guessing(), ...place("guess", SECRET), {
			type: "submitGuess",
		});
		const match = s.match;
		if (!match) throw new Error("no match");
		expect(mastermindOf(match)).toBe(0);
		s = reducer(s, { type: "nextRound" });
		expect(s.phase).toBe("setup");
		expect(s.match?.round).toBe(1);
		expect(s.match && mastermindOf(s.match)).toBe(1);
		expect(s.match && breakerOf(s.match)).toBe(0);
		expect(s.match?.scores).toEqual([0, 10]);
	});

	it("scores 11 minus the tries, and nothing for an uncracked code", () => {
		expect(pointsFor(1)).toBe(10);
		expect(pointsFor(ROWS)).toBe(1);
		expect(pointsFor(null)).toBe(0);
	});

	it("fills a random code only while hiding it", () => {
		const code = randomCode(seededRng(4));
		expect(code).toHaveLength(PEGS);
		const setup = play(createGame(), {
			type: "startMatch",
			players: ["A", "B"],
		});
		expect(
			reducer(setup, { type: "randomSecret", secret: code }).secret,
		).toEqual(code);
		const g = guessing();
		expect(reducer(g, { type: "randomSecret", secret: code })).toBe(g);
	});
});

describe("saving", () => {
	const store = new Map<string, string>();
	beforeEach(() => {
		store.clear();
		globalThis.localStorage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
		} as Storage;
	});

	it("round-trips a game", () => {
		const s = guessing();
		saveGame(s);
		expect(loadGame()).toEqual(s);
	});

	it("still reads saves from before versioning", () => {
		const s = guessing();
		store.set("catlog:meowstermind", JSON.stringify(s));
		expect(loadGame()).toEqual(s);
	});

	it("starts fresh from a save that doesn't look like a game", () => {
		store.set("catlog:meowstermind", JSON.stringify({ phase: "dancing" }));
		expect(loadGame()).toEqual(createGame());
		store.set("catlog:meowstermind", "{not json");
		expect(loadGame()).toEqual(createGame());
	});
});
