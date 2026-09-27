import type { ReactNode } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";

/**
 * Asks "are you sure?" before something that can't be undone (leaving a
 * game, going bankrupt, wiping scores). `children` is the button that opens it.
 */
export function ConfirmAction({
	title,
	description,
	action,
	onConfirm,
	children,
}: {
	title: string;
	description: ReactNode;
	action: string;
	onConfirm: () => void;
	children: ReactNode;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel size="compact-lg">Cancel</AlertDialogCancel>
					<AlertDialogAction
						size="compact-lg"
						variant="destructive"
						onClick={onConfirm}
					>
						{action}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
