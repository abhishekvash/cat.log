import type { LinkProps } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { BackLink } from "#/components/catalog/back-link";
import { CatEars } from "#/components/cats/cat-ears";
import { CatHead } from "#/components/cats/cat-face";
import { ConfirmAction } from "#/components/confirm-action";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { CAT_NAMES, CATS, type Cat } from "#/lib/cats";
import { roomPath } from "#/lib/multiplayer/protocol";
import { NAME_MAX, seatById } from "#/lib/multiplayer/room";
import { CopyLink } from "./copy-link";
import { HostCrown } from "./icon-hint";
import { useRoom } from "./room-context";

/**
 * Where players gather before a game: the invite link, names and cats, who's
 * here, the host's house rules (`rules`), and start or leave.
 */
export function RoomLobby({
	backTo,
	rules,
}: {
	/** The game's intro page. */
	backTo: LinkProps["to"];
	rules?: ReactNode;
}) {
	const { game, code, room, seat: me, isHost, live, act, join } = useRoom();
	const host = seatById(room, room.hostId);
	const [name, setName] = useState("");
	const full = room.seats.length >= game.maxPlayers;
	const enough = room.seats.length >= game.minPlayers;

	return (
		<main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
			<BackLink to={backTo}>{game.name}</BackLink>
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
						<CopyLink
							url={`${window.location.origin}${roomPath(game.id, code)}`}
						/>
					</div>

					{!me && (
						<form
							className="space-y-2"
							onSubmit={(e) => {
								e.preventDefault();
								if (name.trim()) join(name);
							}}
						>
							<Label htmlFor="name" className="text-muted-foreground">
								Your name
							</Label>
							<div className="flex gap-2">
								<Input
									id="name"
									value={name}
									maxLength={NAME_MAX}
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
									cat && act({ type: "updateMe", cat: cat as Cat })
								}
								variant="choice"
								spacing={1}
								aria-label="Your cat"
								className="flex-wrap"
							>
								{CATS.map((cat) => (
									<ToggleGroupItem
										key={cat}
										value={cat}
										aria-label={CAT_NAMES[cat]}
										disabled={
											!live ||
											room.seats.some((s) => s.cat === cat && s.id !== me.id)
										}
										className="size-12 p-1"
									>
										<CatHead cat={cat} size="2.25rem" />
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</div>
					)}

					<div className="space-y-2">
						<p className="text-overline">
							Players {room.seats.length} of {game.maxPlayers}
						</p>
						<ul className="space-y-1.5">
							{room.seats.map((s) => (
								<li key={s.id} className="flex items-center gap-2.5">
									<CatHead cat={s.cat} size="1.75rem" />
									<span className="font-display font-medium">{s.name}</span>
									{s.id === me?.id && (
										<span className="text-sm text-muted-foreground">(you)</span>
									)}
									{s.id === room.hostId && <HostCrown />}
									{!s.connected && (
										<span className="text-sm text-muted-foreground">away</span>
									)}
									{isHost && s.id !== me?.id && (
										<ConfirmAction
											title={`Remove ${s.name}?`}
											description="They leave the room and their seat opens up."
											action="Remove"
											onConfirm={() => act({ type: "hostRemove", seat: s.id })}
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
							{room.seats.length === 0 && (
								<li className="text-sm text-muted-foreground">Nobody yet.</li>
							)}
						</ul>
					</div>

					{me && rules && (
						<div className="space-y-2">
							<p className="text-overline">House rules</p>
							{rules}
						</div>
					)}

					{me && (
						<div className="flex flex-wrap items-center gap-2">
							{isHost ? (
								<Button
									size="compact-lg"
									disabled={!live || !enough}
									onClick={() => act({ type: "start" })}
								>
									{enough ? "Start the game" : "Waiting for another cat…"}
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
								onConfirm={() => act({ type: "leave" })}
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
