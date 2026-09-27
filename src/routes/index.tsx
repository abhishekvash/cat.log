import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Wordmark } from "#/components/catalog/wordmark";
import { CatEars } from "#/components/mastermind/cat-ears";
import { Pin, SleepyCat } from "#/components/mastermind/pins";
import { CODE_COLORS } from "#/lib/mastermind";

export const Route = createFileRoute("/")({ component: Catalog });

interface Game {
	to: string;
	title: string;
	blurb: string;
	tags: string[];
	preview: ReactNode;
}

// The catalog. Adding a game is one more entry here plus its routes.
const GAMES: Game[] = [
	{
		to: "/meowstermind",
		title: "Meowstermind",
		blurb:
			"Hide a secret row of kitties and let your friend crack it with paw-print clues.",
		tags: ["2 players", "Pass & play", "~10 min"],
		preview: <MeowstermindPreview />,
	},
];

function Catalog() {
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-14 px-6 py-12 md:py-20">
			<section className="max-w-2xl space-y-5">
				<h1 className="font-display text-5xl font-semibold leading-tight md:text-6xl">
					Welcome to <Wordmark />
				</h1>
				<p className="text-lg text-muted-foreground">
					A little catalog of cozy games for playing together on one screen.
					Pick one, grab a friend, pass the iPad. nya~
				</p>
			</section>

			<section className="space-y-4">
				<h2 className="font-display text-2xl font-semibold">Games</h2>
				{/* Top padding leaves room for the ears poking above each tile. */}
				<div className="grid gap-x-6 gap-y-12 pt-8 sm:grid-cols-2 lg:grid-cols-3">
					{GAMES.map((game) => (
						<GameTile key={game.to} game={game} />
					))}
					<ComingSoonTile />
				</div>
			</section>
		</main>
	);
}

function GameTile({ game }: { game: Game }) {
	return (
		<Link
			to={game.to}
			className="group relative flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-table outline-none transition hover:-translate-y-1 hover:border-primary/50 motion-reduce:hover:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring"
		>
			<CatEars />
			<div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-well/60 px-3">
				{game.preview}
			</div>
			<div className="space-y-1.5">
				<div className="flex items-baseline justify-between gap-3">
					<h3 className="font-display text-xl font-semibold">{game.title}</h3>
					<span className="flex shrink-0 items-center gap-1 font-display text-sm font-medium text-primary">
						Play
						<ArrowRight className="size-4 self-center transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
					</span>
				</div>
				<p className="text-sm text-muted-foreground">{game.blurb}</p>
			</div>
			<div className="mt-auto flex flex-wrap gap-1.5">
				{game.tags.map((tag) => (
					<span
						key={tag}
						className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
					>
						{tag}
					</span>
				))}
			</div>
		</Link>
	);
}

function ComingSoonTile() {
	return (
		<div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-card/40 p-5 text-center sm:min-h-72">
			{/* SleepyCat sizes itself from --pin. */}
			<div style={{ "--pin": "3.25rem" } as CSSProperties}>
				<SleepyCat />
			</div>
			<div className="space-y-1">
				<h3 className="font-display text-xl font-semibold">
					More games coming soon
				</h3>
				<p className="text-sm text-muted-foreground">
					zzz… the next one is still napping.
				</p>
			</div>
		</div>
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
