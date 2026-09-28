import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import { cn } from "#/lib/utils";
import { Wordmark } from "./wordmark";

/** "cat.log › Game" at the top of a game screen. */
export function GameBreadcrumb({
	to,
	children,
	className,
	linkClassName,
	hideHomeOnMobile = false,
}: {
	/** The game's intro page. */
	to: LinkProps["to"];
	children: ReactNode;
	className?: string;
	linkClassName?: string;
	/** Drop the cat.log link on phones, where the header is tight. */
	hideHomeOnMobile?: boolean;
}) {
	const home = hideHomeOnMobile && "max-sm:hidden";
	return (
		<Breadcrumb>
			<BreadcrumbList className={className}>
				<BreadcrumbItem className={cn(home)}>
					<BreadcrumbLink asChild>
						<Link to="/">
							<Wordmark />
						</Link>
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator className={cn(home)} />
				<BreadcrumbItem>
					<BreadcrumbLink
						asChild
						className={cn("font-display text-foreground", linkClassName)}
					>
						<Link to={to}>{children}</Link>
					</BreadcrumbLink>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
