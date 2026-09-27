import { Button } from "#/components/ui/button";
import {
	BOARD,
	groupColor,
	groupSpaces,
	isOwnable,
	mortgageValue,
	unmortgageCost,
} from "#/lib/monopawly/board";
import type { GameState, Player } from "#/lib/monopawly/types";
import { Art } from "./tile-art";
import type { GameConnection } from "./use-game";

const mineSorted = (state: GameState, me: Player) =>
	Object.entries(state.holdings)
		.filter(([, h]) => h.owner === me.id)
		.map(([key, holding]) => ({ index: Number(key), holding }))
		.sort((a, b) => a.index - b.index);

/** Your streets, one line each. Tapping one opens its card on the board. */
export function PropertyList({
	state,
	me,
	onSelect,
}: {
	state: GameState;
	me: Player;
	onSelect: (index: number) => void;
}) {
	const mine = mineSorted(state, me);
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
							className="h-8 w-full justify-start px-1.5 font-sans text-[13px] font-normal tracking-normal active:scale-100"
						>
							<span
								className="size-3 shrink-0 rounded-full"
								style={{
									background:
										space.kind === "street"
											? groupColor(space.group)
											: "var(--border)",
								}}
							/>
							<span
								className={
									holding.mortgaged
										? "min-w-0 flex-1 truncate text-muted-foreground line-through"
										: "min-w-0 flex-1 truncate"
								}
							>
								{space.name}
							</span>
							{holding.buildings === 5 ? (
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

/** Build, sell and mortgage one of your streets. The server has the final say. */
export function StreetActions({
	game,
	state,
	me,
	index,
}: {
	game: GameConnection;
	state: GameState;
	me: Player;
	index: number;
}) {
	const space = BOARD[index];
	const holding = state.holdings[index];
	if (!holding || holding.owner !== me.id || !isOwnable(space)) return null;
	const live = game.status === "live";
	const street = space.kind === "street" ? space : null;
	const group = street ? groupSpaces(street.group) : [];
	const fullSet = group.every((i) => state.holdings[i]?.owner === me.id);

	return (
		<div className="space-y-2 text-center">
			{street && !fullSet && (
				<p className="text-sm text-muted-foreground">
					Own all {group.length} in this group to build.
				</p>
			)}
			<div className="flex flex-wrap justify-center gap-2">
				{street && fullSet && !holding.mortgaged && holding.buildings < 5 && (
					<Button
						size="compact"
						disabled={!live}
						onClick={() => game.send({ type: "build", space: index })}
					>
						{holding.buildings === 4 ? "Build a cat house" : "Add a box"} −
						{street.buildCost}
					</Button>
				)}
				{street && holding.buildings > 0 && (
					<Button
						size="compact"
						variant="outline"
						disabled={!live}
						onClick={() => game.send({ type: "sell", space: index })}
					>
						Sell one +{street.buildCost / 2}
					</Button>
				)}
				{holding.mortgaged ? (
					<Button
						size="compact"
						variant="outline"
						disabled={!live}
						onClick={() => game.send({ type: "unmortgage", space: index })}
					>
						Lift mortgage −{unmortgageCost(space)}
					</Button>
				) : (
					holding.buildings === 0 && (
						<Button
							size="compact"
							variant="outline"
							disabled={!live}
							onClick={() => game.send({ type: "mortgage", space: index })}
						>
							Mortgage +{mortgageValue(space)}
						</Button>
					)
				)}
			</div>
			<p className="text-xs text-muted-foreground">
				The bank has {state.bank.boxes} boxes and {state.bank.houses} cat houses
				left.
			</p>
		</div>
	);
}
