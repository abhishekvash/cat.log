import { createFileRoute, Link } from "@tanstack/react-router";
import { GameIntro } from "#/components/catalog/game-intro";
import { Pin } from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import { MEOWSTERMIND } from "#/lib/catalog";
import { CODE_COLORS, PEGS, ROWS } from "#/lib/mastermind";
import { gameHead } from "#/lib/seo";

export const Route = createFileRoute("/meowstermind/")({
	head: () => gameHead(MEOWSTERMIND),
	component: Home,
});

function Home() {
	return (
		<GameIntro
			game={MEOWSTERMIND}
			pieces={CODE_COLORS.map((color) => (
				<Pin key={color} color={color} kind="code" size="2.75rem" />
			))}
			lede="A cozy two-player code-breaking game for one screen."
			rules={
				<>
					<li>
						The mastermind hides a code of {PEGS} kitties: grey, white, black,
						orange and siamese.
					</li>
					<li>
						The codebreaker has {ROWS} tries, dragging kitties from the tray
						into each row.
					</li>
					<li>
						After each try the mastermind paw-scores every spot in order:
						<span className="mt-2 flex flex-col gap-1.5">
							<span className="flex items-center gap-2">
								<Pin color="pink" kind="key" size="1rem" /> pink: right cat,
								right spot
							</span>
							<span className="flex items-center gap-2">
								<Pin color="white" kind="key" size="1rem" /> white: right cat,
								wrong spot
							</span>
							<span className="flex items-center gap-2">
								<span className="size-4 rounded-full bg-well/70 shadow-hole" />
								not in the code
							</span>
						</span>
					</li>
					<li>
						A perfect guess is spotted automatically, with exploding kittens.
						Purrfect!
					</li>
					<li>
						Swap roles every round. The codebreaker scores {ROWS + 1} minus the
						tries they needed; highest score wins the match.
					</li>
				</>
			}
		>
			<Button asChild size="lg" className="self-start">
				<Link to="/meowstermind/play">Let’s play</Link>
			</Button>
		</GameIntro>
	);
}
