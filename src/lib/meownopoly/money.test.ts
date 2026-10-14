import { describe, expect, it } from "vitest";
import { type Rng, seededRng } from "#/lib/rng";
import {
	BANK_BOXES,
	BANK_HOUSES,
	BOARD,
	CAT_HOUSE,
	isOwnable,
	START_FISH,
	unmortgageCost,
	VET_INDEX,
} from "./board";
import { DECKS } from "./cards";
import { reduce, removePlayer, tick } from "./engine";
import { activePlayers, holdingsOf, topBid } from "./selectors";
import {
	ctx,
	dice,
	game,
	inDebt,
	must,
	own,
	p,
	run,
	turn,
} from "./test-fixtures";
import type { GameState, Move } from "./types";

const noOffer = { fish: 0, spaces: [], getOutCards: 0 };
const fishTotal = (s: GameState) => s.players.reduce((n, x) => n + x.fish, 0);

describe("money fixes", () => {
	it("charges exactly the loan plus 10% to lift a mortgage (B1)", () => {
		const cost = (price: number) =>
			unmortgageCost({ kind: "flap", name: "x", price });
		expect(cost(60)).toBe(33);
		expect(cost(100)).toBe(55);
		expect(cost(150)).toBe(83);
		expect(cost(180)).toBe(99);
		expect(cost(200)).toBe(110);
		expect(cost(220)).toBe(121);
		expect(cost(350)).toBe(193);
		expect(cost(400)).toBe(220);
		for (const space of BOARD.filter(isOwnable))
			expect(Number.isInteger(unmortgageCost(space))).toBe(true);
	});

	it("charges 10% interest to whoever takes on a mortgaged street (B2)", () => {
		let s = game();
		own(s, 1, 5);
		s.holdings[5].mortgaged = true;
		s = run(s, 1, {
			type: "proposeTrade",
			to: 2,
			give: { ...noOffer, spaces: [5] },
			get: noOffer,
		});
		s = run(s, 2, { type: "respondTrade", id: s.trades[0].id, accept: true });
		expect(s.holdings[5]).toMatchObject({ owner: 2, mortgaged: true });
		expect(p(s, 2).fish).toBe(START_FISH - 10);
		expect(p(s, 1).fish).toBe(START_FISH);
	});

	it("auctions a bankrupt's streets when auctions are on (B3)", () => {
		let s = game(3);
		s.rules.auctions = true;
		own(s, 1, 1, 3);
		inDebt(s, 1, 10);
		s = run(s, 1, { type: "declareBankruptcy" }, ctx(undefined, 0));
		expect(s.auction?.space).toBe(1);
		expect(s.auctionQueue).toEqual([3]);
		expect(turn(s)).toMatchObject({ playerId: 2, phase: "auction" });
		s = run(s, 3, { type: "bid", amount: 40 }, ctx(undefined, 100));
		s = must(tick(s, ctx(undefined, 60_000)));
		expect(s.holdings[1].owner).toBe(3);
		expect(s.auction?.space).toBe(3);
		s = must(tick(s, ctx(undefined, 120_000)));
		expect(s.holdings[3]).toBeUndefined();
		// Back to where the turn was before the auctions.
		expect(turn(s)).toMatchObject({ playerId: 2, phase: "awaitingRoll" });
	});

	for (const phase of ["awaitingRoll", "awaitingBuy"] as const) {
		for (const removal of ["bankruptcy", "host"] as const) {
			it(`advances an eliminated ${phase} player after queued auctions (${removal})`, () => {
				let s = game(4);
				s.rules.auctions = true;
				turn(s).phase = phase;
				p(s, 1).position = 6;
				own(s, 2, 1, 3);
				inDebt(s, 2, 10);
				s = run(s, 2, { type: "declareBankruptcy" });
				expect(s.auction?.resume).toBe(phase);
				if (removal === "bankruptcy") {
					inDebt(s, 1, 10);
					s = run(s, 1, { type: "declareBankruptcy" });
				} else {
					s = must(removePlayer(s, 1, ctx()));
				}
				s = must(tick(s, ctx(undefined, 60_000)));
				expect(turn(s).phase).toBe("auction");
				expect(s.auction?.space).toBe(3);
				s = must(tick(s, ctx(undefined, 120_000)));
				expect(s.auction).toBeNull();
				expect(turn(s)).toMatchObject({ playerId: 3, phase: "awaitingRoll" });
				expect(reduce(s, 3, { type: "roll" }, ctx(dice(1, 2))).ok).toBe(true);
			});
		}

		it(`preserves an active player's ${phase} phase after queued auctions`, () => {
			let s = game(3);
			s.rules.auctions = true;
			turn(s).phase = phase;
			p(s, 1).position = 6;
			own(s, 2, 1, 3);
			inDebt(s, 2, 10);
			s = run(s, 2, { type: "declareBankruptcy" });
			s = must(tick(s, ctx(undefined, 60_000)));
			s = must(tick(s, ctx(undefined, 120_000)));
			expect(turn(s)).toMatchObject({ playerId: 1, phase });
		});
	}

	it("rejects turn actions from a bankrupt current player", () => {
		const s = game(3);
		p(s, 1).bankrupt = true;
		expect(reduce(s, 1, { type: "roll" }, ctx())).toMatchObject({
			ok: false,
			error: "You're out of this game.",
		});
	});

	it("sells to the runner-up when the top bidder goes bust (B4)", () => {
		let s = game(3);
		s.rules.auctions = true;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		s = run(s, 1, { type: "decline" }, ctx(undefined, 0));
		s = run(s, 2, { type: "bid", amount: 30 }, ctx(undefined, 100));
		s = run(s, 3, { type: "bid", amount: 50 }, ctx(undefined, 200));
		inDebt(s, 3, 1);
		s = run(s, 3, { type: "declareBankruptcy" }, ctx(undefined, 300));
		expect(s.auction?.bids).toEqual({ 2: 30 });
		s = must(tick(s, ctx(undefined, 60_000)));
		expect(s.holdings[3].owner).toBe(2);
		expect(p(s, 2).fish).toBe(START_FISH - 30);
	});

	it("times the first auction clock for the ring (B5)", () => {
		let s = game();
		s.rules.auctions = true;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		s = run(s, 1, { type: "decline" }, ctx(undefined, 0));
		expect(s.auction).toMatchObject({ clock: 12_000, endsAt: 12_000 });
		s = run(s, 2, { type: "bid", amount: 5 }, ctx(undefined, 1000));
		expect(s.auction).toMatchObject({ clock: 6000, endsAt: 7000 });
	});

	it("passes raised fish down a chain of debts in one go (B6)", () => {
		let s = game(3);
		own(s, 3, 1);
		// Player 2 owes 1; player 3 owes 2.
		Object.assign(p(s, 2), {
			fish: -50,
			debts: [{ to: 1, amount: 50, fee: false }],
		});
		Object.assign(p(s, 3), {
			fish: -50,
			debts: [{ to: 2, amount: 50, fee: false }],
		});
		s = run(s, 3, { type: "mortgage", space: 1 }); // +30
		expect(p(s, 3).fish).toBe(-20);
		expect(p(s, 2).fish).toBe(-20);
		expect(p(s, 1).fish).toBe(START_FISH + 30);
	});

	it("only lets a cat in debt go bankrupt (B7)", () => {
		const s = game(3);
		expect(reduce(s, 1, { type: "declareBankruptcy" }, ctx())).toMatchObject({
			ok: false,
		});
	});

	it("logs where every fish goes (B8)", () => {
		let s = game(3);
		const payEach = DECKS.zoomies.findIndex((c) => c.effect.type === "payEach");
		s.decks.zoomies = [payEach];
		p(s, 1).fish = 60;
		p(s, 1).position = 4;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		const text = s.log.map((l) => l.text);
		expect(text).toContain("Mochi paid 50 🐟 to each of 2 cats.");
		expect(text).toContain("Mochi came up 40 🐟 short and owes it to Biscuit.");
		own(s, 1, 1);
		s = run(s, 1, { type: "mortgage", space: 1 });
		expect(s.log.at(-1)?.text).toBe("Mochi paid Biscuit 30 🐟 they owed.");
	});
});

describe("auctions are a house rule", () => {
	it("leaves a passed street with the bank when auctions are off", () => {
		let s = game();
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		s = run(s, 1, { type: "decline" });
		expect(s.auction).toBeNull();
		expect(s.holdings[3]).toBeUndefined();
		expect(turn(s).phase).toBe("postRoll");
	});
});

describe("selling a street to the bank", () => {
	it("pays half its price and frees it", () => {
		let s = game();
		own(s, 1, 39);
		s = run(s, 1, { type: "sellStreet", space: 39 });
		expect(s.holdings[39]).toBeUndefined();
		expect(p(s, 1).fish).toBe(START_FISH + 200);
	});

	it("won't sell a mortgaged street or one with buildings in its group", () => {
		const s = game();
		own(s, 1, 37, 39);
		s.holdings[37].mortgaged = true;
		s.holdings[39].buildings = 1;
		expect(reduce(s, 1, { type: "sellStreet", space: 37 }, ctx())).toEqual({
			ok: false,
			error: "Lift the mortgage first.",
		});
		expect(reduce(s, 1, { type: "sellStreet", space: 39 }, ctx())).toEqual({
			ok: false,
			error: "Sell the buildings in this group first.",
		});
	});
});

describe("sets", () => {
	it("announces a completed group", () => {
		let s = game();
		own(s, 1, 1);
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		s = run(s, 1, { type: "buy" });
		expect(s.log.at(-1)?.text).toBe(
			"Mochi owns all of Alley! Rent doubles, and boxes can go up.",
		);
	});
});

describe("move paths", () => {
	it("records a plain walk", () => {
		const s = run(game(), 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(s.lastMove).toEqual({
			roll: 1,
			playerId: 1,
			from: 0,
			steps: [{ to: 3, kind: "walk" }],
		});
	});

	it("records the card space, then where the card sent them", () => {
		let s = game();
		const toVet = DECKS.zoomies.findIndex((c) => c.effect.type === "goToVet");
		s.decks.zoomies = [toVet];
		p(s, 1).position = 4;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(s.lastMove?.steps).toEqual([
			{ to: 7, kind: "walk", card: { deck: "zoomies", index: toVet } },
			{ to: VET_INDEX, kind: "jump" },
		]);

		s = game();
		const back = DECKS.zoomies.findIndex((c) => c.effect.type === "back");
		s.decks.zoomies = [back];
		p(s, 1).position = 4;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(s.lastMove?.steps).toEqual([
			{ to: 7, kind: "walk", card: { deck: "zoomies", index: back } },
			{ to: 4, kind: "back" },
		]);
	});

	it("jumps straight to the Vet on a third double", () => {
		let s = game();
		turn(s).doubles = 2;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 2)));
		expect(s.lastMove?.steps).toEqual([{ to: VET_INDEX, kind: "jump" }]);
	});
});

// ------------------------------------------------------------ random playout

/** Everything that must hold after any move, however the game went. */
function checkInvariants(s: GameState) {
	for (const x of s.players) {
		expect(Number.isInteger(x.fish)).toBe(true);
		const owed = x.debts.reduce((n, d) => n + d.amount, 0);
		if (x.fish < 0) expect(owed).toBe(-x.fish);
		else expect(x.debts).toEqual([]);
		for (const d of x.debts) expect(d.amount).toBeGreaterThan(0);
		if (x.bankrupt) expect(x.fish).toBe(0);
	}
	expect(Number.isInteger(s.jackpot) && s.jackpot >= 0).toBe(true);
	let boxes = 0;
	let houses = 0;
	for (const [key, h] of Object.entries(s.holdings)) {
		expect(isOwnable(BOARD[Number(key)])).toBe(true);
		expect(p(s, h.owner).bankrupt).toBe(false);
		if (h.buildings === CAT_HOUSE) houses++;
		else boxes += h.buildings;
		if (h.buildings > 0) expect(h.mortgaged).toBe(false);
	}
	expect(s.bank.boxes + boxes).toBe(BANK_BOXES);
	expect(s.bank.houses + houses).toBe(BANK_HOUSES);
}

function candidates(s: GameState, rng: Rng): { actor: number; move: Move }[] {
	const pick = <T>(list: T[]) => list[rng.int(list.length)];
	const t = s.turn;
	const out: { actor: number; move: Move }[] = [];
	if (!t) return out;
	const active = activePlayers(s);
	const actor = t.playerId;
	const me = p(s, actor);
	out.push(
		{ actor, move: { type: "roll" } },
		{ actor, move: { type: "buy" } },
		{ actor, move: { type: "decline" } },
		{ actor, move: { type: "endTurn" } },
		{ actor, move: { type: "payVet" } },
	);
	for (const x of active) {
		// Mostly their own streets, so building and mortgaging actually happen.
		const theirs = holdingsOf(s, x.id).map((h) => h.index);
		const space =
			theirs.length && rng.int(4) > 0 ? pick(theirs) : rng.int(BOARD.length);
		for (const type of [
			"build",
			"build",
			"build",
			"sell",
			"sellStreet",
			"mortgage",
			"unmortgage",
		] as const)
			out.push({ actor: x.id, move: { type, space } });
		if (s.auction)
			out.push({
				actor: x.id,
				move: {
					type: "bid",
					amount: topBid(s.auction).amount + 1 + rng.int(60),
				},
			});
		if (x.fish < 0 && rng.int(4) === 0)
			out.push({ actor: x.id, move: { type: "declareBankruptcy" } });
	}
	const other = pick(active.filter((x) => x.id !== actor));
	if (other && rng.int(6) === 0) {
		const mine = holdingsOf(s, actor).map((h) => h.index);
		out.push({
			actor,
			move: {
				type: "proposeTrade",
				to: other.id,
				give: { fish: 0, spaces: mine.slice(0, 1), getOutCards: 0 },
				get: {
					fish: Math.min(rng.int(200), Math.max(0, other.fish)),
					spaces: [],
					getOutCards: 0,
				},
			},
		});
	}
	for (const trade of s.trades)
		out.push({
			actor: trade.to,
			move: { type: "respondTrade", id: trade.id, accept: rng.int(2) === 0 },
		});
	if (me.fish < 0) out.push({ actor, move: { type: "endTurn" } });
	return out;
}

describe("random playouts", () => {
	it("keeps the books straight across thousands of moves", () => {
		for (let seed = 1; seed <= 12; seed++) {
			const rng = seededRng(seed);
			let s = game(2 + (seed % 5));
			s.rules = {
				napSpotJackpot: seed % 2 === 0,
				doubleFoodBowl: seed % 3 === 0,
				noRentAtVet: seed % 4 === 0,
				auctions: seed % 2 === 1,
			};
			// Short of fish, so debts and bankruptcies come quickly.
			for (const x of s.players) x.fish = 300 + 40 * seed;
			let now = 0;
			for (let i = 0; i < 6000 && s.phase === "playing"; i++) {
				now += 500;
				if (s.auction && rng.int(3) === 0) now = s.auction.endsAt;
				if (s.auction && now >= s.auction.endsAt) {
					s = must(tick(s, ctx(rng, now)));
					checkInvariants(s);
					continue;
				}
				const options = candidates(s, rng);
				const { actor, move } = options[rng.int(options.length)];
				const before = s;
				const result = reduce(s, actor, move, ctx(rng, now));
				if (!result.ok) continue;
				s = result.state;
				checkInvariants(s);
				// Moves between players alone never make or lose fish.
				if (move.type === "bid" || move.type === "proposeTrade")
					expect(fishTotal(s)).toBe(fishTotal(before));
				if (move.type === "respondTrade") {
					const interest = s.log
						.slice(before.log.length ? -20 : 0)
						.filter((l) => l.id > (before.log.at(-1)?.id ?? 0))
						.map((l) => /paid (\d+) 🐟 interest/.exec(l.text))
						.reduce((n, m) => n + (m ? Number(m[1]) : 0), 0);
					expect(fishTotal(s)).toBe(fishTotal(before) - interest);
				}
			}
		}
	});
});
