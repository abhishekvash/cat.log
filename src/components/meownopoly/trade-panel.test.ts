import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	RoomProvider,
	type RoomView,
} from "#/components/multiplayer/room-context";
import { TooltipProvider } from "#/components/ui/tooltip";
import { meownopoly } from "#/lib/meownopoly/definition";
import { game, own, p, run, seats } from "#/lib/meownopoly/test-fixtures";
import type {
	GameState,
	HouseRules,
	Move,
	Offer,
} from "#/lib/meownopoly/types";
import { newRoom } from "#/lib/multiplayer/room";
import { TradeComposer, TradeList } from "./trade-panel";

const offer = (spaces: number[]): Offer => ({
	fish: 0,
	spaces,
	getOutCards: 0,
});

function trade(mortgaged: number[] = []) {
	let state = game();
	own(state, 1, 1);
	own(state, 2, 5);
	for (const index of mortgaged) state.holdings[index].mortgaged = true;
	state = run(state, 1, {
		type: "proposeTrade",
		to: 2,
		give: offer([1]),
		get: offer([5]),
	});
	return state;
}

function render(state: GameState, viewer: number, children: ReactNode) {
	const players = seats(2);
	const value: RoomView<GameState, Move, HouseRules> = {
		game: meownopoly,
		code: "ABCDE",
		room: {
			...newRoom(meownopoly, 0).state,
			game: state,
			phase: "playing",
			seats: players,
		},
		seat: players.find((seat) => seat.id === viewer),
		isHost: viewer === 1,
		live: true,
		status: "live",
		clockOffset: 0,
		move: vi.fn(),
		act: vi.fn(),
		join: vi.fn(),
		issueRejoin: vi.fn(),
		rejoinLink: null,
		notice: null,
	};
	const html = renderToStaticMarkup(
		createElement(RoomProvider<GameState, Move, HouseRules>, {
			value,
			// biome-ignore lint/correctness/noChildrenProp: RoomProvider requires children in its props; this Node test uses createElement instead of JSX.
			children: createElement(TooltipProvider, null, children),
		}),
	);
	return html
		.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "")
		.replace(/<[^>]*>/g, "")
		.replace(/\s+/g, " ");
}

function list(state: GameState, viewer: number) {
	return render(
		state,
		viewer,
		createElement(TradeList, { me: p(state, viewer), onCompose: vi.fn() }),
	);
}

function composer(state: GameState) {
	return render(
		state,
		1,
		createElement(TradeComposer, {
			me: p(state, 1),
			draft: { to: 2, give: offer([1]), get: offer([5]) },
			onChange: vi.fn(),
			onClose: vi.fn(),
		}),
	);
}

describe("mortgage-transfer disclosure", () => {
	it("keeps trades without mortgages free of fee notices", () => {
		const state = trade();
		for (const text of [list(state, 1), list(state, 2), composer(state)]) {
			expect(text).not.toContain("bank interest");
			expect(text).not.toContain("(mortgaged)");
		}
	});

	it.each([
		[1],
		[5],
		[1, 5],
	])("shows fees on the correct side for mortgaged spaces %j", (...mortgaged) => {
		const state = trade(mortgaged);
		const yourFee = mortgaged.includes(5) ? 10 : 0;
		const theirFee = mortgaged.includes(1) ? 3 : 0;
		const outgoing = list(state, 1);
		const incoming = list(state, 2);
		for (const text of [outgoing, composer(state)]) {
			expect(text).toContain(`You pay bank interest: ${yourFee}.`);
			expect(text).toContain(`Tux pays bank interest: ${theirFee}.`);
			expect(text).toContain("Any shortfall becomes debt.");
		}
		expect(incoming).toContain(`You pay bank interest: ${theirFee}.`);
		expect(incoming).toContain(`Mochi pays bank interest: ${yourFee}.`);
		for (const text of [outgoing, incoming]) {
			expect(text.includes("Bin Lane (mortgaged)")).toBe(mortgaged.includes(1));
			expect(text.includes("North Cat Flap (mortgaged)")).toBe(
				mortgaged.includes(5),
			);
		}

		const accepted = run(state, 2, {
			type: "respondTrade",
			id: state.trades[0].id,
			accept: true,
		});
		expect(p(state, 1).fish - p(accepted, 1).fish).toBe(yourFee);
		expect(p(state, 2).fish - p(accepted, 2).fish).toBe(theirFee);
	});

	it("discloses debt before accepting a mortgaged property with no fish", () => {
		const state = trade([1]);
		p(state, 2).fish = 0;
		const incoming = list(state, 2);
		expect(incoming).toContain("You pay bank interest: 3.");
		expect(incoming.indexOf("Any shortfall becomes debt.")).toBeLessThan(
			incoming.indexOf("Accept"),
		);
		const accepted = run(state, 2, {
			type: "respondTrade",
			id: state.trades[0].id,
			accept: true,
		});
		expect(p(accepted, 2).fish).toBe(-3);
		expect(p(accepted, 2).debts).toEqual([{ to: null, amount: 3, fee: false }]);
	});
});
