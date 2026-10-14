import { Table, TableBody, TableCell, TableRow } from "#/components/ui/table";
import {
	BOARD,
	FLAP_INDEXES,
	FOOD_BOWL_PAY,
	flapRent,
	isOwnable,
	mortgageValue,
	type Space,
	UTILITY_MULTIPLIER,
	VET_FEE,
} from "#/lib/meownopoly/board";
import { playerById, rentQuote } from "#/lib/meownopoly/selectors";
import type { GameState } from "#/lib/meownopoly/types";
import { cn } from "#/lib/utils";
import { groupStyle, PlayerChip } from "./bits";
import { StreetActions } from "./streets-panel";
import { FishIcon, withFish } from "./tile-art";
import { useGame } from "./use-game";

export function SpaceTitle({ index }: { index: number }) {
	const space = BOARD[index];
	return (
		<div className="overflow-hidden rounded-md border border-border">
			{space.kind === "street" && (
				<div className="h-3 bg-(--group)" style={groupStyle(space.group)} />
			)}
			<h2 className="px-4 py-1.5 font-display text-lg font-semibold">
				{space.name}
			</h2>
		</div>
	);
}

/** A space's card: owner, rent, and your build and mortgage controls. */
export function SpaceCard({ index }: { index: number }) {
	const { state, me } = useGame();
	const space = BOARD[index];
	const holding = state.holdings[index];
	const owner = playerById(state, holding?.owner);
	const quote = rentQuote(state, index);
	const dice = (times: number) => `${times}× the dice`;
	const rows: [string, number | string][] =
		space.kind === "street"
			? [
					["Rent", space.rent[0]],
					["Rent with the whole group", space.rent[0] * 2],
					["With 1 box", space.rent[1]],
					["With 2 boxes", space.rent[2]],
					["With 3 boxes", space.rent[3]],
					["With 4 boxes", space.rent[4]],
					["With a cat house", space.rent[5]],
					["Each box or cat house costs", space.buildCost],
				]
			: space.kind === "flap"
				? FLAP_INDEXES.map((_, i) => [
						i === 0
							? "Rent with 1 cat flap"
							: i === FLAP_INDEXES.length - 1
								? `With all ${i + 1}`
								: `With ${i + 1} cat flaps`,
						flapRent(i + 1),
					])
				: space.kind === "utility"
					? [
							["Rent with one utility", dice(UTILITY_MULTIPLIER.one)],
							["With both", dice(UTILITY_MULTIPLIER.both)],
						]
					: [];

	return (
		<div className="flex flex-col items-center gap-3 text-center text-sm">
			<SpaceTitle index={index} />
			{owner ? (
				<p className="flex items-center gap-2 text-muted-foreground">
					Owned by <PlayerChip player={owner} size="1.25rem" />
					{holding?.mortgaged && " (mortgaged)"}
				</p>
			) : isOwnable(space) ? (
				<p className="text-muted-foreground">
					For sale: {space.price}
					<FishIcon />
				</p>
			) : null}
			{me && !me.bankrupt && holding?.owner === me.id && (
				<StreetActions me={me} index={index} />
			)}
			{rows.length > 0 && (
				<div className="w-full">
					<Table>
						<TableBody>
							{rows.map(([label, value], row) => {
								const active =
									!!quote && !holding?.mortgaged && quote.row === row;
								return (
									<TableRow
										key={label}
										aria-current={active || undefined}
										className={cn(
											"hover:bg-transparent",
											active &&
												"bg-primary/15 font-semibold hover:bg-primary/15 [&>td]:text-foreground",
										)}
									>
										<TableCell className="h-8 py-1 text-left text-muted-foreground">
											{label}
										</TableCell>
										<TableCell className="h-8 py-1 text-right tabular-nums">
											{value}
											{typeof value === "number" && <FishIcon />}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
			{space.kind === "utility" && (
				<p className="max-w-measure-narrow text-sm text-muted-foreground">
					"Both" means one cat owns Laser Pointer Co. and Catnip Works.
				</p>
			)}
			{isOwnable(space) && (
				<p className="text-sm text-muted-foreground">
					Mortgage value: {mortgageValue(space)}
					<FishIcon />
				</p>
			)}
			{!isOwnable(space) && (
				<p className="max-w-measure-narrow text-muted-foreground">
					{withFish(describe(space.kind, state))}
				</p>
			)}
		</div>
	);
}

function describe(
	kind: Exclude<Space["kind"], "street" | "flap" | "utility">,
	state: GameState,
) {
	switch (kind) {
		case "foodBowl":
			return `Collect ${FOOD_BOWL_PAY} 🐟 every time you pass the Food Bowl.`;
		case "tax":
			return "Pay the bank when you land here.";
		case "zoomies":
			return "Draw a Zoomies card. Anything can happen.";
		case "treatJar":
			return "Dip into the Treat Jar for a card.";
		case "vet":
			return `Just visiting, unless you were sent here. Leave by rolling doubles, paying ${VET_FEE} 🐟 or using a free pass.`;
		case "caught":
			return "Caught on the counter! Go straight to the Vet without passing the Food Bowl.";
		case "napSpot":
			return state.rules.napSpotJackpot
				? `Taxes and fees pile up here. Land on it to take the jackpot, now ${state.jackpot} 🐟.`
				: "A free place to nap.";
	}
}
