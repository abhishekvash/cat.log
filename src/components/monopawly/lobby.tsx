import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmAction } from "#/components/confirm-action";
import { CatEars } from "#/components/mastermind/cat-ears";
import { CatHead } from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { GAME_NAME } from "#/lib/monopawly/board";
import {
	CAT_NAMES,
	CAT_TOKENS,
	type CatToken,
	type GameState,
	type HouseRules,
	MAX_PLAYERS,
	MIN_PLAYERS,
} from "#/lib/monopawly/types";
import { byId, HostCrown } from "./bits";
import { CopyLink } from "./copy-link";
import { withFish } from "./tile-art";
import type { GameConnection } from "./use-game";

const RULES: { key: keyof HouseRules; label: string; hint: string }[] = [
	{
		key: "napSpotJackpot",
		label: "Nap Spot jackpot",
		hint: "Taxes and fees pile up on the Nap Spot for whoever lands there.",
	},
	{
		key: "doubleFoodBowl",
		label: "Double fish on the Food Bowl",
		hint: "Landing exactly on the Food Bowl pays 400 🐟.",
	},
	{
		key: "noRentAtVet",
		label: "No rent while at the Vet",
		hint: "Cats at the Vet can't collect rent.",
	},
];

export function Lobby({
	game,
	state,
	code,
}: {
	game: GameConnection;
	state: GameState;
	code: string;
}) {
	const me = byId(state, game.me);
	const isHost = state.hostId === game.me;
	const host = byId(state, state.hostId);
	const [name, setName] = useState("");
	const live = game.status === "live";
	const full = state.players.length >= MAX_PLAYERS;

	return (
		<main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
			<Button
				asChild
				variant="ghost"
				size="compact"
				className="-ml-3 self-start text-muted-foreground"
			>
				<Link to="/monopawly">
					<ArrowLeftIcon /> {GAME_NAME}
				</Link>
			</Button>
			<Card className="relative p-5">
				<CatEars />
				<div className="space-y-6">
					<div className="space-y-1">
						<p className="text-overline">Room {code}</p>
						<h1 className="font-display text-2xl font-semibold">
							{me ? "Who's playing?" : "Join the game"}
						</h1>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Send this link to everyone playing:
						</p>
						<CopyLink url={`${window.location.origin}/monopawly/${code}`} />
					</div>

					{!me && (
						<form
							className="space-y-2"
							onSubmit={(e) => {
								e.preventDefault();
								if (name.trim()) game.join(name);
							}}
						>
							<Label htmlFor="name" className="text-muted-foreground">
								Your name
							</Label>
							<div className="flex gap-2">
								<Input
									id="name"
									value={name}
									maxLength={16}
									autoComplete="nickname"
									onChange={(e) => setName(e.target.value)}
									placeholder="Mochi"
								/>
								<Button
									size="compact"
									type="submit"
									disabled={!live || !name.trim() || full}
								>
									{full ? "Room is full" : "Take a seat"}
								</Button>
							</div>
						</form>
					)}

					{me && (
						<div className="space-y-2">
							<p className="text-overline">Your cat</p>
							<ToggleGroup
								type="single"
								value={me.cat}
								onValueChange={(cat) =>
									cat && game.send({ type: "updateMe", cat: cat as CatToken })
								}
								variant="choice"
								spacing={1}
								aria-label="Your cat"
								className="flex-wrap"
							>
								{CAT_TOKENS.map((cat) => (
									<ToggleGroupItem
										key={cat}
										value={cat}
										aria-label={CAT_NAMES[cat]}
										disabled={
											!live ||
											state.players.some((p) => p.cat === cat && p.id !== me.id)
										}
										className="size-12 p-1"
									>
										<CatHead coat={cat} size="2.25rem" />
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</div>
					)}

					<div className="space-y-2">
						<p className="text-overline">
							Players {state.players.length} of {MAX_PLAYERS}
						</p>
						<ul className="space-y-1.5">
							{state.players.map((p) => (
								<li key={p.id} className="flex items-center gap-2.5">
									<CatHead coat={p.cat} size="1.75rem" />
									<span className="font-display font-medium">{p.name}</span>
									{p.id === game.me && (
										<span className="text-sm text-muted-foreground">(you)</span>
									)}
									{p.id === state.hostId && <HostCrown />}
									{!p.connected && (
										<span className="text-sm text-muted-foreground">away</span>
									)}
									{isHost && p.id !== game.me && (
										<ConfirmAction
											title={`Remove ${p.name}?`}
											description="They leave the room and their seat opens up."
											action="Remove"
											onConfirm={() =>
												game.send({ type: "hostRemove", playerId: p.id })
											}
										>
											<Button
												variant="ghost"
												size="compact"
												className="ml-auto"
											>
												Remove
											</Button>
										</ConfirmAction>
									)}
								</li>
							))}
							{state.players.length === 0 && (
								<li className="text-sm text-muted-foreground">Nobody yet.</li>
							)}
						</ul>
					</div>

					{me && (
						<div className="space-y-2">
							<p className="text-overline">House rules</p>
							<ul className="space-y-1">
								{RULES.map((rule) => {
									const id = `rule-${rule.key}`;
									return (
										<li
											key={rule.key}
											className="flex items-start gap-3 py-1.5"
										>
											<Switch
												id={id}
												checked={state.rules[rule.key]}
												disabled={!isHost || !live}
												onCheckedChange={(on) =>
													game.send({
														type: "setRules",
														rules: { ...state.rules, [rule.key]: on },
													})
												}
												className="mt-0.5"
											/>
											<Label
												htmlFor={id}
												className="flex-col items-start gap-0.5"
											>
												<span className="font-medium">{rule.label}</span>
												<span className="text-xs font-normal text-muted-foreground">
													{withFish(rule.hint)}
												</span>
											</Label>
										</li>
									);
								})}
							</ul>
						</div>
					)}

					{me && (
						<div className="flex flex-wrap items-center gap-2">
							{isHost ? (
								<Button
									size="compact-lg"
									disabled={!live || state.players.length < MIN_PLAYERS}
									onClick={() => game.send({ type: "start" })}
								>
									{state.players.length < MIN_PLAYERS
										? "Waiting for another cat…"
										: "Start the game"}
								</Button>
							) : (
								<p className="text-muted-foreground">
									Waiting for {host?.name ?? "the host"} to start.
								</p>
							)}
							<ConfirmAction
								title="Leave this room?"
								description="You'll need the link to come back."
								action="Leave"
								onConfirm={() => game.send({ type: "leave" })}
							>
								<Button variant="ghost" size="compact">
									Leave room
								</Button>
							</ConfirmAction>
						</div>
					)}
				</div>
			</Card>
		</main>
	);
}
