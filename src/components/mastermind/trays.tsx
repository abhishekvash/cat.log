import { Card } from "#/components/ui/card";
import { CODE_COLORS, KEY_COLORS } from "#/lib/mastermind";
import { cn } from "#/lib/utils";
import { type Selection, TrayPin } from "./pins";

/** The codebreaker's (or mastermind's) supply of cats. */
export function KittyTray({
	selection,
	onSelect,
}: {
	selection: Selection | null;
	onSelect: (selection: Selection) => void;
}) {
	return (
		<div className="space-y-2">
			<p className="text-overline">Kitties</p>
			<Card className="flex-row flex-wrap justify-center gap-1 p-2 shadow-none">
				{CODE_COLORS.map((color) => (
					<TrayPin
						key={color}
						selection={{ kind: "code", color }}
						selected={selection?.kind === "code" && selection.color === color}
						onSelect={() => onSelect({ kind: "code", color })}
					/>
				))}
			</Card>
		</div>
	);
}

const PAW_HINTS = { pink: "right spot", white: "wrong spot" } as const;

/** The mastermind's supply of score paws, parked right next to the score column. */
export function PawBox({
	active,
	selection,
	onSelect,
}: {
	active: boolean;
	selection: Selection | null;
	onSelect: (selection: Selection) => void;
}) {
	return (
		<Card
			className={cn(
				"w-26 shrink-0 items-center gap-3 px-2 py-4 shadow-none transition max-sm:w-auto max-sm:flex-row max-sm:px-4 max-sm:py-2",
				active && "border-primary/60 shadow-lamp",
			)}
		>
			<p className="text-overline text-center">Paw box</p>
			{KEY_COLORS.map((color) => (
				<div key={color} className="flex flex-col items-center gap-0.5">
					<TrayPin
						selection={{ kind: "key", color }}
						selected={selection?.kind === "key" && selection.color === color}
						disabled={!active}
						onSelect={() => onSelect({ kind: "key", color })}
					/>
					<span className="text-center text-xs leading-tight text-muted-foreground">
						{PAW_HINTS[color]}
					</span>
				</div>
			))}
			<p className="text-center text-xs leading-snug text-balance text-muted-foreground">
				{active ? "Drag onto the glowing row" : "Unlocks when scoring"}
			</p>
		</Card>
	);
}
