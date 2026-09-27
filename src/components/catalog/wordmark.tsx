import { cn } from "#/lib/utils";

/** The cat.log wordmark: a catalog of games, styled like a log file. */
export function Wordmark({ className }: { className?: string }) {
	return (
		<span className={cn("font-display font-semibold", className)}>
			cat<span className="font-mono text-primary">.log</span>
		</span>
	);
}
