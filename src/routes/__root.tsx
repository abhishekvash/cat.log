import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";

import { CatEyes } from "#/components/mastermind/cat-eyes";
import { SleepyCat } from "#/components/mastermind/pins";
import { Button } from "#/components/ui/button";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-title", content: "cat.log" },
			// Velvet Dusk, so the iPad status bar blends into the page.
			{ name: "theme-color", content: "#1a1223" },
			{ title: "cat.log" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{
				rel: "icon",
				href: "/favicon-32.png",
				type: "image/png",
				sizes: "32x32",
			},
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/manifest.webmanifest" },
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
});

function NotFound() {
	return (
		<main
			className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center"
			style={{ "--pin": "4rem" } as React.CSSProperties}
		>
			<SleepyCat />
			<div className="space-y-1.5">
				<h1 className="font-display text-2xl font-semibold">
					This page wandered off
				</h1>
				<p className="text-muted-foreground">
					It's probably napping somewhere warm.
				</p>
			</div>
			<Button asChild size="lg">
				<Link to="/">Back to cat.log</Link>
			</Button>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				<CatEyes />
				{children}
				<Scripts />
			</body>
		</html>
	);
}
