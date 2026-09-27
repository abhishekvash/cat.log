import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Wordmark } from "#/components/catalog/wordmark";
import { CatHead } from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { GAME_NAME } from "#/lib/monopawly/board";
import { CODE_PATTERN, newRoomCode } from "#/lib/monopawly/protocol";
import { CAT_TOKENS } from "#/lib/monopawly/types";
import { jsonLd, SITE_URL, seo } from "#/lib/seo";

const DESCRIPTION =
	"Monopawly is a free online property game for 2 to 6 cats. Buy streets in a cat town, build cardboard boxes and cat houses, trade, and be the last cat standing. Private rooms, no sign-up.";

export const Route = createFileRoute("/monopawly/")({
	head: () => ({
		...seo({
			title: `${GAME_NAME}: a cozy online property game with cats · cat.log`,
			description: DESCRIPTION,
			path: "/monopawly",
		}),
		scripts: [
			jsonLd({
				"@type": "VideoGame",
				name: GAME_NAME,
				description: DESCRIPTION,
				url: `${SITE_URL}/monopawly`,
				image: `${SITE_URL}/og.png`,
				genre: ["Board game", "Trading", "Strategy"],
				gamePlatform: "Web browser",
				applicationCategory: "Game",
				operatingSystem: "Any",
				playMode: "MultiPlayer",
				numberOfPlayers: {
					"@type": "QuantitativeValue",
					minValue: 2,
					maxValue: 6,
				},
				isAccessibleForFree: true,
				offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
				isPartOf: { "@type": "WebSite", name: "cat.log", url: SITE_URL },
			}),
		],
	}),
	component: Home,
});

function Home() {
	const navigate = useNavigate();
	const [code, setCode] = useState("");
	const clean = code.trim().toUpperCase();

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
				{CAT_TOKENS.map((cat) => (
					<CatHead key={cat} coat={cat} size="2.75rem" />
				))}
			</div>
			<div className="space-y-2">
				<h1 className="font-display text-4xl font-semibold">
					Mono<span className="text-primary">pawly</span>
				</h1>
				<p className="text-muted-foreground">
					A classic property game in a cat town, for 2 to 6 players, each on
					their own tablet or computer.
				</p>
			</div>
			<ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
				<li>
					Roll and walk the board. Buy the streets you land on, or send them to
					auction.
				</li>
				<li>
					Own a whole street group to charge double rent, then build cardboard
					boxes and trade four up for a cat house.
				</li>
				<li>
					Trade with the other cats, mortgage when fish run low, and mind the
					Vet.
				</li>
				<li>The last cat with fish left wins.</li>
			</ol>
			<div className="space-y-4">
				<Button
					size="compact-lg"
					onClick={() =>
						navigate({
							to: "/monopawly/$code",
							params: { code: newRoomCode() },
							search: { new: true },
						})
					}
				>
					Start a room
				</Button>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (CODE_PATTERN.test(clean))
							navigate({ to: "/monopawly/$code", params: { code: clean } });
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
		</main>
	);
}
