import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameIntro } from "#/components/catalog/game-intro";
import { CatHead } from "#/components/cats/cat-face";
import { tintOf } from "#/components/mewdo/palette";
import { useStartRoom } from "#/components/multiplayer/use-start-room";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { MEWDO } from "#/lib/catalog";
import { CORE_CATS } from "#/lib/cats";
import { mewdoClient } from "#/lib/mewdo/client";
import type { Corner } from "#/lib/mewdo/types";
import { CODE_PATTERN } from "#/lib/multiplayer/protocol";
import { gameHead } from "#/lib/seo";

export const Route = createFileRoute("/mewdo/")({
	head: () => gameHead(MEWDO),
	component: Home,
});

function Home() {
	const navigate = useNavigate();
	const startRoom = useStartRoom(mewdoClient.id);
	const [code, setCode] = useState("");
	const clean = code.trim().toUpperCase();
	const { min, max } = MEWDO.players;

	return (
		<GameIntro
			game={MEWDO}
			pieces={CORE_CATS.slice(0, 4).map((cat, i) => (
				<span
					key={cat}
					className="rounded-full p-1"
					style={{ background: tintOf(i as Corner) }}
				>
					<CatHead cat={cat} size="2.4rem" />
				</span>
			))}
			lede={`A race to the food bowl for ${min} to ${max} cats. Pass one screen around the table, or play online with a device each.`}
			rules={
				<>
					<li>Everyone has four kittens waiting in their basket.</li>
					<li>
						Roll a 6 to let a kitten out. A 6 also rolls again, but three 6s in
						a row and your turn is over.
					</li>
					<li>
						Kittens hop clockwise round the board, then up their own lane to the
						food bowl. You need the exact roll to get in.
					</li>
					<li>
						Land on another cat's kitten to boop it back to its basket, and roll
						again. Nobody gets booped on a paw-print cushion.
					</li>
					<li>
						Get all four home to finish. Play goes on until every place is
						decided.
					</li>
				</>
			}
		>
			<div className="cat-eyes-occupied space-y-4">
				<div className="flex flex-wrap gap-2">
					<Button asChild size="compact-lg">
						<Link to="/mewdo/play">Play on this screen</Link>
					</Button>
					<Button
						size="compact-lg"
						variant="outline"
						onClick={() => startRoom()}
					>
						Start an online room
					</Button>
				</div>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (CODE_PATTERN.test(clean))
							navigate({ to: "/mewdo/$code", params: { code: clean } });
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
