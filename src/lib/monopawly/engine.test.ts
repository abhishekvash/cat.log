import { describe, expect, it } from "vitest";
import { seededRng } from "#/lib/rng";
import { BOARD, FOOD_BOWL_PAY, START_FISH, VET_INDEX } from "./board";
import { DECK_NAMES, DECKS } from "./cards";
import { reduce, removePlayer, skipTurn, start, tick } from "./engine";
import {
	ctx,
	dice,
	game,
	must,
	own,
	p,
	run,
	seats,
	turn,
} from "./test-fixtures";
import { DEFAULT_HOUSE_RULES } from "./types";

describe("start", () => {
	it("deals every seated cat in, with the starting fish and a shuffled order", () => {
		const s = start(seats(4), DEFAULT_HOUSE_RULES, ctx(seededRng(2)));
		expect(s.phase).toBe("playing");
		expect(s.players.map((x) => x.id).sort()).toEqual([1, 2, 3, 4]);
		expect(s.players.every((x) => x.fish === START_FISH)).toBe(true);
		expect(s.turn?.playerId).toBe(s.players[0].id);
		expect(s.log.at(-1)?.text).toBe(
			`The game begins! ${s.players[0].name} goes first.`,
		);
	});
});

describe("moving", () => {
	it("moves by the dice and pays for passing the Food Bowl", () => {
		let s = game();
		p(s, 1).position = 38;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 3)));
		expect(p(s, 1).position).toBe(2);
		// Landed on the Treat Jar; the card may move fish, so check the log instead.
		expect(s.log.some((l) => l.text.includes("passed the Food Bowl"))).toBe(
			true,
		);
	});

	it("rolls again on doubles and goes to the Vet on the third", () => {
		let s = game();
		own(s, 1, 3, 5);
		p(s, 1).position = 1;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 1))); // → 3, own street
		expect(s.turn?.phase).toBe("awaitingRoll");
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 1))); // → 5, own flap
		expect(s.turn?.phase).toBe("awaitingRoll");
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 1)));
		expect(p(s, 1).position).toBe(VET_INDEX);
		expect(p(s, 1).atVet).toBe(true);
		expect(s.turn?.phase).toBe("postRoll");
	});

	it("gets out of the Vet on doubles, or pays after three misses", () => {
		let s = game();
		Object.assign(p(s, 1), { position: VET_INDEX, atVet: true });
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(p(s, 1).atVet).toBe(true);
		for (const _ of [1, 2]) {
			s.turn = { ...turn(s), playerId: 1, phase: "awaitingRoll" };
			s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		}
		expect(p(s, 1).atVet).toBe(false);
		expect(p(s, 1).position).toBe(VET_INDEX + 3);
		expect(p(s, 1).fish).toBe(START_FISH - 50);
		expect(s.turn?.phase).toBe("awaitingBuy");
	});

	it("sends a player to the Vet from the counter", () => {
		let s = game();
		p(s, 1).position = 25;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(p(s, 1).position).toBe(VET_INDEX);
		expect(p(s, 1).atVet).toBe(true);
		expect(p(s, 1).fish).toBe(START_FISH);
	});
});

describe("buying and rent", () => {
	it("buys an unowned street", () => {
		let s = game();
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2))); // Alley Cat Row, 3
		expect(s.turn?.phase).toBe("awaitingBuy");
		s = run(s, 1, { type: "buy" });
		expect(s.holdings[3]).toEqual({ owner: 1, buildings: 0, mortgaged: false });
		expect(p(s, 1).fish).toBe(START_FISH - 60);
		expect(s.turn?.phase).toBe("postRoll");
	});

	it("charges base, doubled set, box and cat house rent", () => {
		let s = game();
		own(s, 2, 1);
		p(s, 1).position = 39;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 1))); // → 1, Bin Lane
		expect(p(s, 2).fish).toBe(START_FISH + 2);

		s = game();
		own(s, 2, 1, 3);
		p(s, 1).position = 38;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2))); // → 1
		expect(p(s, 2).fish).toBe(START_FISH + 4);

		s = game();
		own(s, 2, 1, 3);
		s.holdings[1].buildings = 3;
		p(s, 1).position = 38;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(p(s, 2).fish).toBe(START_FISH + 90);

		s = game();
		own(s, 2, 1, 3);
		s.holdings[1].buildings = 5;
		p(s, 1).position = 38;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(p(s, 2).fish).toBe(START_FISH + 250);
	});

	it("charges flap rent by how many flaps the owner has", () => {
		let s = game();
		own(s, 2, 5, 15, 25);
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(p(s, 2).fish).toBe(START_FISH + 100);
	});

	it("charges utility rent from the dice", () => {
		let s = game();
		own(s, 2, 12);
		p(s, 1).position = 7;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(p(s, 2).fish).toBe(START_FISH + 20);
		s = game();
		own(s, 2, 12, 28);
		p(s, 1).position = 7;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(p(s, 2).fish).toBe(START_FISH + 50);
	});

	it("skips rent on mortgaged streets", () => {
		let s = game();
		own(s, 2, 3);
		s.holdings[3].mortgaged = true;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(p(s, 2).fish).toBe(START_FISH);
	});

	it("lets a payer go into debt, blocks ending the turn, and allows mortgaging out", () => {
		let s = game();
		own(s, 2, 39);
		s.holdings[39].buildings = 5;
		own(s, 1, 1);
		p(s, 1).fish = 100;
		p(s, 1).position = 34;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(p(s, 1).fish).toBe(100 - 2000);
		expect(p(s, 1).debts).toEqual([{ to: 2, amount: 1900, fee: false }]);
		// The landlord only has what was actually paid.
		expect(p(s, 2).fish).toBe(START_FISH + 100);
		expect(reduce(s, 1, { type: "endTurn" }, ctx())).toMatchObject({
			ok: false,
		});
		s = run(s, 1, { type: "mortgage", space: 1 });
		expect(p(s, 1).fish).toBe(100 - 2000 + 30);
		expect(p(s, 1).debts).toEqual([{ to: 2, amount: 1870, fee: false }]);
		expect(p(s, 2).fish).toBe(START_FISH + 130);
	});

	it("never lets a landlord spend rent that wasn't paid", () => {
		let s = game(3);
		own(s, 2, 39);
		s.holdings[39].buildings = 5;
		own(s, 1, 1);
		p(s, 1).fish = 100;
		p(s, 1).position = 34;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		const all = { fish: START_FISH + 100, spaces: [], getOutCards: 0 };
		expect(
			reduce(
				s,
				2,
				{
					type: "proposeTrade",
					to: 3,
					give: { ...all, fish: START_FISH + 101 },
					get: { fish: 0, spaces: [], getOutCards: 0 },
				},
				ctx(),
			),
		).toMatchObject({ ok: false });
		s = run(s, 2, {
			type: "proposeTrade",
			to: 3,
			give: all,
			get: { fish: 0, spaces: [], getOutCards: 0 },
		});
		s = run(s, 3, { type: "respondTrade", id: s.trades[0].id, accept: true });
		s = run(s, 1, { type: "declareBankruptcy" });
		expect(p(s, 2).fish).toBe(0);
		expect(p(s, 3).fish).toBe(START_FISH * 2 + 100);
		expect(s.holdings[1].owner).toBe(2);
	});

	it("sends a bankrupt's things to the bank when they owe several players", () => {
		let s = game(4);
		own(s, 1, 1);
		p(s, 1).fish = 0;
		p(s, 1).position = 4;
		s.decks.zoomies = [
			DECKS.zoomies.findIndex((c) => c.effect.type === "payEach"),
		];
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(p(s, 1).fish).toBe(-150);
		expect(p(s, 1).debts.map((d) => d.to)).toEqual([2, 3, 4]);
		s = run(s, 1, { type: "declareBankruptcy" });
		for (const id of [2, 3, 4]) expect(p(s, id).fish).toBe(START_FISH);
		expect(s.holdings[1]).toBeUndefined();
	});

	it("pays creditors in order as the debtor raises fish", () => {
		let s = game(4);
		own(s, 1, 1, 3);
		p(s, 1).fish = 20;
		p(s, 1).position = 4;
		s.decks.zoomies = [
			DECKS.zoomies.findIndex((c) => c.effect.type === "payEach"),
		];
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect([2, 3, 4].map((id) => p(s, id).fish - START_FISH)).toEqual([
			20, 0, 0,
		]);
		s = run(s, 1, { type: "mortgage", space: 1 });
		s = run(s, 1, { type: "mortgage", space: 3 });
		expect(p(s, 1).fish).toBe(-70);
		expect([2, 3, 4].map((id) => p(s, id).fish - START_FISH)).toEqual([
			50, 30, 0,
		]);
	});
});

describe("auctions", () => {
	it("runs on a reset clock and sells to the top bidder", () => {
		let s = game(3);
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		s = run(s, 1, { type: "decline" }, ctx(undefined, 1000));
		expect(s.turn?.phase).toBe("auction");
		s = run(s, 2, { type: "bid", amount: 10 }, ctx(undefined, 2000));
		s = run(s, 3, { type: "bid", amount: 25 }, ctx(undefined, 3000));
		expect(
			reduce(s, 2, { type: "bid", amount: 20 }, ctx(undefined, 3500)),
		).toMatchObject({
			ok: false,
		});
		expect(tick(s, ctx(undefined, 5000))).toMatchObject({
			ok: false,
		});
		s = must(tick(s, ctx(undefined, 9001)));
		expect(s.holdings[3].owner).toBe(3);
		expect(p(s, 3).fish).toBe(START_FISH - 25);
		expect(s.auction).toBeNull();
		expect(s.turn?.phase).toBe("postRoll");
	});

	it("leaves the street with the bank when nobody bids", () => {
		let s = game();
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		s = run(s, 1, { type: "decline" }, ctx(undefined, 0));
		s = must(tick(s, ctx(undefined, 60_000)));
		expect(s.holdings[3]).toBeUndefined();
	});
});

describe("building", () => {
	const withGroup = () => {
		const s = game();
		own(s, 1, 1, 3);
		turn(s).phase = "postRoll";
		return s;
	};

	it("needs the whole group and builds evenly", () => {
		let s = game();
		own(s, 1, 1);
		expect(reduce(s, 1, { type: "build", space: 1 }, ctx())).toMatchObject({
			ok: false,
		});
		s = withGroup();
		s = run(s, 1, { type: "build", space: 1 });
		expect(reduce(s, 1, { type: "build", space: 1 }, ctx())).toMatchObject({
			ok: false,
			error: "Build evenly across the group.",
		});
		s = run(s, 1, { type: "build", space: 3 });
		expect(p(s, 1).fish).toBe(START_FISH - 100);
		expect(s.bank.boxes).toBe(30);
	});

	it("trades four boxes up for a cat house and back", () => {
		let s = withGroup();
		for (let i = 0; i < 4; i++) {
			s = run(s, 1, { type: "build", space: 1 });
			s = run(s, 1, { type: "build", space: 3 });
		}
		s = run(s, 1, { type: "build", space: 1 });
		expect(s.holdings[1].buildings).toBe(5);
		expect(s.bank).toEqual({ boxes: 32 - 8 + 4, houses: 11 });
		s = run(s, 1, { type: "sell", space: 1 });
		expect(s.holdings[1].buildings).toBe(4);
		expect(s.bank).toEqual({ boxes: 24, houses: 12 });
	});

	it("respects the box shortage", () => {
		let s = withGroup();
		s.bank.boxes = 0;
		expect(reduce(s, 1, { type: "build", space: 1 }, ctx())).toMatchObject({
			ok: false,
			error: "The bank is out of boxes.",
		});
		s = withGroup();
		s.holdings[1].buildings = 4;
		s.holdings[3].buildings = 4;
		s.bank.houses = 0;
		expect(reduce(s, 1, { type: "build", space: 1 }, ctx())).toMatchObject({
			ok: false,
		});
	});

	it("mortgages only without buildings, and lifting costs 10% more", () => {
		let s = withGroup();
		s = run(s, 1, { type: "build", space: 1 });
		expect(reduce(s, 1, { type: "mortgage", space: 3 }, ctx())).toMatchObject({
			ok: false,
		});
		s = run(s, 1, { type: "sell", space: 1 });
		s = run(s, 1, { type: "mortgage", space: 3 });
		expect(p(s, 1).fish).toBe(START_FISH - 50 + 25 + 30);
		s = run(s, 1, { type: "unmortgage", space: 3 });
		expect(p(s, 1).fish).toBe(START_FISH - 50 + 25 + 30 - 33);
	});
});

describe("trading", () => {
	it("swaps fish, streets and cards when accepted", () => {
		let s = game();
		own(s, 1, 1);
		own(s, 2, 3);
		p(s, 2).getOutCards = ["zoomies"];
		s = run(s, 1, {
			type: "proposeTrade",
			to: 2,
			give: { fish: 100, spaces: [1], getOutCards: 0 },
			get: { fish: 0, spaces: [3], getOutCards: 1 },
		});
		const id = s.trades[0].id;
		expect(
			reduce(s, 1, { type: "respondTrade", id, accept: true }, ctx()),
		).toMatchObject({
			ok: false,
		});
		s = run(s, 2, { type: "respondTrade", id, accept: true });
		expect(s.holdings[1].owner).toBe(2);
		expect(s.holdings[3].owner).toBe(1);
		expect(p(s, 1).fish).toBe(START_FISH - 100);
		expect(p(s, 1).getOutCards).toEqual(["zoomies"]);
		expect(s.trades).toEqual([]);
	});

	it("withdraws an offer that went stale", () => {
		let s = game();
		own(s, 1, 1);
		s = run(s, 1, {
			type: "proposeTrade",
			to: 2,
			give: { fish: 0, spaces: [1], getOutCards: 0 },
			get: { fish: 50, spaces: [], getOutCards: 0 },
		});
		s.holdings[1].owner = 2; // sold elsewhere meanwhile
		s = run(s, 2, { type: "respondTrade", id: s.trades[0].id, accept: true });
		expect(p(s, 2).fish).toBe(START_FISH);
		expect(s.log.at(-1)?.text).toContain("stale");
	});

	it("refuses streets from a group with buildings", () => {
		const s = game();
		own(s, 1, 1, 3);
		s.holdings[3].buildings = 1;
		expect(
			reduce(
				s,
				1,
				{
					type: "proposeTrade",
					to: 2,
					give: { fish: 0, spaces: [1], getOutCards: 0 },
					get: { fish: 10, spaces: [], getOutCards: 0 },
				},
				ctx(),
			),
		).toMatchObject({ ok: false });
	});
});

describe("bankruptcy", () => {
	it("hands everything to the creditor and ends a two-player game", () => {
		let s = game();
		own(s, 2, 39);
		s.holdings[39].buildings = 5;
		own(s, 1, 1);
		p(s, 1).fish = 100;
		p(s, 1).position = 34;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		s = run(s, 1, { type: "declareBankruptcy" });
		expect(s.phase).toBe("finished");
		expect(s.winnerId).toBe(2);
		expect(s.holdings[1].owner).toBe(2);
		// Paid 2000 up front, but only 100 existed.
		expect(p(s, 2).fish).toBe(START_FISH + 100);
	});

	it("returns streets to the bank and moves the turn on in bigger games", () => {
		let s = game(3);
		own(s, 1, 1, 3);
		s.holdings[1].buildings = 1;
		s.bank.boxes = 31;
		s = run(s, 1, { type: "declareBankruptcy" });
		expect(p(s, 1).bankrupt).toBe(true);
		expect(s.holdings[1]).toBeUndefined();
		expect(s.bank.boxes).toBe(32);
		expect(s.turn?.playerId).toBe(2);
		expect(s.phase).toBe("playing");
	});
});

describe("house rules", () => {
	it("pays the Nap Spot jackpot from fees", () => {
		let s = game();
		s.rules.napSpotJackpot = true;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 3))); // Vet Bill
		expect(s.jackpot).toBe(200);
		s.turn = {
			playerId: 1,
			phase: "awaitingRoll",
			doubles: 0,
			dice: null,
			rollAgain: false,
		};
		p(s, 1).position = 14;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 4)));
		expect(s.jackpot).toBe(0);
		expect(p(s, 1).fish).toBe(START_FISH);
	});

	it("doubles the Food Bowl on an exact landing", () => {
		let s = game();
		s.rules.doubleFoodBowl = true;
		p(s, 1).position = 35;
		s = run(s, 1, { type: "roll" }, ctx(dice(2, 3)));
		expect(p(s, 1).fish).toBe(START_FISH + FOOD_BOWL_PAY * 2);
	});

	it("skips rent while the owner is at the Vet", () => {
		let s = game();
		s.rules.noRentAtVet = true;
		own(s, 2, 3);
		p(s, 2).atVet = true;
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
		expect(p(s, 1).fish).toBe(START_FISH);
	});
});

describe("cards", () => {
	it("applies every card without breaking the game", () => {
		for (const deck of ["zoomies", "treatJar"] as const) {
			DECKS[deck].forEach((_, index) => {
				let s = game(3);
				own(s, 2, 5, 12);
				s.decks[deck] = [index, ...s.decks[deck].filter((i) => i !== index)];
				// Three spaces short of a Zoomies (7) or Treat Jar (17) square.
				p(s, 1).position = deck === "zoomies" ? 4 : 14;
				s = run(s, 1, { type: "roll" }, ctx(dice(1, 2)));
				const drew = `drew ${DECK_NAMES[deck]}: “${DECKS[deck][index].text}”`;
				expect(s.log.some((l) => l.text.includes(drew))).toBe(true);
				expect(BOARD[p(s, 1).position]).toBeDefined();
				const total = s.players.reduce((sum, x) => sum + x.fish, 0);
				expect(Number.isFinite(total)).toBe(true);
			});
		}
	});

	it("collects 10 from every player on your birthday", () => {
		let s = game(3);
		const birthday = DECKS.treatJar.findIndex(
			(c) => c.effect.type === "collectFromEach",
		);
		s.decks.treatJar = [birthday];
		s = run(s, 1, { type: "roll" }, ctx(dice(1, 1)));
		expect(p(s, 1).fish).toBe(START_FISH + 20);
		expect(p(s, 2).fish).toBe(START_FISH - 10);
	});
});

describe("host controls", () => {
	it("skips the current turn, but not mid-auction", () => {
		let s = game(3);
		s = must(skipTurn(s));
		expect(s.turn?.playerId).toBe(2);
		expect(s.log.at(-1)?.text).toBe("Mochi's turn was skipped.");
		s.turn = { ...turn(s), phase: "auction" };
		expect(skipTurn(s)).toMatchObject({
			ok: false,
			error: "Wait for the auction to finish.",
		});
	});

	it("removes a player as if they went bankrupt to the bank", () => {
		let s = game(3);
		own(s, 1, 1);
		s = must(removePlayer(s, 1));
		expect(p(s, 1).bankrupt).toBe(true);
		expect(s.holdings[1]).toBeUndefined();
		expect(s.turn?.playerId).toBe(2);
		expect(removePlayer(s, 1)).toMatchObject({ ok: false });
	});
});
