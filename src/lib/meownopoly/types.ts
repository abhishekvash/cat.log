import type { Cat } from "#/lib/cats";
import type { SeatId } from "#/lib/multiplayer/types";
import type { Deck } from "./cards";

/** Bump when `GameState` changes shape; rooms saved by another version end politely. */
export const STATE_VERSION = 4;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const LOG_LIMIT = 200;

/** Every bid restarts the auction clock at this many milliseconds. */
export const AUCTION_CLOCK_MS = 6000;

export interface HouseRules {
	/** Taxes and card fees go into a pot that the Nap Spot pays out. */
	napSpotJackpot: boolean;
	/** Landing exactly on the Food Bowl pays double. */
	doubleFoodBowl: boolean;
	/** Owners at the Vet collect no rent. */
	noRentAtVet: boolean;
	/** Streets a player passes on (or a bankrupt leaves the bank) go to auction. */
	auctions: boolean;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
	napSpotJackpot: false,
	doubleFoodBowl: false,
	noRentAtVet: false,
	auctions: false,
};

export interface Player {
	/** The player's seat in the room; used everywhere a player is referenced. */
	id: SeatId;
	/** Copied from the seat when the game starts (names can't change mid-game). */
	name: string;
	cat: Cat;
	/** May dip below zero: a player in debt must raise fish or go bankrupt. */
	fish: number;
	position: number;
	atVet: boolean;
	/** Failed attempts to roll doubles out of the Vet. */
	vetTries: number;
	getOutCards: Deck[];
	bankrupt: boolean;
	/** What a negative balance is owed, oldest first; adds up to `-fish`. */
	debts: Debt[];
}

/** Fish a player couldn't pay yet. Creditors only get it once it's raised. */
export interface Debt {
	/** The player owed, or null for the bank. */
	to: number | null;
	amount: number;
	/** Bank fees feed the Nap Spot jackpot once paid. */
	fee: boolean;
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
	/** Each bidder's best bid, so a runner-up can win if the top bidder drops out. */
	bids: Record<number, number>;
	endsAt: number;
	/** How long the current clock runs, for the countdown ring. */
	clock: number;
	/** The turn phase to return to once it closes. */
	resume: TurnPhase;
}

/** One leg of a move, for the board to animate: a walk tile by tile, or a jump. */
export interface Step {
	to: number;
	kind: "walk" | "back" | "jump";
	/** The card drawn on arrival, shown while the cat pauses there. */
	card?: { deck: Deck; index: number };
}

/** How the last roll moved its player, leg by leg. Keyed by the roll it came from. */
export interface MovePath {
	roll: number;
	playerId: number;
	from: number;
	steps: Step[];
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

/** One game, from the first roll to the last cat standing. The room owns the lobby. */
export interface GameState {
	phase: "playing" | "finished";
	/** Copied from the room when the game starts. */
	rules: HouseRules;
	/** In turn order. */
	players: Player[];
	/** Keyed by board index; only owned spaces appear. */
	holdings: Record<number, Holding>;
	decks: Record<Deck, number[]>;
	turn: Turn | null;
	auction: Auction | null;
	trades: Trade[];
	nextTradeId: number;
	/** Counts every roll, so each one has an id the dice animation can key on. */
	rolls: number;
	jackpot: number;
	/** The bank's streets from a bankruptcy, waiting their turn at auction. */
	auctionQueue: number[];
	lastMove: MovePath | null;
	bank: { boxes: number; houses: number };
	winnerId: number | null;
	log: LogEntry[];
}

export type Move =
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
	| { type: "sellStreet"; space: number }
	| { type: "mortgage"; space: number }
	| { type: "unmortgage"; space: number }
	| { type: "proposeTrade"; to: number; give: Offer; get: Offer }
	| { type: "respondTrade"; id: number; accept: boolean }
	| { type: "cancelTrade"; id: number }
	| { type: "declareBankruptcy" };
