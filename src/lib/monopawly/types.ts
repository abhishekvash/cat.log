import type { Deck } from "./cards";

export const STATE_VERSION = 1;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const LOG_LIMIT = 200;

/** Every bid restarts the auction clock at this many milliseconds. */
export const AUCTION_CLOCK_MS = 6000;

export const CAT_TOKENS = [
	"grey",
	"white",
	"black",
	"ginger",
	"siamese",
	"calico",
] as const;
export type CatToken = (typeof CAT_TOKENS)[number];

export const CAT_NAMES: Record<CatToken, string> = {
	grey: "Grey tabby",
	white: "Snowy",
	black: "Void",
	ginger: "Ginger",
	siamese: "Siamese",
	calico: "Calico",
};

export interface HouseRules {
	/** Taxes and card fees go into a pot that the Nap Spot pays out. */
	napSpotJackpot: boolean;
	/** Landing exactly on the Food Bowl pays double. */
	doubleFoodBowl: boolean;
	/** Owners at the Vet collect no rent. */
	noRentAtVet: boolean;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
	napSpotJackpot: false,
	doubleFoodBowl: false,
	noRentAtVet: false,
};

export interface Player {
	/** Stable for the life of the room; used everywhere a player is referenced. */
	id: number;
	name: string;
	cat: CatToken;
	/** May dip below zero: a player in debt must raise fish or go bankrupt. */
	fish: number;
	position: number;
	atVet: boolean;
	/** Failed attempts to roll doubles out of the Vet. */
	vetTries: number;
	getOutCards: Deck[];
	bankrupt: boolean;
	/** Who a negative balance is owed to (null = the bank). */
	owesTo: number | null;
	/** Presence, maintained by the room. */
	connected: boolean;
	/** Disconnected or idle for 2+ minutes; the host may skip or remove them. */
	away: boolean;
}

export interface Holding {
	owner: number;
	/** 0 to 4 boxes, 5 = a cat house. */
	buildings: number;
	mortgaged: boolean;
}

export type TurnPhase = "awaitingRoll" | "awaitingBuy" | "auction" | "postRoll";

export interface Turn {
	playerId: number;
	phase: TurnPhase;
	/** Doubles rolled in a row this turn. */
	doubles: number;
	/** The last roll, for the dice display. */
	dice: [number, number] | null;
	/** Rolled doubles, so the player rolls again after this one resolves. */
	rollAgain: boolean;
}

export interface Auction {
	space: number;
	highBid: number;
	highBidder: number | null;
	endsAt: number;
}

export interface Offer {
	fish: number;
	spaces: number[];
	getOutCards: number;
}

export interface Trade {
	id: number;
	from: number;
	to: number;
	/** What `from` hands over. */
	give: Offer;
	/** What `from` asks for in return. */
	get: Offer;
}

export interface LogEntry {
	id: number;
	text: string;
}

export interface GameState {
	version: number;
	phase: "lobby" | "playing" | "finished";
	rules: HouseRules;
	/** In turn order once the game starts. */
	players: Player[];
	hostId: number | null;
	nextPlayerId: number;
	/** Keyed by board index; only owned spaces appear. */
	holdings: Record<number, Holding>;
	decks: Record<Deck, number[]>;
	turn: Turn | null;
	auction: Auction | null;
	trades: Trade[];
	nextTradeId: number;
	jackpot: number;
	bank: { boxes: number; houses: number };
	winnerId: number | null;
	log: LogEntry[];
	/** Bumps on every accepted change. */
	seq: number;
}

export type Intent =
	// Lobby
	| { type: "updateMe"; name?: string; cat?: CatToken }
	| { type: "setRules"; rules: HouseRules }
	| { type: "start" }
	| { type: "leave" }
	| { type: "playAgain" }
	// Turn
	| { type: "roll" }
	| { type: "buy" }
	| { type: "decline" }
	| { type: "bid"; amount: number }
	| { type: "payVet" }
	| { type: "useCard" }
	| { type: "endTurn" }
	// Any time
	| { type: "build"; space: number }
	| { type: "sell"; space: number }
	| { type: "mortgage"; space: number }
	| { type: "unmortgage"; space: number }
	| { type: "proposeTrade"; to: number; give: Offer; get: Offer }
	| { type: "respondTrade"; id: number; accept: boolean }
	| { type: "cancelTrade"; id: number }
	| { type: "declareBankruptcy" }
	// Host
	| { type: "hostSkip"; playerId: number }
	| { type: "hostRemove"; playerId: number };

/** Intents only the room itself may send. */
export type SystemIntent = { type: "auctionClock" };

export interface Context {
	rng: import("./rng").Rng;
	now: number;
}

export type Result =
	| { ok: true; state: GameState }
	| { ok: false; error: string };
