import { IconContext } from "@phosphor-icons/react";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { CatEyes } from "#/components/cats/cat-eyes";
import { SleepyScreen } from "#/components/cats/sleepy-screen";
import { Button } from "#/components/ui/button";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
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
		<SleepyScreen
			title="This page wandered off"
			actions={
				<Button asChild size="lg">
					<Link to="/">Back to cat.log</Link>
				</Button>
			}
		>
			It's probably napping somewhere warm.
		</SleepyScreen>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				{/* Phosphor's bold weight sits best beside the chunky sticker cats. */}
				<IconContext.Provider value={{ weight: "bold" }}>
					<TooltipProvider delayDuration={300}>
						<CatEyes />
						{children}
						<Toaster position="bottom-center" />
					</TooltipProvider>
				</IconContext.Provider>
				<Scripts />
			</body>
		</html>
	);
}
