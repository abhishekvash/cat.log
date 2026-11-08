import { CrownSimpleIcon } from "@phosphor-icons/react/CrownSimple";
import { Button } from "#/components/ui/button";
import {
	BOARD,
	buildingRefund,
	CAT_HOUSE,
	GROUPS,
	isOwnable,
	mortgageValue,
	saleValue,
	unmortgageCost,
} from "#/lib/meownopoly/board";
import {
	buildBlocker,
	mortgageBlocker,
	sellBlocker,
	sellStreetBlocker,
	unmortgageBlocker,
} from "#/lib/meownopoly/rules";
import {
	completeGroups,
	groupHasBuildings,
	holdingsOf,
} from "#/lib/meownopoly/selectors";
import type { Holding, Player } from "#/lib/meownopoly/types";
import { cn } from "#/lib/utils";
import { BuildingIcons, GroupDot, groupStyle } from "./bits";
import { withFish } from "./tile-art";
import { useGame } from "./use-game";

/**
 * Your streets. Each whole set sits together in a block of its colour, then
 * the rest in board order. Tapping one opens its card on the board.
 */
export function PropertyList({
	me,
	onSelect,
}: {
	me: Player;
	onSelect: (index: number) => void;
}) {
	const {
		room: { game: state },
	} = useGame();
	const mine = holdingsOf(state, me.id);
	if (mine.length === 0)
		return (
			<p className="cat-eyes-occupied text-sm text-muted-foreground">
				None yet. Buy a street when you land on it.
			</p>
		);
	const sets = completeGroups(state, me.id);
	const inSet = (index: number) => {
		const space = BOARD[index];
		return space.kind === "street" && sets.has(space.group);
	};
	const rest = mine.filter(({ index }) => !inSet(index));
	const row = ({ index, holding }: (typeof mine)[number]) => (
		<li key={index}>
			<PropertyRow index={index} holding={holding} onSelect={onSelect} />
		</li>
	);

	return (
		<div className="space-y-2">
			{GROUPS.filter((g) => sets.has(g.id)).map((group) => (
				<section
					key={group.id}
					aria-label={`Whole ${group.name} set`}
					// No side padding, so the rows inside line up with the ones below.
					className="rounded-lg border border-(--group)/60 bg-(--group)/10 py-1"
					style={groupStyle(group.id)}
				>
					<p className="cat-eyes-occupied flex items-center gap-1 px-1.5 pt-0.5 text-xs font-semibold text-(--group)">
						<CrownSimpleIcon weight="fill" className="size-3" />
						{group.name} set
						{/* Once boxes go up, box rent applies instead. */}
						{!groupHasBuildings(state, group.id) && (
							<span className="ml-auto font-normal text-muted-foreground">
								Rent doubles
							</span>
						)}
					</p>
					<ul>
						{mine
							.filter(({ index }) => {
								const space = BOARD[index];
								return space.kind === "street" && space.group === group.id;
							})
							.map(row)}
					</ul>
				</section>
			))}
			{/* Inset by a set block's border width, to line up with its rows. */}
			{rest.length > 0 && <ul className="px-px">{rest.map(row)}</ul>}
		</div>
	);
}

function PropertyRow({
	index,
	holding,
	onSelect,
}: {
	index: number;
	holding: Holding;
	onSelect: (index: number) => void;
}) {
	const space = BOARD[index];
	return (
		<Button
			variant="ghost"
			size="compact"
			onClick={() => onSelect(index)}
			className="cat-eyes-occupied h-8 w-full justify-start px-1.5 font-sans text-row font-normal tracking-normal active:scale-100"
		>
			{/* Nunito's line box sits low; lift the dot to the letters' middle. */}
			<GroupDot space={space} className="size-2 -translate-y-px" />
			{/* Buttons centre their text; a list row reads from the left. */}
			<span
				className={cn(
					"min-w-0 flex-1 truncate text-left",
					holding.mortgaged && "text-muted-foreground line-through",
				)}
			>
				{space.name}
			</span>
			<BuildingIcons
				count={holding.buildings}
				className="text-sm text-muted-foreground"
			/>
		</Button>
	);
}

/**
 * Build, sell and mortgage one of your streets. Buttons are disabled with the
 * same reasons the engine gives, and the first reason is shown underneath.
 */
export function StreetActions({ me, index }: { me: Player; index: number }) {
	const {
		room: { game: state },
		live,
		move,
	} = useGame();
	const space = BOARD[index];
	const holding = state.holdings[index];
	if (!holding || holding.owner !== me.id || !isOwnable(space)) return null;
	const street = space.kind === "street" ? space : null;
	const actions = [
		street &&
			!holding.mortgaged &&
			holding.buildings < CAT_HOUSE && {
				label: `${holding.buildings === CAT_HOUSE - 1 ? "Build a cat house" : "Add a box"} −${street.buildCost}`,
				why: buildBlocker(state, me.id, index),
				intent: { type: "build", space: index } as const,
				primary: true,
			},
		street &&
			holding.buildings > 0 && {
				label: `Sell one +${buildingRefund(street)}`,
				why: sellBlocker(state, me.id, index),
				intent: { type: "sell", space: index } as const,
			},
		!holding.mortgaged &&
			holding.buildings === 0 && {
				label: `Sell to the bank +${saleValue(space)}`,
				why: sellStreetBlocker(state, me.id, index),
				intent: { type: "sellStreet", space: index } as const,
			},
		holding.mortgaged
			? {
					label: `Lift mortgage −${unmortgageCost(space)}`,
					why: unmortgageBlocker(state, me.id, index),
					intent: { type: "unmortgage", space: index } as const,
				}
			: holding.buildings === 0 && {
					label: `Mortgage +${mortgageValue(space)}`,
					why: mortgageBlocker(state, me.id, index),
					intent: { type: "mortgage", space: index } as const,
				},
	].filter((action) => !!action);
	const hint = actions.find((action) => action.why)?.why;

	return (
		<div className="space-y-2 text-center">
			<div className="flex flex-wrap justify-center gap-2">
				{actions.map((action) => (
					<Button
						key={action.intent.type}
						size="compact"
						variant={"primary" in action ? "default" : "outline"}
						disabled={!live || !!action.why}
						onClick={() => move(action.intent)}
					>
						{action.label}
					</Button>
				))}
			</div>
			{hint && (
				<p className="text-sm text-muted-foreground">{withFish(hint)}</p>
			)}
			<p className="text-xs text-muted-foreground">
				The bank has {state.bank.boxes} boxes and {state.bank.houses} cat houses
				left.
			</p>
		</div>
	);
}
