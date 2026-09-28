import { type CSSProperties, useEffect, useState } from "react";
import { CatHead } from "#/components/cats/cat-face";
import { ConfirmAction } from "#/components/confirm-action";
import { Button } from "#/components/ui/button";
import { type GroupId, groupColor, type Space } from "#/lib/monopawly/board";
import { soleCreditor } from "#/lib/monopawly/selectors";
import type { Player } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";
import { FishIcon } from "./tile-art";
import { useGame } from "./use-game";

export function Fish({
	amount,
	className,
}: {
	amount: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"tabular-nums",
				amount < 0 && "text-destructive",
				className,
			)}
		>
			{amount.toLocaleString("en")}
			<FishIcon />
		</span>
	);
}

export function PlayerChip({
	player,
	size = "1.5rem",
}: {
	player: Player;
	size?: string;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 font-display font-medium">
			<CatHead cat={player.cat} size={size} />
			{player.name}
		</span>
	);
}

/** Ticks while mounted, for countdowns against the server clock. */
export function useServerNow(offset: number, every = 100) {
	const [now, setNow] = useState(() => Date.now() + offset);
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now() + offset), every);
		return () => window.clearInterval(id);
	}, [offset, every]);
	return now;
}

/** Sets `--group` to a street group's colour, for `bg-group-tint` and `bg-(--group)`. */
export const groupStyle = (group: GroupId) =>
	({ "--group": groupColor(group) }) as CSSProperties;

/** A street's group colour as a dot; other spaces get a neutral one. */
export function GroupDot({
	space,
	className,
}: {
	space: Space;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"size-3 shrink-0 rounded-full",
				space.kind === "street" ? "bg-(--group)" : "bg-muted-foreground/50",
				className,
			)}
			style={space.kind === "street" ? groupStyle(space.group) : undefined}
		/>
	);
}

/** Going bankrupt on purpose, with an "are you sure?" first. */
export function BankruptButton({
	label,
	variant,
	className,
}: {
	label: string;
	variant: "outline" | "ghost";
	className?: string;
}) {
	const { state, me, move } = useGame();
	const creditor = me ? soleCreditor(state, me) : undefined;
	return (
		<ConfirmAction
			title="Go bankrupt?"
			description={`Everything you own goes to ${creditor?.name ?? "the bank"}, and you're out. You can keep watching.`}
			action="Go bankrupt"
			onConfirm={() => move({ type: "declareBankruptcy" })}
		>
			<Button size="compact" variant={variant} className={className}>
				{label}
			</Button>
		</ConfirmAction>
	);
}
