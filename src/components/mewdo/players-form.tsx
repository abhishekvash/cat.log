import { PlusIcon } from "@phosphor-icons/react/Plus";
import { XIcon } from "@phosphor-icons/react/X";
import { type FormEvent, useState } from "react";
import { CatEars } from "#/components/cats/cat-ears";
import { CatHead } from "#/components/cats/cat-face";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { CAT_NAMES, CATS, type Cat } from "#/lib/cats";
import type { LocalPlayer } from "#/lib/mewdo/local";
import { MAX_PLAYERS, MIN_PLAYERS } from "#/lib/mewdo/types";
import { NAME_MAX } from "#/lib/multiplayer/room";

const PLACEHOLDERS = ["Mochi", "Tux", "Biscuit", "Luna"];

/** Who's playing on this screen: two to four cats, each with a name. */
export function PlayersForm({
	initial,
	onStart,
}: {
	initial: LocalPlayer[];
	onStart: (players: LocalPlayer[]) => void;
}) {
	const [players, setPlayers] = useState<LocalPlayer[]>(() =>
		initial.length >= MIN_PLAYERS
			? initial
			: [
					{ name: "", cat: CATS[0] },
					{ name: "", cat: CATS[1] },
				],
	);
	const update = (i: number, change: Partial<LocalPlayer>) =>
		setPlayers(players.map((p, j) => (j === i ? { ...p, ...change } : p)));
	const add = () => {
		const taken = new Set(players.map((p) => p.cat));
		const cat = CATS.find((c) => !taken.has(c)) ?? CATS[0];
		setPlayers([...players, { name: "", cat }]);
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		onStart(
			players.map((p, i) => ({
				...p,
				name: p.name.trim() || PLACEHOLDERS[i],
			})),
		);
	};

	return (
		<main className="flex min-h-dvh items-center justify-center p-6">
			<Card className="cat-eyes-occupied relative w-full max-w-md p-6">
				<form onSubmit={submit} className="flex flex-col gap-5">
					<CatEars />
					<div className="space-y-1 text-center">
						<h1 className="font-display text-2xl font-semibold">
							Who's playing?
						</h1>
						<p className="text-sm text-muted-foreground">
							{MIN_PLAYERS} to {MAX_PLAYERS} cats, passing this screen round.
							Pick a name and a cat each.
						</p>
					</div>
					<ul className="space-y-4">
						{players.map((p, i) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
								key={i}
								className="space-y-2"
							>
								<div className="flex items-center gap-2">
									<Input
										aria-label={`Player ${i + 1} name`}
										value={p.name}
										maxLength={NAME_MAX}
										autoComplete="off"
										placeholder={PLACEHOLDERS[i]}
										onChange={(e) => update(i, { name: e.target.value })}
										className="h-11 text-base"
									/>
									{players.length > MIN_PLAYERS && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											aria-label={`Remove player ${i + 1}`}
											onClick={() =>
												setPlayers(players.filter((_, j) => j !== i))
											}
										>
											<XIcon />
										</Button>
									)}
								</div>
								<ToggleGroup
									type="single"
									value={p.cat}
									onValueChange={(cat) => cat && update(i, { cat: cat as Cat })}
									variant="choice"
									spacing={1}
									aria-label={`Player ${i + 1} cat`}
									className="flex-wrap"
								>
									{CATS.map((cat) => (
										<ToggleGroupItem
											key={cat}
											value={cat}
											aria-label={CAT_NAMES[cat]}
											disabled={players.some(
												(o, j) => j !== i && o.cat === cat,
											)}
											className="size-11 p-1"
										>
											<CatHead cat={cat} size="2rem" />
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</li>
						))}
					</ul>
					{players.length < MAX_PLAYERS && (
						<Button type="button" variant="outline" onClick={add}>
							<PlusIcon />
							Add a cat
						</Button>
					)}
					<Button type="submit" size="lg">
						Start the game
					</Button>
				</form>
			</Card>
		</main>
	);
}
