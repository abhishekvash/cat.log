import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type ReactNode, useId } from "react";
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

const OUTLINE = "#2a1f26";
const STICKER = "#fff4f8";
const INNER_EAR = "#f7a8b8";
const BLUSH = "#ff8fb1";

// [highlight, base, shade] for the glossy score paws.
const KEY_SHADES: Record<KeyColor, [string, string, string]> = {
	pink: ["#ffd6e5", "#ff7eb0", "#d6457f"],
	white: ["#fffafc", "#fff4f8", "#d9c3cf"],
};

interface Coat {
	fur: string;
	iris: string;
	leftEar?: string;
	rightEar?: string;
	/** Patches and stripes, clipped to the head shape. */
	markings?: ReactNode;
}

// Each cat differs in fur and eye color (plus the siamese's dark points), so no
// two look alike even at a glance.
const COATS: Record<CodeColor, Coat> = {
	grey: {
		fur: "#a7b0bb",
		iris: "#f2a93b",
		markings: (
			<g stroke="#7d8793" strokeWidth={3.5} strokeLinecap="round">
				<path d="M44 31 L46 40" />
				<path d="M50 30 L50 40" />
				<path d="M56 31 L54 40" />
			</g>
		),
	},
	white: {
		fur: "#fbf8f4",
		iris: "#f2c14e",
	},
	black: {
		fur: "#2d2a31",
		iris: "#a6e07a",
	},
	ginger: {
		fur: "#f4a259",
		iris: "#8cc751",
		markings: (
			<>
				<ellipse cx="50" cy="76" rx="19" ry="13" fill="#fde2c0" />
				<g stroke="#d9772e" strokeWidth={4} strokeLinecap="round">
					<path d="M43 30 L45 40" />
					<path d="M50 29 L50 41" />
					<path d="M57 30 L55 40" />
					<path d="M11 58 L20 60" />
					<path d="M89 58 L80 60" />
				</g>
			</>
		),
	},
	// Beige coat with near-black points on the ears and face mask.
	siamese: {
		fur: "#e9d3b1",
		iris: "#4fb3f0",
		leftEar: "#2f2724",
		rightEar: "#2f2724",
		markings: <ellipse cx="50" cy="71" rx="26" ry="20" fill="#2f2724" />,
	},
};

export const PIN_SIZE: Record<PinKind, string> = {
	code: "var(--pin)",
	key: "var(--key)",
};

// Shapes in a 100x100 box: pointy ears above a wide, round cat head.
const LEFT_EAR = "M15 50 L19 11 Q20 6 25 8 L48 28 Z";
const RIGHT_EAR = "M85 50 L81 11 Q80 6 75 8 L52 28 Z";
const HEAD = { cx: 50, cy: 60, rx: 40, ry: 33 };

// SVG ids from useId can contain characters that break `url(#id)` references.
const useSvgId = () => `svg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

function CatFace({ coat, asleep = false }: { coat: Coat; asleep?: boolean }) {
	const clip = useSvgId();
	const line = {
		stroke: OUTLINE,
		strokeWidth: 3.5,
		strokeLinejoin: "round",
	} as const;
	return (
		<>
			<defs>
				<clipPath id={clip}>
					<ellipse {...HEAD} />
				</clipPath>
			</defs>
			{/* Sticker border so dark cats still pop on the dark board. */}
			<g
				fill={STICKER}
				stroke={STICKER}
				strokeWidth={11}
				strokeLinejoin="round"
				opacity={asleep ? 0.25 : 1}
			>
				<path d={LEFT_EAR} />
				<path d={RIGHT_EAR} />
				<ellipse {...HEAD} />
			</g>
			<path d={LEFT_EAR} fill={coat.leftEar ?? coat.fur} {...line} />
			<path d={RIGHT_EAR} fill={coat.rightEar ?? coat.fur} {...line} />
			<path d="M23 38 L25 17 L39 28 Z" fill={INNER_EAR} />
			<path d="M77 38 L75 17 L61 28 Z" fill={INNER_EAR} />
			<ellipse {...HEAD} fill={coat.fur} />
			<g clipPath={`url(#${clip})`}>{coat.markings}</g>
			<ellipse {...HEAD} fill="none" {...line} />

			{asleep ? (
				<g stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" fill="none">
					<path d="M26 60 Q34 67 42 60" />
					<path d="M58 60 Q66 67 74 60" />
				</g>
			) : (
				[34, 66].map((cx) => (
					<g key={cx}>
						<circle
							cx={cx}
							cy="60"
							r="8.5"
							fill={coat.iris}
							stroke={OUTLINE}
							strokeWidth={2.5}
						/>
						<ellipse cx={cx} cy="60" rx="3.5" ry="6" fill={OUTLINE} />
						<circle cx={cx + 2.5} cy="56.5" r="2.5" fill={STICKER} />
					</g>
				))
			)}
			<ellipse cx="22" cy="72" rx="6" ry="3.5" fill={BLUSH} opacity={0.6} />
			<ellipse cx="78" cy="72" rx="6" ry="3.5" fill={BLUSH} opacity={0.6} />
			<path
				d="M46.5 70 L53.5 70 L50 74 Z"
				fill="#f28aa0"
				stroke={OUTLINE}
				strokeWidth={1.5}
				strokeLinejoin="round"
			/>
			<path
				d="M43 77 Q46.5 81 50 77 Q53.5 81 57 77"
				stroke={OUTLINE}
				strokeWidth={2.5}
				strokeLinecap="round"
				fill="none"
			/>
		</>
	);
}

// A paw print in a 100x100 box.
function Paw({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
	return (
		<g fill={fill} opacity={opacity}>
			<ellipse cx="50" cy="64" rx="17" ry="14" />
			<ellipse cx="29" cy="45" rx="7" ry="9" />
			<ellipse cx="43" cy="34" rx="7" ry="9" />
			<ellipse cx="57" cy="34" rx="7" ry="9" />
			<ellipse cx="71" cy="45" rx="7" ry="9" />
		</g>
	);
}

function PawPin({ color }: { color: KeyColor }) {
	const id = useSvgId();
	const [light, base, shade] = KEY_SHADES[color];
	return (
		<>
			<defs>
				<radialGradient id={id} cx="38%" cy="32%" r="75%">
					<stop offset="0%" stopColor={light} />
					<stop offset="55%" stopColor={base} />
					<stop offset="100%" stopColor={shade} />
				</radialGradient>
			</defs>
			<circle cx="50" cy="50" r="46" fill={`url(#${id})`} />
			<Paw fill={shade} opacity={0.6} />
		</>
	);
}

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
		<span
			aria-hidden="true"
			style={{ width: size, height: size }}
			className={cn("block rounded-full", className)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				className="size-full overflow-visible drop-shadow-sticker"
			>
				{/* Cat and paw names overlap ("white"), so the kind decides what to draw. */}
				{kind === "key" ? (
					<PawPin color={color as KeyColor} />
				) : (
					<CatFace coat={COATS[color as CodeColor]} />
				)}
			</svg>
		</span>
	);
}

/** The hidden code: a sleeping cat that won't tell. */
export function SleepyCat() {
	return (
		<span
			role="img"
			aria-label="Hidden"
			style={{ width: PIN_SIZE.code, height: PIN_SIZE.code }}
			className="relative block"
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				className="size-full overflow-visible opacity-80"
			>
				<CatFace coat={{ fur: "#6e5a78", iris: OUTLINE }} asleep />
			</svg>
			<span className="absolute -top-1 -right-1 text-xs font-bold text-primary">
				z
			</span>
		</span>
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
