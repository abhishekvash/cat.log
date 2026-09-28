import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";

/** The quiet "← back" link at the top of intro pages and lobbies. */
export function BackLink({
	to,
	children,
}: {
	to: LinkProps["to"];
	children: ReactNode;
}) {
	return (
		<Button
			asChild
			variant="ghost"
			size="compact"
			className="-ml-3 self-start text-muted-foreground"
		>
			<Link to={to}>
				<ArrowLeftIcon /> {children}
			</Link>
		</Button>
	);
}
