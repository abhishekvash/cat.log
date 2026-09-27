import {
	BANK_BOXES,
	BANK_HOUSES,
	BOARD,
	FOOD_BOWL_PAY,
	groupSpaces,
	isOwnable,
	mortgageValue,
	START_FISH,
	type StreetSpace,
	unmortgageCost,
	VET_FEE,
	VET_INDEX,
} from "./board";
import { DECK_NAMES, DECKS, type Deck } from "./cards";
import { type Rng, rollDie, shuffle } from "./rng";
import {
	AUCTION_CLOCK_MS,
	CAT_TOKENS,
	type CatToken,
	type Context,
	DEFAULT_HOUSE_RULES,
	type GameState,
	type Intent,
	LOG_LIMIT,
	MAX_PLAYERS,
	MIN_PLAYERS,
	type Offer,
	type Player,
	type Result,
	STATE_VERSION,
	type SystemIntent,
	type TurnPhase,
} from "./types";

/** A rule said no. The message is shown to the player as-is. */
class Rejection extends Error {}
function reject(message: string): never {
	throw new Rejection(message);
}

const FLAPS = [5, 15, 25, 35];
const UTILITIES = [12, 28];

export function createGame(): GameState {
	return {
		version: STATE_VERSION,
		phase: "lobby",
		rules: { ...DEFAULT_HOUSE_RULES },
		players: [],
		hostId: null,
		nextPlayerId: 1,
		holdings: {},
		decks: { zoomies: [], treatJar: [] },
		turn: null,
		auction: null,
		trades: [],
		nextTradeId: 1,
		jackpot: 0,
		bank: { boxes: BANK_BOXES, houses: BANK_HOUSES },
		winnerId: null,
		log: [],
		seq: 0,
	};
}

export function cleanName(raw: string) {
	return [...raw]
		.filter((ch) => ch >= " " && ch !== "\u007f")
		.join("")
		.trim()
		.slice(0, 16);
}

/** Seats a newcomer in the lobby. Returns their id so the room can issue a token. */
export function addPlayer(
	state: GameState,
	rawName: string,
):
	| { ok: true; state: GameState; playerId: number }
	| { ok: false; error: string } {
	if (state.phase !== "lobby")
		return { ok: false, error: "This game has already started." };
	if (state.players.length >= MAX_PLAYERS)
		return { ok: false, error: "The room is full." };
	const name = cleanName(rawName);
	if (!name) return { ok: false, error: "Pick a name first." };
	const taken = new Set(state.players.map((p) => p.cat));
	const cat = CAT_TOKENS.find((c) => !taken.has(c)) as CatToken;
	const s = structuredClone(state);
	const id = s.nextPlayerId++;
	s.players.push(newPlayer(id, name, cat));
	s.hostId ??= id;
	log(s, `${name} joined.`);
	s.seq++;
	return { ok: true, state: s, playerId: id };
}

function newPlayer(id: number, name: string, cat: CatToken): Player {
	return {
		id,
		name,
		cat,
		fish: START_FISH,
		position: 0,
		atVet: false,
		vetTries: 0,
		getOutCards: [],
		bankrupt: false,
		owesTo: null,
		connected: true,
		away: false,
	};
}

/**
 * Applies one intent from a player (or the room's clock). Never mutates `state`;
 * a rejected intent changes nothing.
 */
export function reduce(
	state: GameState,
	actor: number | "system",
	intent: Intent | SystemIntent,
	ctx: Context,
): Result {
	const s = structuredClone(state);
	try {
		apply(s, actor, intent, ctx);
	} catch (error) {
		if (error instanceof Rejection) return { ok: false, error: error.message };
		throw error;
	}
	for (const p of s.players) if (p.fish >= 0) p.owesTo = null;
	s.seq++;
	return { ok: true, state: s };
}

function apply(
	s: GameState,
	actor: number | "system",
	intent: Intent | SystemIntent,
	ctx: Context,
) {
	if (intent.type === "auctionClock") {
		if (actor !== "system") reject("Only the clock can do that.");
		return closeAuction(s, ctx.now);
	}
	if (actor === "system") reject("Unknown system intent.");
	const me = player(s, actor);

	switch (intent.type) {
		case "updateMe": {
			inLobby(s);
			if (intent.name !== undefined) {
				const name = cleanName(intent.name);
				if (!name) reject("Pick a name first.");
				me.name = name;
			}
			if (intent.cat !== undefined) {
				if (!CAT_TOKENS.includes(intent.cat)) reject("That's not a cat.");
				if (s.players.some((p) => p.id !== me.id && p.cat === intent.cat))
					reject("Another player has that cat.");
				me.cat = intent.cat;
			}
			return;
		}
		case "setRules": {
			inLobby(s);
			hostOnly(s, me);
			s.rules = {
				napSpotJackpot: !!intent.rules.napSpotJackpot,
				doubleFoodBowl: !!intent.rules.doubleFoodBowl,
				noRentAtVet: !!intent.rules.noRentAtVet,
			};
			return;
		}
		case "start":
			inLobby(s);
			hostOnly(s, me);
			return start(s, ctx.rng);
		case "leave": {
			inLobby(s);
			removeFromLobby(s, me.id);
			log(s, `${me.name} left.`);
			return;
		}
		case "playAgain":
			if (s.phase !== "finished") reject("The game isn't over yet.");
			hostOnly(s, me);
			return playAgain(s);
		case "roll":
			return roll(s, myTurn(s, me, "awaitingRoll"), ctx.rng);
		case "buy":
			return buy(s, myTurn(s, me, "awaitingBuy"));
		case "decline": {
			const p = myTurn(s, me, "awaitingBuy");
			turnOf(s).phase = "auction";
			s.auction = {
				space: p.position,
				highBid: 0,
				highBidder: null,
				endsAt: ctx.now + AUCTION_CLOCK_MS * 2,
			};
			log(s, `${p.name} passed on ${BOARD[p.position].name}. Auction!`);
			return;
		}
		case "bid":
			return bid(s, me, intent.amount, ctx.now);
		case "payVet": {
			const p = myTurn(s, me, "awaitingRoll");
			if (!p.atVet) reject("You're not at the Vet.");
			if (p.fish < VET_FEE) reject("Not enough fish 🐟");
			pay(s, p, null, VET_FEE, true);
			leaveVet(p);
			log(s, `${p.name} paid ${VET_FEE} 🐟 to leave the Vet.`);
			return;
		}
		case "useCard": {
			const p = myTurn(s, me, "awaitingRoll");
			if (!p.atVet) reject("You're not at the Vet.");
			const deck = p.getOutCards.shift();
			if (!deck) reject("You don't have a card to use.");
			returnGetOutCard(s, deck);
			leaveVet(p);
			log(s, `${p.name} used a card to slip out of the Vet.`);
			return;
		}
		case "endTurn": {
			const p = myTurn(s, me, "postRoll");
			if (p.fish < 0)
				reject("Settle your debt first: sell, mortgage or trade.");
			return nextTurn(s);
		}
		case "build":
			return build(s, active(me), intent.space);
		case "sell":
			return sell(s, active(me), intent.space);
		case "mortgage":
			return mortgage(s, active(me), intent.space);
		case "unmortgage":
			return unmortgage(s, active(me), intent.space);
		case "proposeTrade":
			return proposeTrade(s, active(me), intent.to, intent.give, intent.get);
		case "respondTrade":
			return respondTrade(s, active(me), intent.id, intent.accept);
		case "cancelTrade": {
			playing(s);
			const trade = s.trades.find((t) => t.id === intent.id);
			if (!trade || trade.from !== me.id) reject("That offer isn't yours.");
			s.trades = s.trades.filter((t) => t.id !== trade.id);
			return;
		}
		case "declareBankruptcy": {
			playing(s);
			active(me);
			return goBankrupt(s, me, me.fish < 0 ? me.owesTo : null);
		}
		case "hostSkip": {
			playing(s);
			hostOnly(s, me);
			const target = player(s, intent.playerId);
			const turn = turnOf(s);
			if (turn.playerId !== target.id) reject("It isn't their turn.");
			if (!target.away) reject(`${target.name} is still here.`);
			if (turn.phase === "auction") reject("Wait for the auction to finish.");
			log(s, `${me.name} skipped ${target.name}'s turn.`);
			return nextTurn(s);
		}
		case "hostRemove": {
			hostOnly(s, me);
			const target = player(s, intent.playerId);
			if (target.id === me.id) reject("You can't remove yourself.");
			if (s.phase === "lobby") {
				removeFromLobby(s, target.id);
				log(s, `${target.name} was removed.`);
				return;
			}
			playing(s);
			active(target);
			if (!target.away) reject(`${target.name} is still here.`);
			log(s, `${me.name} removed ${target.name}.`);
			return goBankrupt(s, target, null);
		}
		default:
			intent satisfies never;
			reject("Unknown move.");
	}
}

// ---------------------------------------------------------------- helpers

function player(s: GameState, id: number) {
	const p = s.players.find((p) => p.id === id);
	if (!p) reject("That player isn't in this game.");
	return p;
}

function active(p: Player) {
	if (p.bankrupt) reject("You're out of this game.");
	return p;
}

function inLobby(s: GameState) {
	if (s.phase !== "lobby") reject("The game has already started.");
}

function playing(s: GameState) {
	if (s.phase !== "playing") reject("The game isn't running.");
}

function hostOnly(s: GameState, me: Player) {
	if (s.hostId !== me.id) reject("Only the host can do that.");
}

function turnOf(s: GameState) {
	if (!s.turn) reject("The game isn't running.");
	return s.turn;
}

function myTurn(s: GameState, me: Player, phase: TurnPhase) {
	playing(s);
	const turn = turnOf(s);
	if (turn.playerId !== me.id) reject("It's not your turn.");
	if (turn.phase !== phase) reject(phaseHint(turn.phase));
	return me;
}

function phaseHint(phase: string) {
	switch (phase) {
		case "awaitingBuy":
			return "Buy it or pass it to auction first.";
		case "auction":
			return "Wait for the auction to finish.";
		case "awaitingRoll":
			return "Roll the dice first.";
		default:
			return "You can't do that right now.";
	}
}

function noAuction(s: GameState) {
	if (s.auction) reject("Wait for the auction to finish.");
}

export function log(s: GameState, text: string) {
	const id = (s.log.at(-1)?.id ?? 0) + 1;
	s.log.push({ id, text });
	if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

const activePlayers = (s: GameState) => s.players.filter((p) => !p.bankrupt);

// ---------------------------------------------------------------- lobby

function removeFromLobby(s: GameState, id: number) {
	s.players = s.players.filter((p) => p.id !== id);
	if (s.hostId === id) s.hostId = s.players[0]?.id ?? null;
}

function start(s: GameState, rng: Rng) {
	if (s.players.length < MIN_PLAYERS)
		reject("You need at least two cats to play.");
	s.players = shuffle(s.players, rng).map((p) => ({
		...newPlayer(p.id, p.name, p.cat),
		connected: p.connected,
	}));
	s.decks = {
		zoomies: shuffle(
			DECKS.zoomies.map((_, i) => i),
			rng,
		),
		treatJar: shuffle(
			DECKS.treatJar.map((_, i) => i),
			rng,
		),
	};
	s.holdings = {};
	s.trades = [];
	s.jackpot = 0;
	s.bank = { boxes: BANK_BOXES, houses: BANK_HOUSES };
	s.winnerId = null;
	s.auction = null;
	s.phase = "playing";
	s.turn = freshTurn(s.players[0].id);
	log(s, `The game begins! ${s.players[0].name} goes first.`);
}

function playAgain(s: GameState) {
	// Only the cats still around carry over to the next game.
	s.players = s.players
		.filter((p) => p.connected)
		.map((p) => newPlayer(p.id, p.name, p.cat));
	if (!s.players.some((p) => p.id === s.hostId))
		s.hostId = s.players[0]?.id ?? null;
	s.phase = "lobby";
	s.turn = null;
	s.auction = null;
	s.trades = [];
	s.holdings = {};
	s.winnerId = null;
	s.jackpot = 0;
	log(s, "Back to the lobby for another game.");
}

const freshTurn = (playerId: number) => ({
	playerId,
	phase: "awaitingRoll" as const,
	doubles: 0,
	dice: null,
	rollAgain: false,
});

// ---------------------------------------------------------------- turns

function roll(s: GameState, p: Player, rng: Rng) {
	if (p.fish < 0) reject("Settle your debt first: sell, mortgage or trade.");
	const turn = turnOf(s);
	const dice: [number, number] = [rollDie(rng), rollDie(rng)];
	const sum = dice[0] + dice[1];
	const doubles = dice[0] === dice[1];
	turn.dice = dice;
	turn.rollAgain = false;
	const rolled = `${p.name} rolled ${dice[0]} and ${dice[1]}`;

	if (p.atVet) {
		if (doubles) {
			log(s, `${rolled}: doubles! Out of the Vet.`);
			leaveVet(p);
		} else if (p.vetTries >= 2) {
			log(
				s,
				`${rolled}. Third try, so they pay ${VET_FEE} 🐟 and leave the Vet.`,
			);
			pay(s, p, null, VET_FEE, true);
			leaveVet(p);
		} else {
			p.vetTries++;
			log(s, `${rolled}. Still at the Vet.`);
			turn.phase = "postRoll";
			return;
		}
	} else if (doubles) {
		turn.doubles++;
		if (turn.doubles === 3) {
			log(s, `${rolled}: a third double! Straight to the Vet.`);
			goToVet(s, p);
			return settle(s);
		}
		turn.rollAgain = true;
		log(s, `${rolled}: doubles, roll again after this.`);
	} else {
		log(s, `${rolled}.`);
	}

	moveTo(s, p, (p.position + sum) % BOARD.length, true);
	land(s, p, rng, { dice: sum });
	settle(s);
}

/** After a move resolves, decide what the current player does next. */
function settle(s: GameState) {
	const turn = s.turn;
	if (!turn || turn.phase === "awaitingBuy" || turn.phase === "auction") return;
	const p = s.players.find((p) => p.id === turn.playerId);
	if (!p || p.bankrupt) return nextTurn(s);
	turn.phase = turn.rollAgain && !p.atVet ? "awaitingRoll" : "postRoll";
}

function nextTurn(s: GameState) {
	const turn = turnOf(s);
	const order = s.players;
	const at = order.findIndex((p) => p.id === turn.playerId);
	for (let step = 1; step <= order.length; step++) {
		const next = order[(at + step) % order.length];
		if (!next.bankrupt) {
			s.turn = freshTurn(next.id);
			return;
		}
	}
}

function moveTo(
	s: GameState,
	p: Player,
	target: number,
	collectOnPass: boolean,
) {
	if (collectOnPass && target < p.position) {
		p.fish += FOOD_BOWL_PAY;
		const exact = target === 0 && s.rules.doubleFoodBowl;
		if (exact) p.fish += FOOD_BOWL_PAY;
		log(
			s,
			exact
				? `${p.name} landed right on the Food Bowl: ${FOOD_BOWL_PAY * 2} 🐟!`
				: `${p.name} passed the Food Bowl: +${FOOD_BOWL_PAY} 🐟.`,
		);
	}
	p.position = target;
}

function goToVet(s: GameState, p: Player) {
	p.position = VET_INDEX;
	p.atVet = true;
	p.vetTries = 0;
	if (s.turn?.playerId === p.id) {
		s.turn.rollAgain = false;
		s.turn.doubles = 0;
	}
}

function leaveVet(p: Player) {
	p.atVet = false;
	p.vetTries = 0;
}

interface LandOptions {
	dice?: number;
	/** Zoomies: owned flaps charge double. */
	doubleFlap?: boolean;
	/** Zoomies: owned utilities charge ten times a fresh roll. */
	utilityTimesTen?: boolean;
}

function land(s: GameState, p: Player, rng: Rng, opts: LandOptions): void {
	const space = BOARD[p.position];
	switch (space.kind) {
		case "street":
		case "flap":
		case "utility": {
			const holding = s.holdings[p.position];
			if (!holding) {
				turnOf(s).phase = "awaitingBuy";
				return;
			}
			if (holding.owner === p.id) return;
			const owner = player(s, holding.owner);
			if (holding.mortgaged) {
				log(s, `${space.name} is mortgaged, so no rent.`);
				return;
			}
			if (s.rules.noRentAtVet && owner.atVet) {
				log(s, `${owner.name} is at the Vet, so no rent.`);
				return;
			}
			const rent = rentFor(s, p.position, rng, opts);
			pay(s, p, owner, rent, false);
			log(s, `${p.name} paid ${owner.name} ${rent} 🐟 rent for ${space.name}.`);
			return;
		}
		case "tax":
			pay(s, p, null, space.amount, true);
			log(s, `${p.name} paid the ${space.name}: ${space.amount} 🐟.`);
			return;
		case "zoomies":
			drawCard(s, p, "zoomies", rng);
			return;
		case "treatJar":
			drawCard(s, p, "treatJar", rng);
			return;
		case "caught":
			log(s, `${p.name} was caught on the counter! Off to the Vet.`);
			goToVet(s, p);
			return;
		case "napSpot":
			if (s.rules.napSpotJackpot && s.jackpot > 0) {
				log(s, `${p.name} napped on the jackpot: +${s.jackpot} 🐟!`);
				p.fish += s.jackpot;
				s.jackpot = 0;
			}
			return;
		case "foodBowl":
		case "vet":
			return;
	}
}

export function rentFor(
	s: GameState,
	index: number,
	rng: Rng,
	opts: LandOptions,
) {
	const space = BOARD[index];
	const holding = s.holdings[index];
	if (!holding || !isOwnable(space)) return 0;
	const owns = (list: number[]) =>
		list.filter((i) => s.holdings[i]?.owner === holding.owner).length;

	if (space.kind === "street") {
		if (holding.buildings > 0) return space.rent[holding.buildings];
		return ownsGroup(s, holding.owner, space)
			? space.rent[0] * 2
			: space.rent[0];
	}
	if (space.kind === "flap") {
		const rent = 25 * 2 ** (owns(FLAPS) - 1);
		return opts.doubleFlap ? rent * 2 : rent;
	}
	if (opts.utilityTimesTen) return 10 * (rollDie(rng) + rollDie(rng));
	const dice = opts.dice ?? rollDie(rng) + rollDie(rng);
	return (owns(UTILITIES) === 2 ? 10 : 4) * dice;
}

function ownsGroup(s: GameState, owner: number, space: StreetSpace) {
	return groupSpaces(space.group).every((i) => s.holdings[i]?.owner === owner);
}

/**
 * Moves fish. The payer may go negative; they then owe `to` (or the bank) and
 * must raise fish or go bankrupt. Fees can feed the Nap Spot jackpot.
 */
function pay(
	s: GameState,
	from: Player,
	to: Player | null,
	amount: number,
	fee: boolean,
) {
	from.fish -= amount;
	if (to) to.fish += amount;
	else if (fee && s.rules.napSpotJackpot) s.jackpot += amount;
	if (from.fish < 0) from.owesTo = to?.id ?? null;
}

function drawCard(s: GameState, p: Player, deck: Deck, rng: Rng): void {
	const index = s.decks[deck].shift();
	if (index === undefined) return;
	const card = DECKS[deck][index];
	if (card.effect.type !== "getOut") s.decks[deck].push(index);
	log(s, `${p.name} drew ${DECK_NAMES[deck]}: “${card.text}”`);

	const effect = card.effect;
	const others = activePlayers(s).filter((o) => o.id !== p.id);
	switch (effect.type) {
		case "advance":
			moveTo(s, p, effect.to, true);
			land(s, p, rng, {});
			return;
		case "advanceNearest": {
			const list = effect.kind === "flap" ? FLAPS : UTILITIES;
			const target = list.find((i) => i > p.position) ?? list[0];
			moveTo(s, p, target, true);
			land(
				s,
				p,
				rng,
				effect.kind === "flap"
					? { doubleFlap: true }
					: { utilityTimesTen: true },
			);
			return;
		}
		case "back":
			p.position = (p.position - effect.spaces + BOARD.length) % BOARD.length;
			land(s, p, rng, {});
			return;
		case "collect":
			p.fish += effect.amount;
			return;
		case "pay":
			pay(s, p, null, effect.amount, true);
			return;
		case "collectFromEach":
			for (const o of others) pay(s, o, p, effect.amount, false);
			return;
		case "payEach":
			for (const o of others) pay(s, p, o, effect.amount, false);
			return;
		case "repairs": {
			let total = 0;
			for (const holding of Object.values(s.holdings)) {
				if (holding.owner !== p.id) continue;
				total +=
					holding.buildings === 5
						? effect.perHouse
						: holding.buildings * effect.perBox;
			}
			if (total > 0) pay(s, p, null, total, true);
			return;
		}
		case "goToVet":
			goToVet(s, p);
			return;
		case "getOut":
			p.getOutCards.push(deck);
			return;
	}
}

function returnGetOutCard(s: GameState, deck: Deck) {
	const index = DECKS[deck].findIndex((c) => c.effect.type === "getOut");
	if (!s.decks[deck].includes(index)) s.decks[deck].push(index);
}

// ---------------------------------------------------------------- buying

function buy(s: GameState, p: Player) {
	const space = BOARD[p.position];
	if (!isOwnable(space) || s.holdings[p.position])
		reject("This spot isn't for sale.");
	if (p.fish < space.price) reject("Not enough fish 🐟");
	p.fish -= space.price;
	s.holdings[p.position] = { owner: p.id, buildings: 0, mortgaged: false };
	log(s, `${p.name} bought ${space.name} for ${space.price} 🐟.`);
	turnOf(s).phase = "postRoll";
	settle(s);
}

function bid(s: GameState, me: Player, amount: number, now: number) {
	playing(s);
	active(me);
	const auction = s.auction;
	if (!auction) reject("There's no auction right now.");
	if (now >= auction.endsAt) reject("Too late, the auction is closing.");
	if (!Number.isInteger(amount) || amount <= auction.highBid)
		reject(`Bid more than ${auction.highBid} 🐟.`);
	if (amount > me.fish) reject("Not enough fish 🐟");
	auction.highBid = amount;
	auction.highBidder = me.id;
	auction.endsAt = now + AUCTION_CLOCK_MS;
}

function closeAuction(s: GameState, now: number) {
	const auction = s.auction;
	if (!auction) reject("There's no auction right now.");
	if (now < auction.endsAt) reject("The auction is still running.");
	const space = BOARD[auction.space];
	const winner = s.players.find((p) => p.id === auction.highBidder);
	if (winner && !winner.bankrupt && winner.fish >= auction.highBid) {
		winner.fish -= auction.highBid;
		s.holdings[auction.space] = {
			owner: winner.id,
			buildings: 0,
			mortgaged: false,
		};
		log(s, `${winner.name} won ${space.name} for ${auction.highBid} 🐟.`);
	} else {
		log(s, `Nobody bid on ${space.name}. It stays with the bank.`);
	}
	s.auction = null;
	if (s.turn) s.turn.phase = "postRoll";
	settle(s);
}

// ---------------------------------------------------------------- building

function ownedStreet(s: GameState, p: Player, index: number) {
	playing(s);
	noAuction(s);
	const space = BOARD[index];
	const holding = s.holdings[index];
	if (!holding || holding.owner !== p.id) reject("You don't own that.");
	return { space, holding };
}

function build(s: GameState, p: Player, index: number) {
	const { space, holding } = ownedStreet(s, p, index);
	if (space.kind !== "street") reject("You can only build on streets.");
	if (!ownsGroup(s, p.id, space)) reject("Own the whole street group first.");
	const group = groupSpaces(space.group).map((i) => s.holdings[i]);
	if (group.some((h) => h.mortgaged))
		reject("Lift the mortgages on this group first.");
	if (holding.buildings >= 5) reject("That street already has a cat house.");
	if (holding.buildings > Math.min(...group.map((h) => h.buildings)))
		reject("Build evenly across the group.");
	const upgrade = holding.buildings === 4;
	if (upgrade ? s.bank.houses < 1 : s.bank.boxes < 1)
		reject(`The bank is out of ${upgrade ? "cat houses" : "boxes"}.`);
	if (p.fish < space.buildCost) reject("Not enough fish 🐟");
	p.fish -= space.buildCost;
	if (upgrade) {
		s.bank.houses--;
		s.bank.boxes += 4;
	} else {
		s.bank.boxes--;
	}
	holding.buildings++;
	log(
		s,
		upgrade
			? `${p.name} built a cat house on ${space.name}.`
			: `${p.name} put a box on ${space.name}.`,
	);
}

function sell(s: GameState, p: Player, index: number) {
	const { space, holding } = ownedStreet(s, p, index);
	if (space.kind !== "street" || holding.buildings === 0)
		reject("Nothing to sell there.");
	const group = groupSpaces(space.group).map((i) => s.holdings[i]);
	if (holding.buildings < Math.max(...group.map((h) => h.buildings)))
		reject("Sell evenly across the group.");
	if (holding.buildings === 5) {
		if (s.bank.boxes < 4) reject("The bank doesn't have 4 boxes to swap back.");
		s.bank.boxes -= 4;
		s.bank.houses++;
	} else {
		s.bank.boxes++;
	}
	holding.buildings--;
	const refund = space.buildCost / 2;
	p.fish += refund;
	log(s, `${p.name} sold a building on ${space.name} for ${refund} 🐟.`);
}

function mortgage(s: GameState, p: Player, index: number) {
	const { space, holding } = ownedStreet(s, p, index);
	if (!isOwnable(space)) reject("You can't mortgage that.");
	if (holding.mortgaged) reject("It's already mortgaged.");
	if (
		space.kind === "street" &&
		groupSpaces(space.group).some((i) => (s.holdings[i]?.buildings ?? 0) > 0)
	)
		reject("Sell the buildings in this group first.");
	holding.mortgaged = true;
	const value = mortgageValue(space);
	p.fish += value;
	log(s, `${p.name} mortgaged ${space.name} for ${value} 🐟.`);
}

function unmortgage(s: GameState, p: Player, index: number) {
	const { space, holding } = ownedStreet(s, p, index);
	if (!isOwnable(space) || !holding.mortgaged) reject("It isn't mortgaged.");
	const cost = unmortgageCost(space);
	if (p.fish < cost) reject("Not enough fish 🐟");
	p.fish -= cost;
	holding.mortgaged = false;
	log(s, `${p.name} lifted the mortgage on ${space.name} for ${cost} 🐟.`);
}

// ---------------------------------------------------------------- trading

const MAX_TRADES = 20;

function checkOffer(s: GameState, p: Player, offer: Offer) {
	if (!Number.isInteger(offer.fish) || offer.fish < 0)
		reject("That's not a fish amount.");
	if (offer.fish > Math.max(0, p.fish))
		reject(`${p.name} doesn't have that many fish.`);
	if (!Number.isInteger(offer.getOutCards) || offer.getOutCards < 0)
		reject("That's not a card count.");
	if (offer.getOutCards > p.getOutCards.length)
		reject(`${p.name} doesn't have that many Vet cards.`);
	if (new Set(offer.spaces).size !== offer.spaces.length)
		reject("A street is listed twice.");
	for (const index of offer.spaces) {
		const space = BOARD[index];
		if (!space || s.holdings[index]?.owner !== p.id)
			reject(`${p.name} doesn't own that anymore.`);
		if (
			space.kind === "street" &&
			groupSpaces(space.group).some((i) => (s.holdings[i]?.buildings ?? 0) > 0)
		)
			reject(`Sell the buildings on ${space.name}'s group before trading it.`);
	}
}

const isEmpty = (o: Offer) =>
	o.fish === 0 && o.spaces.length === 0 && o.getOutCards === 0;

function proposeTrade(
	s: GameState,
	me: Player,
	to: number,
	give: Offer,
	get: Offer,
) {
	playing(s);
	noAuction(s);
	const them = active(player(s, to));
	if (them.id === me.id) reject("You can't trade with yourself.");
	const clean = (o: Offer): Offer => ({
		fish: o.fish,
		spaces: [...o.spaces],
		getOutCards: o.getOutCards,
	});
	give = clean(give);
	get = clean(get);
	if (isEmpty(give) && isEmpty(get)) reject("Put something in the offer.");
	checkOffer(s, me, give);
	checkOffer(s, them, get);
	// One open offer per pair, newest wins.
	s.trades = s.trades.filter((t) => !(t.from === me.id && t.to === them.id));
	if (s.trades.length >= MAX_TRADES) reject("Too many open offers right now.");
	s.trades.push({ id: s.nextTradeId++, from: me.id, to: them.id, give, get });
	log(s, `${me.name} sent ${them.name} a trade offer.`);
}

function respondTrade(s: GameState, me: Player, id: number, accept: boolean) {
	playing(s);
	const trade = s.trades.find((t) => t.id === id);
	if (!trade || trade.to !== me.id) reject("That offer isn't for you.");
	s.trades = s.trades.filter((t) => t.id !== id);
	const from = player(s, trade.from);
	if (!accept) {
		log(s, `${me.name} declined ${from.name}'s offer.`);
		return;
	}
	noAuction(s);
	try {
		active(from);
		checkOffer(s, from, trade.give);
		checkOffer(s, me, trade.get);
	} catch (error) {
		if (!(error instanceof Rejection)) throw error;
		log(
			s,
			`${from.name}'s offer to ${me.name} had gone stale, so it was withdrawn.`,
		);
		return;
	}
	const hand = (a: Player, b: Player, offer: Offer) => {
		a.fish -= offer.fish;
		b.fish += offer.fish;
		for (const index of offer.spaces) s.holdings[index].owner = b.id;
		b.getOutCards.push(...a.getOutCards.splice(0, offer.getOutCards));
	};
	hand(from, me, trade.give);
	hand(me, from, trade.get);
	log(s, `${me.name} accepted ${from.name}'s trade.`);
}

// ---------------------------------------------------------------- bankruptcy

function goBankrupt(s: GameState, p: Player, creditorId: number | null) {
	// Buildings go back to the bank at half price first.
	for (const [key, holding] of Object.entries(s.holdings)) {
		if (holding.owner !== p.id || holding.buildings === 0) continue;
		const space = BOARD[Number(key)] as StreetSpace;
		p.fish += (space.buildCost / 2) * holding.buildings;
		if (holding.buildings === 5) s.bank.houses++;
		else s.bank.boxes += holding.buildings;
		holding.buildings = 0;
	}
	const creditor =
		s.players.find((c) => c.id === creditorId && !c.bankrupt) ?? null;
	if (creditor) {
		// The creditor was paid in full up front; take back what was never there.
		creditor.fish += p.fish;
		for (const holding of Object.values(s.holdings))
			if (holding.owner === p.id) holding.owner = creditor.id;
		creditor.getOutCards.push(...p.getOutCards);
		log(s, `${p.name} is bankrupt! Everything goes to ${creditor.name}.`);
	} else {
		for (const [key, holding] of Object.entries(s.holdings))
			if (holding.owner === p.id) delete s.holdings[Number(key)];
		for (const deck of p.getOutCards) returnGetOutCard(s, deck);
		log(s, `${p.name} is out! Their streets go back to the bank.`);
	}
	p.fish = 0;
	p.getOutCards = [];
	p.bankrupt = true;
	p.atVet = false;
	p.owesTo = null;
	s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
	if (s.auction?.highBidder === p.id) {
		s.auction.highBid = 0;
		s.auction.highBidder = null;
	}
	if (s.hostId === p.id) s.hostId = activePlayers(s)[0]?.id ?? s.hostId;

	const left = activePlayers(s);
	if (left.length === 1) {
		s.phase = "finished";
		s.winnerId = left[0].id;
		s.turn = null;
		s.auction = null;
		s.trades = [];
		log(s, `${left[0].name} is the last cat standing! 🏆`);
		return;
	}
	if (s.turn?.playerId === p.id && s.turn.phase !== "auction") nextTurn(s);
}
