import { ArrowRightIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "#/components/catalog/wordmark";
import { CatEars } from "#/components/cats/cat-ears";
import { CatHead, SleepyCat } from "#/components/cats/cat-face";
import { Pin } from "#/components/mastermind/pins";
import { groupStyle } from "#/components/monopawly/bits";
import { Fur } from "#/components/monopawly/fur";
import { Art, FishIcon } from "#/components/monopawly/tile-art";
import { Badge } from "#/components/ui/badge";
import { Card } from "#/components/ui/card";
import { type CatalogGame, GAMES } from "#/lib/catalog";
import { CATS, type Cat } from "#/lib/cats";
import { CODE_COLORS } from "#/lib/mastermind";
import type { GroupId } from "#/lib/monopawly/board";
import { jsonLd, SITE_NAME, SITE_URL, seo } from "#/lib/seo";

const DESCRIPTION =
	"cat.log is a little catalog of cozy cat games to play together, free in your browser. Pass one iPad around in Meowstermind, or play Monopawly with up to six cats, each on their own device.";

export const Route = createFileRoute("/")({
	head: () => ({
		...seo({
			title: "cat.log · Cozy cat games to play together",
			description: DESCRIPTION,
			path: "/",
		}),
		scripts: [
			jsonLd({
				"@type": "WebSite",
				name: SITE_NAME,
				alternateName: "catlog.party",
				url: SITE_URL,
				description: DESCRIPTION,
			}),
		],
	}),
	component: Catalog,
});

/** A tiny, live-looking slice of each game for its tile. */
const PREVIEWS: Record<CatalogGame["path"], ReactNode> = {
	"/meowstermind": <MeowstermindPreview />,
	"/monopawly": <MonopawlyPreview />,
};

function Catalog() {
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-14 px-6 py-12 md:py-20">
			<section className="max-w-2xl space-y-5">
				<h1 className="font-display text-5xl font-semibold leading-tight md:text-6xl">
					Welcome to <Wordmark />
				</h1>
				<p className="text-lg text-muted-foreground">
					A little catalog of cozy games to play together. Pass one iPad around,
					or bring a few friends and a device each. nya~
				</p>
			</section>

			<section className="space-y-4">
				<h2 className="font-display text-2xl font-semibold">Games</h2>
				{/* Top padding leaves room for the ears poking above each tile. */}
				<div className="grid gap-x-6 gap-y-12 pt-8 sm:grid-cols-2 lg:grid-cols-3">
					{GAMES.map((game) => (
						<GameTile key={game.path} game={game} />
					))}
					<ComingSoonTile />
				</div>
			</section>
		</main>
	);
}

function GameTile({ game }: { game: CatalogGame }) {
	return (
		<Link
			to={game.path}
			className="group flex rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="relative flex-1 gap-4 p-5 transition group-hover:-translate-y-1 group-hover:border-primary/50 motion-reduce:group-hover:translate-y-0">
				<CatEars />
				<div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-well/60 px-3">
					{PREVIEWS[game.path]}
				</div>
				<div className="space-y-1.5">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="font-display text-xl font-semibold">{game.title}</h3>
						<span className="flex shrink-0 items-center gap-1 font-display text-sm font-medium text-primary">
							Play
							<ArrowRightIcon className="size-4 self-center transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
						</span>
					</div>
					<p className="text-sm text-muted-foreground">{game.blurb}</p>
				</div>
				<div className="mt-auto flex flex-wrap gap-1.5">
					{game.tags.map((tag) => (
						<Badge
							key={tag}
							variant="outline"
							className="font-normal text-muted-foreground"
						>
							{tag}
						</Badge>
					))}
				</div>
			</Card>
		</Link>
	);
}

function ComingSoonTile() {
	return (
		<Card className="items-center justify-center gap-3 border-dashed bg-card/40 p-5 text-center shadow-none sm:min-h-72">
			<SleepyCat size="3.25rem" />
			<div className="space-y-1">
				<h3 className="font-display text-xl font-semibold">
					More games coming soon
				</h3>
				<p className="text-sm text-muted-foreground">
					zzz… the next one is still napping.
				</p>
			</div>
		</Card>
	);
}

/** A tiny slice of the board: one guess and its paw scores. */
function MeowstermindPreview() {
	const keys = ["pink", "pink", "white", null, "white"] as const;
	return (
		<div className="flex items-center gap-3">
			<div className="flex gap-1">
				{CODE_COLORS.map((color) => (
					<Pin key={color} color={color} kind="code" size="1.85rem" />
				))}
			</div>
			<div className="flex gap-0.5">
				{keys.map((key, i) =>
					key ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative row
						<Pin key={i} color={key} kind="key" size="0.85rem" />
					) : (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative row
							key={i}
							className="size-[0.85rem] rounded-full bg-well/70 shadow-hole"
						/>
					),
				)}
			</div>
		</div>
	);
}

const STREETS: {
	group: GroupId;
	price?: number;
	owner?: Cat;
	boxes?: number;
}[] = [
	{ group: 2, price: 100 },
	{ group: 3, owner: "ginger", boxes: 2 },
	{ group: 3, owner: "ginger" },
	{ group: 7, owner: "calico" },
	{ group: 8, price: 400 },
];

/** A few streets off the board, some claimed in their owner's fur, and the cats. */
function MonopawlyPreview() {
	return (
		<div className="flex flex-col items-center gap-3">
			<div className="flex gap-px overflow-hidden rounded-md border bg-border">
				{STREETS.map((street, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative row
						key={i}
						className="flex h-14 w-11 flex-col items-center justify-end gap-1 bg-group-tint p-1 text-xs text-muted-foreground"
						style={groupStyle(street.group)}
					>
						{street.boxes ? <Art name="box" className="size-4" /> : null}
						{street.owner ? (
							<span className="h-3 w-full overflow-hidden rounded-full border border-sticker/85">
								<Fur cat={street.owner} />
							</span>
						) : (
							<span className="whitespace-nowrap">
								{street.price}
								<FishIcon />
							</span>
						)}
					</div>
				))}
			</div>
			<div className="flex gap-1">
				{CATS.map((cat) => (
					<CatHead key={cat} cat={cat} size="1.6rem" />
				))}
			</div>
		</div>
	);
}
