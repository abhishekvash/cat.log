import { CrownIcon, type Icon, WifiSlashIcon } from "@phosphor-icons/react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

/** A small status icon, named on hover (and to screen readers). */
export function IconHint({
	icon: Icon,
	label,
	className,
}: {
	icon: Icon;
	label: string;
	className?: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Icon
					className={cn("size-3.5 text-muted-foreground", className)}
					aria-label={label}
				/>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

export const HostCrown = () => (
	<IconHint icon={CrownIcon} label="Host" className="text-primary" />
);

export const Disconnected = () => (
	<IconHint icon={WifiSlashIcon} label="Disconnected" />
);
