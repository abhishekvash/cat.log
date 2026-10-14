import { createFileRoute, redirect } from "@tanstack/react-router";

/** The game's old name; old room links still land in the same room. */
export const Route = createFileRoute("/monopawly/$code")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/meownopoly/$code",
			params: { code: params.code },
			replace: true,
		});
	},
});
