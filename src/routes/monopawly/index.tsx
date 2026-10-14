import { createFileRoute, redirect } from "@tanstack/react-router";

/** The game's old name; old links still land in the right place. */
export const Route = createFileRoute("/monopawly/")({
	beforeLoad: () => {
		throw redirect({ to: "/meownopoly", replace: true });
	},
});
