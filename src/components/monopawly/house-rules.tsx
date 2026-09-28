import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { FOOD_BOWL_PAY } from "#/lib/monopawly/board";
import type { HouseRules as Rules } from "#/lib/monopawly/types";
import { withFish } from "./tile-art";
import { useMonopawlyRoom } from "./use-game";

const RULES: { key: keyof Rules; label: string; hint: string }[] = [
	{
		key: "napSpotJackpot",
		label: "Nap Spot jackpot",
		hint: "Taxes and fees pile up on the Nap Spot for whoever lands there.",
	},
	{
		key: "doubleFoodBowl",
		label: "Double fish on the Food Bowl",
		hint: `Landing exactly on the Food Bowl pays ${FOOD_BOWL_PAY * 2} 🐟.`,
	},
	{
		key: "noRentAtVet",
		label: "No rent while at the Vet",
		hint: "Cats at the Vet can't collect rent.",
	},
];

/** Monopawly's house rules in the lobby. Only the host can flip them. */
export function HouseRules() {
	const { room, isHost, live, act } = useMonopawlyRoom();
	return (
		<ul className="space-y-1">
			{RULES.map((rule) => {
				const id = `rule-${rule.key}`;
				return (
					<li key={rule.key} className="flex items-start gap-3 py-1.5">
						<Switch
							id={id}
							checked={room.rules[rule.key]}
							disabled={!isHost || !live}
							onCheckedChange={(on) =>
								act({
									type: "setRules",
									rules: { ...room.rules, [rule.key]: on },
								})
							}
							className="mt-0.5"
						/>
						<Label htmlFor={id} className="flex-col items-start gap-0.5">
							<span className="font-medium">{rule.label}</span>
							<span className="text-xs font-normal text-muted-foreground">
								{withFish(rule.hint)}
							</span>
						</Label>
					</li>
				);
			})}
		</ul>
	);
}
