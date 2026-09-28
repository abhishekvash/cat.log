import { GAME_NAME } from "#/lib/monopawly/board";
import { MAX_PLAYERS, MIN_PLAYERS } from "#/lib/monopawly/types";

/**
 * Every game on cat.log, in one place: the landing tiles, each game's intro
 * page and its search metadata all read from here. Adding a game is an entry
 * here, its routes, a preview on the landing page and a line in
 * public/sitemap.xml.
 */
export interface CatalogGame {
	path: "/meowstermind" | "/monopawly";
	title: string;
	/** The title split for the two-tone heading: plain, then highlighted. */
	titleParts: [string, string];
	/** The browser tab and share-card title of the intro page. */
	pageTitle: string;
	/** For search and share cards. */
	description: string;
	/** One line for the landing tile. */
	blurb: string;
	tags: string[];
	players: { min: number; max: number };
	genre: string[];
}

export const MEOWSTERMIND: CatalogGame = {
	path: "/meowstermind",
	title: "Meowstermind",
	titleParts: ["Meow", "stermind"],
	pageTitle: "Meowstermind: a cozy two-player cat Mastermind · cat.log",
	description:
		"Meowstermind is a free two-player Mastermind with cats. Hide a secret row of kitties, then crack it with paw-print clues. Pass and play in your browser, made for iPad.",
	blurb:
		"Hide a secret row of kitties and let your friend crack it with paw-print clues.",
	tags: ["2 players", "Pass & play", "~10 min"],
	players: { min: 2, max: 2 },
	genre: ["Puzzle", "Board game", "Code-breaking"],
};

export const MONOPAWLY: CatalogGame = {
	path: "/monopawly",
	title: GAME_NAME,
	titleParts: ["Mono", "pawly"],
	pageTitle: `${GAME_NAME}: a cozy online property game with cats · cat.log`,
	description: `${GAME_NAME} is a free online property game for ${MIN_PLAYERS} to ${MAX_PLAYERS} cats. Buy streets in a cat town, build cardboard boxes and cat houses, trade, and be the last cat standing. Private rooms, no sign-up.`,
	blurb:
		"Buy up a cat town, stack cardboard boxes into cat houses, and be the last cat with fish.",
	tags: [`${MIN_PLAYERS}–${MAX_PLAYERS} players`, "Online rooms", "~60 min"],
	players: { min: MIN_PLAYERS, max: MAX_PLAYERS },
	genre: ["Board game", "Trading", "Strategy"],
};

export const GAMES: CatalogGame[] = [MEOWSTERMIND, MONOPAWLY];
