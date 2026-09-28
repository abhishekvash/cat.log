import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CatFace, Paw, PawToken, Sticker } from "#/components/cats/cat-face";
import type { CodeColor, KeyColor, PinColor } from "#/lib/mastermind";
import { cn } from "#/lib/utils";

export type PinKind = "code" | "key";

export type DragData =
	| { kind: "code"; color: CodeColor; from?: number }
	| { kind: "key"; color: KeyColor; from?: number };

export interface DropData {
	kind: PinKind;
	index: number;
	enabled: boolean;
}

export type Selection =
	| { kind: "code"; color: CodeColor }
	| { kind: "key"; color: KeyColor };

export const PIN_SIZE: Record<PinKind, string> = {
	code: "var(--pin)",
	key: "var(--key)",
};

/** A code cat or a score paw, sized for the board. */
export function Pin({
	color,
	kind,
	size = PIN_SIZE[kind],
	className,
}: {
	color: PinColor;
	kind: PinKind;
	size?: string;
	className?: string;
}) {
	return (
		<Sticker size={size} className={cn("rounded-full", className)}>
			{/* Cat and paw names overlap ("white"), so the kind decides what to draw. */}
			{kind === "key" ? (
				<PawToken color={color as KeyColor} />
			) : (
				<CatFace cat={color as CodeColor} />
			)}
		</Sticker>
	);
}

function Hole({ kind, over }: { kind: PinKind; over: boolean }) {
	return (
		<span
			aria-hidden="true"
			style={{ width: PIN_SIZE[kind], height: PIN_SIZE[kind] }}
			className={cn(
				"block rounded-full bg-well/70 shadow-hole transition-colors",
				over && "bg-primary/25 ring-2 ring-primary/60",
			)}
		>
			<svg aria-hidden="true" viewBox="0 0 100 100" className="size-full">
				<Paw fill="currentColor" opacity={0.08} />
			</svg>
		</span>
	);
}

/**
 * A board hole that accepts pins. When enabled and filled, the pin inside can be
 * dragged to another hole in the same row, or dragged off the board to remove it.
 */
export function Slot({
	id,
	kind,
	index,
	color,
	enabled,
	label,
	onTap,
}: {
	id: string;
	kind: PinKind;
	index: number;
	color: PinColor | null;
	enabled: boolean;
	label: string;
	onTap: () => void;
}) {
	// Always registered: dnd-kit doesn't reliably pick up droppables that flip from
	// disabled to enabled, so inactive holes are filtered out on drop instead.
	const drop = useDroppable({
		id: `drop-${id}`,
		data: { kind, index, enabled } satisfies DropData,
	});
	const drag = useDraggable({
		id: `drag-${id}`,
		data: { kind, color, from: index } as DragData,
		disabled: !enabled || color === null,
	});
	const accepts =
		enabled &&
		drop.isOver &&
		(drop.active?.data.current as DragData | undefined)?.kind === kind;

	return (
		<button
			type="button"
			ref={(node) => {
				drop.setNodeRef(node);
				drag.setNodeRef(node);
			}}
			{...(enabled && color ? drag.attributes : {})}
			{...(enabled && color ? drag.listeners : {})}
			aria-label={label}
			aria-disabled={!enabled}
			onClick={enabled ? onTap : undefined}
			className={cn(
				"relative flex touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
				// Fingers first: the hit area reaches into the gaps around each hole
				// (without moving the layout), so a slightly-off tap or drop still lands.
				// Cat holes reach 44px+; paw holes grow mostly vertically, where rows
				// have room, since their neighbours sit close together sideways.
				kind === "code" ? "-m-[3px] p-[3px]" : "-mx-1 -my-3 px-1 py-3",
				!enabled && "cursor-default",
			)}
		>
			{color ? (
				<Pin
					color={color}
					kind={kind}
					className={cn(
						drag.isDragging && "opacity-25",
						accepts && "ring-2 ring-primary/60",
					)}
				/>
			) : (
				<Hole kind={kind} over={accepts} />
			)}
		</button>
	);
}

/** A bottomless supply of one color that can be dragged, or tapped to select. */
export function TrayPin({
	selection,
	selected,
	disabled = false,
	onSelect,
}: {
	selection: Selection;
	selected: boolean;
	disabled?: boolean;
	onSelect: () => void;
}) {
	const { kind, color } = selection;
	const drag = useDraggable({
		id: `tray-${kind}-${color}`,
		data: { kind, color } as DragData,
		disabled,
	});
	return (
		<button
			type="button"
			ref={drag.setNodeRef}
			{...drag.attributes}
			{...drag.listeners}
			aria-label={`${color} ${kind === "code" ? "cat" : "paw"}`}
			aria-pressed={selected}
			disabled={disabled}
			onClick={onSelect}
			className={cn(
				"flex touch-none items-center justify-center rounded-full p-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35",
				selected && "bg-primary/20 ring-2 ring-primary",
			)}
		>
			<Pin
				color={color}
				kind={kind}
				size="2.75rem"
				className="active:scale-95"
			/>
		</button>
	);
}
