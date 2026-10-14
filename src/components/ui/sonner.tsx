import {
	CheckCircleIcon,
	InfoIcon,
	SpinnerIcon,
	WarningIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "#/lib/utils";

// cat.log is always dark, so the theme is fixed rather than read from next-themes.
const Toaster = ({ toastOptions, ...props }: ToasterProps) => (
	<Sonner
		theme="dark"
		className="toaster group"
		toastOptions={{
			...toastOptions,
			className: cn("cat-eyes-occupied", toastOptions?.className),
		}}
		icons={{
			success: <CheckCircleIcon className="size-4" />,
			info: <InfoIcon className="size-4" />,
			warning: <WarningIcon className="size-4" />,
			error: <XCircleIcon className="size-4" />,
			loading: <SpinnerIcon className="size-4 animate-spin" />,
		}}
		style={
			{
				"--normal-bg": "var(--popover)",
				"--normal-text": "var(--popover-foreground)",
				"--normal-border": "var(--border)",
				"--border-radius": "8px",
			} as React.CSSProperties
		}
		{...props}
	/>
);

export { Toaster };
