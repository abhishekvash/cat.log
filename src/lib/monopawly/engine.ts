import type { Cat } from "#/lib/cats";
import {
	attempt,
	type Context,
	Rejection,
	type Result,
	reject,
	type Seat,
	type SeatId,
} from "#/lib/multiplayer/types";
import { type Rng, rollDie, shuffle } from "#/lib/rng";
import {
	BANK_BOXES,
	BANK_HOUSES,
	BOARD,
	buildingRefund,
	CAT_HOUSE,
	FLAP_INDEXES,
	FOOD_BOWL_PAY,
	flapRent,
	isOwnable,
	mortgageValue,
	type OwnableSpace,
	START_FISH,
	type StreetSpace,
	UTILITY_INDEXES,
	UTILITY_MULTIPLIER,
	unmortgageCost,
	VET_FEE,
	VET_INDEX,
} from "./board";
import { DECK_NAMES, DECKS, type Deck } from "./cards";
import {
	buildBlocker,
	mortgageBlocker,
	sellBlocker,
	unmortgageBlocker,
} from "./rules";
import {
	activePlayers,
	groupHasBuildings,
	ownsGroup,
	playerById,
} from "./selectors";
import {
	AUCTION_CLOCK_MS,
	type GameState,
	type HouseRules,
	LOG_LIMIT,
	type Move,
	type Offer,
	type Player,
	type TurnPhase,
} from "./types";

/**
 * Monopawly's rules. Seats, the lobby and hosting belong to the shared room
 * (lib/multiplayer); this deals a game for the seated cats and plays it.
 */

/** Deals a fresh game: shuffled turn order, shuffled decks, full bank. */
export function start(
	seats: readonly Seat[],
	rules: HouseRules,
	ctx: Context,
): GameState {
	const players = shuffle(seats, ctx.rng).map((seat) =>
		newPlayer(seat.id, seat.name, seat.cat),
	);
	const s: GameState = {
		phase: "playing",
		rules: { ...rules },
		players,
		holdings: {},
		decks: {
			zoomies: shuffle(
				DECKS.zoomies.map((_, i) => i),
				ctx.rng,
			),
			treatJar: shuffle(
				DECKS.treatJar.map((_, i) => i),
				ctx.rng,
			),
		},
		turn: freshTurn(players[0].id),
		auction: null,
		trades: [],
		nextTradeId: 1,
		rolls: 0,
		jackpot: 0,
		bank: { boxes: BANK_BOXES, houses: BANK_HOUSES },
		winnerId: null,
		log: [],
	};
	log(s, `The game begins! ${players[0].name} goes first.`);
	return s;
}

function newPlayer(id: SeatId, name: string, cat: Cat): Player {
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
	};
}

/** Runs one change on a copy, then clears debts that have been paid off. */
function change(
	state: GameState,
	fn: (s: GameState) => void,
): Result<GameState> {
	return attempt(state, (s) => {
		fn(s);
		for (const p of s.players) if (p.fish >= 0) p.owesTo = null;
	});
}

/** Applies one player's move. Never mutates `state`; a rejected move changes nothing. */
export function reduce(
	state: GameState,
	actor: SeatId,
	move: Move,
	ctx: Context,
): Result<GameState> {
	return change(state, (s) => apply(s, actor, move, ctx));
}

/** The auction clock ran out: sell to the top bidder. */
export function tick(state: GameState, ctx: Context): Result<GameState> {
	return change(state, (s) => closeAuction(s, ctx.now));
}

/** The host moves on past the current player. */
export function skipTurn(state: GameState): Result<GameState> {
	return change(state, (s) => {
		const turn = turnOf(s);
		if (turn.phase === "auction") reject("Wait for the auction to finish.");
		log(s, `${player(s, turn.playerId).name}'s turn was skipped.`);
		nextTurn(s);
	});
}

/** The host takes a player out: their streets go back to the bank. */
export function removePlayer(state: GameState, id: SeatId): Result<GameState> {
	return change(state, (s) => {
		playing(s);
		const target = active(player(s, id));
		log(s, `${target.name} was removed from the game.`);
		goBankrupt(s, target, null);
	});
}

function apply(s: GameState, actor: SeatId, intent: Move, ctx: Context) {
	const me = player(s, actor);

	switch (intent.type) {
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
		default:
			intent satisfies never;
			reject("Unknown move.");
	}
}

// ---------------------------------------------------------------- helpers

function player(s: GameState, id: number) {
	const p = playerById(s, id);
	if (!p) reject("That player isn't in this game.");
	return p;
}

function active(p: Player) {
	if (p.bankrupt) reject("You're out of this game.");
	return p;
}

function playing(s: GameState) {
	if (s.phase !== "playing") reject("The game isn't running.");
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

function phaseHint(phase: TurnPhase) {
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

function log(s: GameState, text: string) {
	const id = (s.log.at(-1)?.id ?? 0) + 1;
	s.log.push({ id, text });
	if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
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
	s.rolls++;
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
	const p = playerById(s, turn.playerId);
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

function rentFor(s: GameState, index: number, rng: Rng, opts: LandOptions) {
	const space = BOARD[index];
	const holding = s.holdings[index];
	if (!holding || !isOwnable(space)) return 0;
	const owns = (list: number[]) =>
		list.filter((i) => s.holdings[i]?.owner === holding.owner).length;

	if (space.kind === "street") {
		if (holding.buildings > 0) return space.rent[holding.buildings];
		return ownsGroup(s, holding.owner, space.group)
			? space.rent[0] * 2
			: space.rent[0];
	}
	if (space.kind === "flap") {
		const rent = flapRent(owns(FLAP_INDEXES));
		return opts.doubleFlap ? rent * 2 : rent;
	}
	if (opts.utilityTimesTen) return 10 * (rollDie(rng) + rollDie(rng));
	const dice = opts.dice ?? rollDie(rng) + rollDie(rng);
	const { one, both } = UTILITY_MULTIPLIER;
	return (owns(UTILITY_INDEXES) === UTILITY_INDEXES.length ? both : one) * dice;
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
			const list = effect.kind === "flap" ? FLAP_INDEXES : UTILITY_INDEXES;
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
					holding.buildings === CAT_HOUSE
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
	const winner = playerById(s, auction.highBidder);
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

function build(s: GameState, p: Player, index: number) {
	const why = buildBlocker(s, p.id, index);
	if (why) reject(why);
	const space = BOARD[index] as StreetSpace;
	const holding = s.holdings[index];
	const upgrade = holding.buildings === CAT_HOUSE - 1;
	p.fish -= space.buildCost;
	if (upgrade) {
		s.bank.houses--;
		s.bank.boxes += CAT_HOUSE - 1;
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
	const why = sellBlocker(s, p.id, index);
	if (why) reject(why);
	const space = BOARD[index] as StreetSpace;
	const holding = s.holdings[index];
	if (holding.buildings === CAT_HOUSE) {
		s.bank.boxes -= CAT_HOUSE - 1;
		s.bank.houses++;
	} else {
		s.bank.boxes++;
	}
	holding.buildings--;
	const refund = buildingRefund(space);
	p.fish += refund;
	log(s, `${p.name} sold a building on ${space.name} for ${refund} 🐟.`);
}

function mortgage(s: GameState, p: Player, index: number) {
	const why = mortgageBlocker(s, p.id, index);
	if (why) reject(why);
	const space = BOARD[index] as OwnableSpace;
	s.holdings[index].mortgaged = true;
	const value = mortgageValue(space);
	p.fish += value;
	log(s, `${p.name} mortgaged ${space.name} for ${value} 🐟.`);
}

function unmortgage(s: GameState, p: Player, index: number) {
	const why = unmortgageBlocker(s, p.id, index);
	if (why) reject(why);
	const space = BOARD[index] as OwnableSpace;
	const cost = unmortgageCost(space);
	p.fish -= cost;
	s.holdings[index].mortgaged = false;
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
		if (space.kind === "street" && groupHasBuildings(s, space.group))
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
		p.fish += buildingRefund(space) * holding.buildings;
		if (holding.buildings === CAT_HOUSE) s.bank.houses++;
		else s.bank.boxes += holding.buildings;
		holding.buildings = 0;
	}
	const found = playerById(s, creditorId);
	const creditor = found && !found.bankrupt ? found : null;
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
