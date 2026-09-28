import { type FormEvent, useState } from "react";
import { CatEars } from "#/components/cats/cat-ears";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { CODE_COLORS, ROWS } from "#/lib/mastermind";
import { NAME_MAX } from "#/lib/multiplayer/room";
import { Pin } from "./pins";

/** Names for both players before the first round. */
export function PlayersForm({
	onStart,
}: {
	onStart: (players: [string, string]) => void;
}) {
	const [names, setNames] = useState<[string, string]>(["", ""]);
	const ready = names.every((name) => name.trim());
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (ready) onStart([names[0].trim(), names[1].trim()]);
	};
	return (
		<main className="flex flex-1 items-center justify-center p-6">
			<Card className="relative w-full max-w-sm p-6">
				<form onSubmit={submit} className="flex flex-col gap-5">
					<CatEars />
					<div className="flex justify-center gap-2">
						{CODE_COLORS.map((color) => (
							<Pin key={color} color={color} kind="code" size="2.25rem" />
						))}
					</div>
					<div className="space-y-1 text-center">
						<h1 className="font-display text-2xl font-semibold">
							Who's playing?
						</h1>
						<p className="text-sm text-muted-foreground">
							You take turns hiding the code. The codebreaker scores {ROWS + 1}{" "}
							minus the tries they needed, so crack it fast!
						</p>
					</div>
					{(["Player 1 (hides first)", "Player 2"] as const).map((label, i) => (
						<div key={label} className="flex flex-col gap-2">
							<Label htmlFor={`player-${i}`} className="text-muted-foreground">
								{label}
							</Label>
							<Input
								id={`player-${i}`}
								value={names[i]}
								maxLength={NAME_MAX}
								autoComplete="off"
								autoFocus={i === 0}
								placeholder={i === 0 ? "Mochi" : "Biscuit"}
								onChange={(event) => {
									const next = [...names] as [string, string];
									next[i] = event.target.value;
									setNames(next);
								}}
								className="h-11 text-base"
							/>
						</div>
					))}
					<Button type="submit" size="lg" disabled={!ready}>
						Start match
					</Button>
				</form>
			</Card>
		</main>
	);
}
