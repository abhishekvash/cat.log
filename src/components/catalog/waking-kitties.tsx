import type { CSSProperties } from "react";
import { SleepyCat } from "#/components/mastermind/pins";

/**
 * The loading state for any route that's still arriving, e.g. a game that can
 * only render in the browser. Registered on the router (not per route) so it
 * isn't code-split away from the server render.
 */
export function WakingKitties() {
	return (
		<div
			className="flex min-h-dvh flex-col items-center justify-center gap-3"
			style={{ "--pin": "3.5rem" } as CSSProperties}
		>
			<SleepyCat />
			<p className="text-sm text-muted-foreground">Waking the kitties…</p>
		</div>
	);
}
