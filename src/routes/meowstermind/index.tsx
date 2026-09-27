import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "#/components/catalog/wordmark";
import { Pin } from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import { CODE_COLORS } from "#/lib/mastermind";
import { jsonLd, SITE_URL, seo } from "#/lib/seo";

const DESCRIPTION =
	"Meowstermind is a free two-player Mastermind with cats. Hide a secret row of kitties, then crack it with paw-print clues. Pass and play in your browser, made for iPad.";

export const Route = createFileRoute("/meowstermind/")({
	head: () => ({
		...seo({
			title: "Meowstermind: a cozy two-player cat Mastermind · cat.log",
			description: DESCRIPTION,
			path: "/meowstermind",
		}),
		scripts: [
			jsonLd({
				"@type": "VideoGame",
				name: "Meowstermind",
				description: DESCRIPTION,
				url: `${SITE_URL}/meowstermind`,
				image: `${SITE_URL}/og.png`,
				genre: ["Puzzle", "Board game", "Code-breaking"],
				gamePlatform: "Web browser",
				applicationCategory: "Game",
				operatingSystem: "Any",
				playMode: "MultiPlayer",
				numberOfPlayers: { "@type": "QuantitativeValue", value: 2 },
				isAccessibleForFree: true,
				offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
				isPartOf: { "@type": "WebSite", name: "cat.log", url: SITE_URL },
			}),
		],
	}),
	component: Home,
});

function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
			<Button
				asChild
				variant="ghost"
				size="compact"
				className="-ml-3 self-start text-muted-foreground"
			>
				<Link to="/">
					<ArrowLeftIcon /> Back to <Wordmark />
				</Link>
			</Button>
			<div className="flex gap-2">
				{CODE_COLORS.map((color) => (
					<Pin key={color} color={color} kind="code" size="2.75rem" />
				))}
			</div>
			<div className="space-y-2">
				<h1 className="font-display text-4xl font-semibold">
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
					The codebreaker has 10 tries, dragging kitties from the tray into each
					row.
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
					Swap roles every round. The codebreaker scores 11 minus the tries they
					needed; highest score wins the match.
				</li>
			</ol>
			<Button asChild size="lg" className="self-start">
				<Link to="/meowstermind/play">Let’s play</Link>
			</Button>
		</main>
	);
}
