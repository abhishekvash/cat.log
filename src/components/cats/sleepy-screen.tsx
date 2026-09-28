import type { ReactNode } from "react";
import { SleepyCat } from "./cat-face";

/** A whole page with a sleeping cat: not found, room gone, and the like. */
export function SleepyScreen({
	title,
	children,
	actions,
}: {
	title: string;
	/** A line or two under the title. */
	children: ReactNode;
	actions: ReactNode;
}) {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
			<SleepyCat size="4rem" />
			<div className="space-y-1.5">
				<h1 className="font-display text-2xl font-semibold">{title}</h1>
				<p className="text-muted-foreground">{children}</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">{actions}</div>
		</main>
	);
}
