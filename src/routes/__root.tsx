import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import { CatEyes } from "#/components/mastermind/cat-eyes";
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
			{ name: "apple-mobile-web-app-title", content: "Meowstermind" },
			{ name: "theme-color", content: "#2a1c33" },
			{ title: "Meowstermind" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
});

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
