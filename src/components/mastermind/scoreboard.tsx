import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { ConfirmAction } from "#/components/confirm-action";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { type Match, mastermindOf } from "#/lib/mastermind";
import { cn } from "#/lib/utils";

/** Resetting a match throws away both scores, so it asks first once there are any. */
export function NewMatchButton({
	needsConfirm,
	onReset,
}: {
	needsConfirm: boolean;
	onReset: () => void;
}) {
	const button = (
		<Button
			variant="ghost"
			size="sm"
			onClick={needsConfirm ? undefined : onReset}
		>
			<ArrowCounterClockwiseIcon />
			<span className="max-sm:sr-only">New match</span>
		</Button>
	);
	if (!needsConfirm) return button;
	return (
		<ConfirmAction
			title="Start a new match?"
			description="Both players' scores go back to zero."
			action="Reset scores"
			onConfirm={onReset}
		>
			{button}
		</ConfirmAction>
	);
}

/** Both players' totals; the current mastermind is highlighted. */
export function Scoreboard({ match }: { match: Match }) {
	return (
		<div className="flex items-center gap-2 text-sm max-sm:order-last max-sm:w-full max-sm:justify-center">
			{match.players.map((name, i) => (
				<Badge
					// biome-ignore lint/suspicious/noArrayIndexKey: always exactly two players
					key={i}
					variant="outline"
					className={cn(
						"gap-2 px-3 py-1 text-sm font-normal",
						mastermindOf(match) === i && "border-primary/50 bg-primary/10",
					)}
				>
					<span className="max-w-24 truncate font-display font-medium">
						{name}
					</span>
					<span className="font-display font-semibold tabular-nums text-primary">
						{match.scores[i]}
					</span>
					<span className="text-xs text-muted-foreground max-sm:hidden">
						{mastermindOf(match) === i ? "hides" : "guesses"}
					</span>
				</Badge>
			))}
		</div>
	);
}
