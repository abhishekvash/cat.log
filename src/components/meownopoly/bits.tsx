import { CatIcon } from "@phosphor-icons/react/Cat";
import { PackageIcon } from "@phosphor-icons/react/Package";
import { type CSSProperties, useEffect, useState } from "react";
import { CatHead } from "#/components/cats/cat-face";
import { ConfirmAction } from "#/components/confirm-action";
import { Button } from "#/components/ui/button";
import {
	CAT_HOUSE,
	type GroupId,
	groupColor,
	type Space,
} from "#/lib/meownopoly/board";
import { bankruptcyBlocker } from "#/lib/meownopoly/rules";
import { soleCreditor } from "#/lib/meownopoly/selectors";
import type { Player } from "#/lib/meownopoly/types";
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

/** Going bankrupt, with an "are you sure?" first. Only a cat in debt can. */
export function BankruptButton({
	label,
	variant,
	className,
}: {
	label: string;
	variant: "outline" | "ghost";
	className?: string;
}) {
	const {
		room: { game: state },
		me,
		move,
	} = useGame();
	if (!me || bankruptcyBlocker(state, me.id)) return null;
	const creditor = soleCreditor(state, me);
	return (
		<ConfirmAction
			title="Go bankrupt?"
			description={`${
				creditor
					? `Everything you own goes to ${creditor.name}`
					: state.rules.auctions
						? "Your streets go up for auction"
						: "Your streets go back to the bank"
			}, and you're out. You can keep watching.`}
			action="Go bankrupt"
			onConfirm={() => move({ type: "declareBankruptcy" })}
		>
			<Button size="compact" variant={variant} className={className}>
				{label}
			</Button>
		</ConfirmAction>
	);
}

/**
 * A street's buildings as plain icons sized by the text around them: one
 * cardboard box per box, or one cat for a cat house. Reads at a glance, even on a tile.
 */
export function BuildingIcons({
	count,
	className,
}: {
	count: number;
	className?: string;
}) {
	if (count === 0) return null;
	const label =
		count === CAT_HOUSE
			? "a cat house"
			: `${count} box${count > 1 ? "es" : ""}`;
	return (
		<span
			role="img"
			aria-label={label}
			className={cn("inline-flex items-center gap-px", className)}
		>
			{count === CAT_HOUSE ? (
				<CatIcon weight="fill" className="size-[1.25em] text-primary" />
			) : (
				Array.from({ length: count }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: identical icons, fixed count
					<PackageIcon key={i} weight="fill" className="size-[1em]" />
				))
			)}
		</span>
	);
}
