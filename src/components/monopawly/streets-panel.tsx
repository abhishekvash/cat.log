import { Button } from "#/components/ui/button";
import {
	BOARD,
	buildingRefund,
	CAT_HOUSE,
	isOwnable,
	mortgageValue,
	unmortgageCost,
} from "#/lib/monopawly/board";
import {
	buildBlocker,
	mortgageBlocker,
	sellBlocker,
	unmortgageBlocker,
} from "#/lib/monopawly/rules";
import { holdingsOf } from "#/lib/monopawly/selectors";
import type { Player } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import { GroupDot } from "./bits";
import { Art, withFish } from "./tile-art";
import { useGame } from "./use-game";

/** Your streets, one line each. Tapping one opens its card on the board. */
export function PropertyList({
	me,
	onSelect,
}: {
	me: Player;
	onSelect: (index: number) => void;
}) {
	const { state } = useGame();
	const mine = holdingsOf(state, me.id);
	if (mine.length === 0)
		return (
			<p className="text-sm text-muted-foreground">
				None yet. Buy a street when you land on it.
			</p>
		);
	return (
		<ul>
			{mine.map(({ index, holding }) => {
				const space = BOARD[index];
				return (
					<li key={index}>
						<Button
							variant="ghost"
							size="compact"
							onClick={() => onSelect(index)}
							className="h-8 w-full justify-start px-1.5 font-sans text-row font-normal tracking-normal active:scale-100"
						>
							<GroupDot space={space} />
							{/* Buttons centre their text; a list row reads from the left. */}
							<span
								className={cn(
									"min-w-0 flex-1 truncate text-left",
									holding.mortgaged && "text-muted-foreground line-through",
								)}
							>
								{space.name}
							</span>
							{holding.buildings === CAT_HOUSE ? (
								<Art
									name="catHouse"
									plain
									label="cat house"
									className="size-4"
								/>
							) : holding.buildings > 0 ? (
								<span className="flex items-center gap-0.5 text-xs text-muted-foreground">
									<Art name="box" plain label="boxes" className="size-3.5" />
									{holding.buildings}
								</span>
							) : null}
						</Button>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * Build, sell and mortgage one of your streets. Buttons are disabled with the
 * same reasons the engine gives, and the first reason is shown underneath.
 */
export function StreetActions({ me, index }: { me: Player; index: number }) {
	const { state, live, move } = useGame();
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
