import { createFileRoute, Link } from "@tanstack/react-router";
import { Pin } from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import { CODE_COLORS } from "#/lib/mastermind";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
			<div className="flex gap-2">
				{CODE_COLORS.map((color) => (
					<Pin key={color} color={color} kind="code" size="2.75rem" />
				))}
			</div>
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">
					Meow<span className="text-primary">stermind</span>
				</h1>
				<p className="text-muted-foreground">
					A cozy two-player code-breaking game for one screen.
				</p>
			</div>
			<ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
				<li>
					The mastermind hides a code of 5 kitties: grey, white, black, orange
					and siamese.
				</li>
				<li>
					The player has 10 tries, dragging kitties from the tray into each row.
				</li>
				<li>
					After each try the mastermind paw-scores every spot in order:
					<span className="mt-2 flex flex-col gap-1.5">
						<span className="flex items-center gap-2">
							<Pin color="pink" kind="key" size="1rem" /> pink: right cat, right
							spot
						</span>
						<span className="flex items-center gap-2">
							<Pin color="white" kind="key" size="1rem" /> white: right cat,
							wrong spot
						</span>
						<span className="flex items-center gap-2">
							<span className="size-4 rounded-full bg-black/25 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]" />
							not in the code
						</span>
					</span>
				</li>
				<li>
					A perfect guess is spotted automatically, with exploding kittens.
					Purrfect!
				</li>
				<li>
					Swap roles every round. The codebreaker scores 11 minus the tries they
					needed; highest score wins the match.
				</li>
			</ol>
			<Button asChild size="lg" className="self-start">
				<Link to="/play">Let’s play</Link>
			</Button>
		</main>
	);
}
