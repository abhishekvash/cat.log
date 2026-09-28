import type { ReactNode } from "react";
import type { CatalogGame } from "#/lib/catalog";
import { BackLink } from "./back-link";
import { Wordmark } from "./wordmark";

/**
 * A game's intro page: back to the catalog, a row of its pieces, the two-tone
 * title, a line about it, the rules, and whatever starts a game (`children`).
 */
export function GameIntro({
	game,
	pieces,
	lede,
	rules,
	children,
}: {
	game: CatalogGame;
	pieces: ReactNode;
	lede: ReactNode;
	/** `<li>` items. */
	rules: ReactNode;
	children: ReactNode;
}) {
	const [plain, accent] = game.titleParts;
	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
			<BackLink to="/">
				Back to <Wordmark />
			</BackLink>
			<div className="flex gap-2">{pieces}</div>
			<div className="space-y-2">
				<h1 className="font-display text-4xl font-semibold">
					{plain}
					<span className="text-primary">{accent}</span>
				</h1>
				<p className="text-muted-foreground">{lede}</p>
			</div>
			<ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
				{rules}
			</ol>
			{children}
		</main>
	);
}
