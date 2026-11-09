import { GAME_NAME } from "#/lib/meownopoly/board";
import { MAX_PLAYERS, MIN_PLAYERS } from "#/lib/meownopoly/types";
import { GAME_NAME as MEWDO_NAME } from "#/lib/mewdo/board";
import {
	MAX_PLAYERS as MEWDO_MAX,
	MIN_PLAYERS as MEWDO_MIN,
} from "#/lib/mewdo/types";

/**
 * Every game on cat.log, in one place: the landing tiles, each game's intro
 * page and its search metadata all read from here. Adding a game is an entry
 * here, its routes, a preview on the landing page and a line in
 * public/sitemap.xml.
 */
export interface CatalogGame {
	path: "/meowstermind" | "/meownopoly" | "/mewdo";
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

export const MEOWNOPOLY: CatalogGame = {
	path: "/meownopoly",
	title: GAME_NAME,
	titleParts: ["Meow", "nopoly"],
	pageTitle: `${GAME_NAME}: a cozy online property game with cats · cat.log`,
	description: `${GAME_NAME} is a free online property game for ${MIN_PLAYERS} to ${MAX_PLAYERS} cats. Buy streets in a cat town, build cardboard boxes and cat houses, trade, and be the last cat standing. Private rooms, no sign-up.`,
	blurb:
		"Buy up a cat town, stack cardboard boxes into cat houses, and be the last cat with fish.",
	tags: [`${MIN_PLAYERS}–${MAX_PLAYERS} players`, "Online rooms", "~60 min"],
	players: { min: MIN_PLAYERS, max: MAX_PLAYERS },
	genre: ["Board game", "Trading", "Strategy"],
};

export const MEWDO: CatalogGame = {
	path: "/mewdo",
	title: MEWDO_NAME,
	titleParts: ["Mew", "do"],
	pageTitle: `${MEWDO_NAME}: a cozy cat race board game for ${MEWDO_MIN} to ${MEWDO_MAX} · cat.log`,
	description: `${MEWDO_NAME} is a free cat take on the classic race game for ${MEWDO_MIN} to ${MEWDO_MAX} players. Roll a 6 to let a kitten out of its basket, boop other kittens home, and race all four to the food bowl. Pass one screen around or play online.`,
	blurb:
		"Roll, hop and boop: race all four kittens from the basket to the food bowl.",
	tags: [
		`${MEWDO_MIN}–${MEWDO_MAX} players`,
		"Pass & play or online",
		"~30 min",
	],
	players: { min: MEWDO_MIN, max: MEWDO_MAX },
	genre: ["Board game", "Race", "Family"],
};

export const GAMES: CatalogGame[] = [MEOWSTERMIND, MEOWNOPOLY, MEWDO];
