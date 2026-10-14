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
	groupName,
	isOwnable,
	mortgageInterest,
	mortgageValue,
	type OwnableSpace,
	type RentRow,
	START_FISH,
	type StreetSpace,
	saleValue,
	UTILITY_INDEXES,
	unmortgageCost,
	VET_FEE,
	VET_INDEX,
} from "./board";
import { DECK_NAMES, DECKS, type Deck } from "./cards";
import {
	bankruptcyBlocker,
	buildBlocker,
	mortgageBlocker,
	sellBlocker,
	sellStreetBlocker,
	unmortgageBlocker,
} from "./rules";
import {
	activePlayers,
	groupHasBuildings,
	holdingsOf,
	ownsGroup,
	playerById,
	rankedBids,
	rentQuote,
	soleCreditor,
	topBid,
} from "./selectors";
import {
	AUCTION_CLOCK_MS,
	type GameState,
	type HouseRules,
	LOG_LIMIT,
	type Move,
	type Offer,
	type Player,
	type Step,
	type TurnPhase,
} from "./types";

/**
 * Meownopoly's rules. Seats, the lobby and hosting belong to the shared room
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
		auctionQueue: [],
		lastMove: null,
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
		debts: [],
	};
}

/** Runs one change on a copy, then passes any fish debtors raised to their creditors. */
function change(
	state: GameState,
	fn: (s: GameState) => void,
): Result<GameState> {
	return attempt(state, (s) => {
		fn(s);
		// Paying one creditor can let them pay theirs, so go round until it settles.
		let paid = true;
		while (paid) {
			paid = false;
			for (const p of s.players) if (collectDebts(s, p)) paid = true;
		}
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
export function removePlayer(
	state: GameState,
	id: SeatId,
	ctx: Context,
): Result<GameState> {
	return change(state, (s) => {
		playing(s);
		const target = active(player(s, id));
		log(s, `${target.name} was removed from the game.`);
		goBankrupt(s, target, false, ctx.now);
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
			const name = BOARD[p.position].name;
			if (s.rules.auctions) {
				log(s, `${p.name} passed on ${name}. Auction!`);
				return openAuction(s, p.position, ctx.now, "postRoll");
			}
			log(s, `${p.name} passed on ${name}. It stays with the bank.`);
			turnOf(s).phase = "postRoll";
			return settle(s);
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
		case "sellStreet":
			return sellStreet(s, active(me), intent.space);
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
			const why = bankruptcyBlocker(s, me.id);
			if (why) reject(why);
			return goBankrupt(s, me, true, ctx.now);
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
	active(me);
	const turn = turnOf(s);
	if (turn.playerId !== me.id) reject("It's not your turn.");
	if (turn.phase !== phase) reject(phaseHint(turn.phase));
	return me;
}

function phaseHint(phase: TurnPhase) {
	switch (phase) {
		case "awaitingBuy":
			return "Buy it or pass on it first.";
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
	s.lastMove = { roll: s.rolls, playerId: p.id, from: p.position, steps: [] };
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
	step(s, p, { to: target, kind: "walk" });
}

/** Records a leg of this roll's move so the board can replay it. */
function step(s: GameState, p: Player, leg: Step) {
	if (s.lastMove?.roll === s.rolls && s.lastMove.playerId === p.id)
		s.lastMove.steps.push(leg);
}

function goToVet(s: GameState, p: Player) {
	p.position = VET_INDEX;
	step(s, p, { to: VET_INDEX, kind: "jump" });
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
			const quote = rentQuote(s, p.position);
			if (!quote) return;
			if (quote.waived === "mortgaged") {
				log(s, `${space.name} is mortgaged, so no rent.`);
				return;
			}
			if (quote.waived === "ownerAtVet") {
				log(s, `${owner.name} is at the Vet, so no rent.`);
				return;
			}
			const rent = rentFor(quote, rng, opts);
			log(s, `${p.name} paid ${owner.name} ${rent} 🐟 rent for ${space.name}.`);
			pay(s, p, owner, rent, false);
			return;
		}
		case "tax":
			log(s, `${p.name} paid the ${space.name}: ${space.amount} 🐟.`);
			pay(s, p, null, space.amount, true);
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

function rentFor(quote: RentRow, rng: Rng, opts: LandOptions) {
	if (!quote.perDice) return opts.doubleFlap ? quote.amount * 2 : quote.amount;
	if (opts.utilityTimesTen) return 10 * (rollDie(rng) + rollDie(rng));
	return quote.amount * (opts.dice ?? rollDie(rng) + rollDie(rng));
}

/**
 * Moves fish. The payer may go negative; `to` (or the bank) gets only what
 * they had, and the rest becomes a debt they must raise or go bankrupt over.
 * Fees can feed the Nap Spot jackpot.
 */
function pay(
	s: GameState,
	from: Player,
	to: Player | null,
	amount: number,
	fee: boolean,
) {
	const paid = Math.min(amount, Math.max(0, from.fish));
	from.fish -= amount;
	credit(s, to, paid, fee);
	if (paid < amount) {
		const short = amount - paid;
		from.debts.push({ to: to?.id ?? null, amount: short, fee });
		log(
			s,
			`${from.name} came up ${short} 🐟 short and owes it to ${to?.name ?? "the bank"}.`,
		);
	}
}

function credit(s: GameState, to: Player | null, amount: number, fee: boolean) {
	if (to) to.fish += amount;
	else if (fee && s.rules.napSpotJackpot) s.jackpot += amount;
}

/**
 * Hands whatever a debtor has raised since going negative to their creditors,
 * oldest first. Returns whether anything was paid.
 */
function collectDebts(s: GameState, p: Player) {
	const owed = p.debts.reduce((sum, d) => sum + d.amount, 0);
	let raised = owed - Math.max(0, -p.fish);
	const paidAny = raised > 0 && p.debts.length > 0;
	while (raised > 0 && p.debts.length > 0) {
		const debt = p.debts[0];
		const part = Math.min(raised, debt.amount);
		const found = playerById(s, debt.to);
		// A creditor who has since gone bust can't be paid; it goes to the bank.
		const creditor = found && !found.bankrupt ? found : null;
		credit(s, creditor, part, debt.fee);
		log(
			s,
			creditor
				? `${p.name} paid ${creditor.name} ${part} 🐟 they owed.`
				: `${p.name} paid the bank ${part} 🐟 they owed.`,
		);
		debt.amount -= part;
		raised -= part;
		if (debt.amount === 0) p.debts.shift();
	}
	return paidAny;
}

function drawCard(s: GameState, p: Player, deck: Deck, rng: Rng): void {
	const index = s.decks[deck].shift();
	if (index === undefined) return;
	const card = DECKS[deck][index];
	if (card.effect.type !== "getOut") s.decks[deck].push(index);
	log(s, `${p.name} drew ${DECK_NAMES[deck]}: “${card.text}”`);
	const arrival = s.lastMove?.steps.at(-1);
	if (s.lastMove?.playerId === p.id && arrival?.to === p.position)
		arrival.card = { deck, index };

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
			step(s, p, { to: p.position, kind: "back" });
			land(s, p, rng, {});
			return;
		case "collect":
			p.fish += effect.amount;
			log(s, `${p.name} collected ${effect.amount} 🐟.`);
			return;
		case "pay":
			log(s, `${p.name} paid the bank ${effect.amount} 🐟.`);
			pay(s, p, null, effect.amount, true);
			return;
		case "collectFromEach":
			log(
				s,
				`${p.name} collected ${effect.amount} 🐟 from each of ${others.length} cats.`,
			);
			for (const o of others) pay(s, o, p, effect.amount, false);
			return;
		case "payEach":
			log(
				s,
				`${p.name} paid ${effect.amount} 🐟 to each of ${others.length} cats.`,
			);
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
			log(
				s,
				total > 0
					? `${p.name}'s repairs came to ${total} 🐟.`
					: `${p.name} has nothing to repair.`,
			);
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
	announceSets(s, p, [p.position]);
	turnOf(s).phase = "postRoll";
	settle(s);
}

/** Celebrates any group these new spaces complete. */
function announceSets(s: GameState, p: Player, spaces: number[]) {
	const groups = new Set(
		spaces.flatMap((i) => {
			const space = BOARD[i];
			return space.kind === "street" ? [space.group] : [];
		}),
	);
	for (const group of groups) {
		if (!ownsGroup(s, p.id, group)) continue;
		log(
			s,
			`${p.name} owns all of ${groupName(group)}! Rent doubles, and boxes can go up once all streets are unmortgaged.`,
		);
	}
}

/** Puts a bank street up for auction, pausing the turn until it closes. */
function openAuction(
	s: GameState,
	space: number,
	now: number,
	resume: TurnPhase,
) {
	const clock = AUCTION_CLOCK_MS * 2;
	s.auction = {
		space,
		bids: {},
		endsAt: now + clock,
		clock,
		resume,
	};
	if (s.turn) s.turn.phase = "auction";
}

/** Opens the next auction waiting in line, if any. */
function openQueuedAuction(s: GameState, now: number, resume: TurnPhase) {
	const next = s.auctionQueue.shift();
	if (next === undefined) return false;
	openAuction(s, next, now, resume);
	return true;
}

function bid(s: GameState, me: Player, amount: number, now: number) {
	playing(s);
	active(me);
	const auction = s.auction;
	if (!auction) reject("There's no auction right now.");
	if (now >= auction.endsAt) reject("Too late, the auction is closing.");
	const top = topBid(auction).amount;
	if (!Number.isInteger(amount) || amount <= top)
		reject(`Bid more than ${top} 🐟.`);
	if (amount > me.fish) reject("Not enough fish 🐟");
	auction.bids[me.id] = amount;
	auction.clock = AUCTION_CLOCK_MS;
	auction.endsAt = now + AUCTION_CLOCK_MS;
}

function closeAuction(s: GameState, now: number) {
	const auction = s.auction;
	if (!auction) reject("There's no auction right now.");
	if (now < auction.endsAt) reject("The auction is still running.");
	const space = BOARD[auction.space];
	// Best bid first; a bidder who has gone bust or can't pay drops out.
	const ranked = rankedBids(auction).map(({ bidder, amount }) => ({
		bidder: playerById(s, bidder),
		amount,
	}));
	const win = ranked.find(
		({ bidder, amount }) => bidder && !bidder.bankrupt && bidder.fish >= amount,
	);
	if (win?.bidder) {
		win.bidder.fish -= win.amount;
		s.holdings[auction.space] = {
			owner: win.bidder.id,
			buildings: 0,
			mortgaged: false,
		};
		log(s, `${win.bidder.name} won ${space.name} for ${win.amount} 🐟.`);
		announceSets(s, win.bidder, [auction.space]);
	} else if (ranked.length > 0) {
		log(s, `Nobody left could pay for ${space.name}. It stays with the bank.`);
	} else {
		log(s, `Nobody bid on ${space.name}. It stays with the bank.`);
	}
	s.auction = null;
	if (openQueuedAuction(s, now, auction.resume)) return;
	if (!s.turn) return;
	const current = playerById(s, s.turn.playerId);
	if (!current || current.bankrupt) return nextTurn(s);
	s.turn.phase = auction.resume;
	if (auction.resume === "postRoll") settle(s);
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

function sellStreet(s: GameState, p: Player, index: number) {
	const why = sellStreetBlocker(s, p.id, index);
	if (why) reject(why);
	const space = BOARD[index] as OwnableSpace;
	delete s.holdings[index];
	const value = saleValue(space);
	p.fish += value;
	log(s, `${p.name} sold ${space.name} back to the bank for ${value} 🐟.`);
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
	payTransferInterest(s, me, trade.give.spaces);
	payTransferInterest(s, from, trade.get.spaces);
	announceSets(s, me, trade.give.spaces);
	announceSets(s, from, trade.get.spaces);
}

/** Taking over a mortgaged street costs 10% of its loan up front. */
function payTransferInterest(s: GameState, p: Player, spaces: number[]) {
	for (const index of spaces) {
		const space = BOARD[index];
		if (!s.holdings[index]?.mortgaged || !isOwnable(space)) continue;
		const interest = mortgageInterest(space);
		log(
			s,
			`${p.name} paid ${interest} 🐟 interest to take on mortgaged ${space.name}.`,
		);
		pay(s, p, null, interest, false);
	}
}

// ---------------------------------------------------------------- bankruptcy

/**
 * Takes a player out. With `toCreditor`, a player owed everything inherits
 * their streets; otherwise (or when removed by the host) they go to the bank.
 */
function goBankrupt(s: GameState, p: Player, toCreditor: boolean, now: number) {
	const creditor = toCreditor ? soleCreditor(s, p) : undefined;
	// Buildings go back to the bank at half price first, paying down debts.
	for (const [key, holding] of Object.entries(s.holdings)) {
		if (holding.owner !== p.id || holding.buildings === 0) continue;
		const space = BOARD[Number(key)] as StreetSpace;
		p.fish += buildingRefund(space) * holding.buildings;
		if (holding.buildings === CAT_HOUSE) s.bank.houses++;
		else s.bank.boxes += holding.buildings;
		holding.buildings = 0;
	}
	collectDebts(s, p);
	const theirs = holdingsOf(s, p.id).map(({ index }) => index);
	if (creditor) {
		creditor.fish += Math.max(0, p.fish);
		for (const i of theirs) s.holdings[i].owner = creditor.id;
		creditor.getOutCards.push(...p.getOutCards);
		log(s, `${p.name} is bankrupt! Everything goes to ${creditor.name}.`);
		payTransferInterest(s, creditor, theirs);
		announceSets(s, creditor, theirs);
	} else {
		for (const i of theirs) delete s.holdings[i];
		for (const deck of p.getOutCards) returnGetOutCard(s, deck);
		if (s.rules.auctions && theirs.length > 0) {
			s.auctionQueue.push(...theirs);
			log(s, `${p.name} is out! Their streets go up for auction.`);
		} else {
			log(s, `${p.name} is out! Their streets go back to the bank.`);
		}
	}
	p.fish = 0;
	p.getOutCards = [];
	p.bankrupt = true;
	p.atVet = false;
	p.debts = [];
	s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
	// Their bids are void; the best bid left stands.
	if (s.auction) delete s.auction.bids[p.id];

	const left = activePlayers(s);
	if (left.length === 1) {
		s.phase = "finished";
		s.winnerId = left[0].id;
		s.turn = null;
		s.auction = null;
		s.auctionQueue = [];
		s.trades = [];
		log(s, `${left[0].name} is the last cat standing! 🏆`);
		return;
	}
	if (s.turn?.playerId === p.id && s.turn.phase !== "auction") nextTurn(s);
	if (!s.auction && s.turn) openQueuedAuction(s, now, s.turn.phase);
}
