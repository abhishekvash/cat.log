import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameIntro } from "#/components/catalog/game-intro";
import { CatHead } from "#/components/cats/cat-face";
import { useStartRoom } from "#/components/multiplayer/use-start-room";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { MEOWNOPOLY } from "#/lib/catalog";
import { CATS } from "#/lib/cats";
import { meownopolyClient } from "#/lib/meownopoly/client";
import { CODE_PATTERN } from "#/lib/multiplayer/protocol";
import { gameHead } from "#/lib/seo";

export const Route = createFileRoute("/meownopoly/")({
	head: () => gameHead(MEOWNOPOLY),
	component: Home,
});

function Home() {
	const navigate = useNavigate();
	const startRoom = useStartRoom(meownopolyClient.id);
	const [code, setCode] = useState("");
	const clean = code.trim().toUpperCase();
	const { min, max } = MEOWNOPOLY.players;

	return (
		<GameIntro
			game={MEOWNOPOLY}
			pieces={CATS.map((cat) => <CatHead key={cat} cat={cat} size="2.75rem" />)}
			lede={`A classic property game in a cat town, for ${min} to ${max} players, each on their own tablet or computer.`}
			rules={
				<>
					<li>
						Roll and walk the board. Buy the streets you land on, pass on them,
						or (with auctions on) send them to the highest bidder.
					</li>
					<li>
						Own a whole street group to charge double rent, then build cardboard
						boxes and trade four up for a cat house.
					</li>
					<li>
						Trade with the other cats. When fish run low, sell boxes, mortgage a
						street, or sell it back to the bank for half its price.
					</li>
					<li>Mind the Vet. A cat who can't pay their debts goes bankrupt.</li>
					<li>The last cat with fish left wins.</li>
				</>
			}
		>
			<div className="cat-eyes-occupied space-y-4">
				<Button size="compact-lg" onClick={() => startRoom()}>
					Start a room
				</Button>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (CODE_PATTERN.test(clean))
							navigate({ to: "/meownopoly/$code", params: { code: clean } });
					}}
				>
					<Input
						aria-label="Room code"
						placeholder="Room code"
						value={code}
						maxLength={5}
						autoCapitalize="characters"
						onChange={(e) => setCode(e.target.value)}
						className="w-40 uppercase"
					/>
					<Button
						size="compact"
						type="submit"
						variant="outline"
						disabled={!CODE_PATTERN.test(clean)}
					>
						Join
					</Button>
				</form>
			</div>
		</GameIntro>
	);
}
