import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

/**
 * Monopawly's board art: chunky sticker SVGs drawn to match the cat heads
 * (near-black outline, Paw White sticker border, soft coat colours). Everything
 * lives in a 100×100 box.
 */

const OUTLINE = "#2a1f26";
const STICKER = "#fff4f8";
const PINK = "#ff7eb0";
const CREAM = "#fde2c0";
const GINGER = "#f4a259";
const CARDBOARD = "#d9a066";
const CARDBOARD_DARK = "#b9824a";
const LILAC = "#c9b6e4";
const MINT = "#8fd3a4";
const SKY = "#9fd3ea";
const BUTTER = "#f0d67a";

const line = {
	stroke: OUTLINE,
	strokeWidth: 4,
	strokeLinejoin: "round",
	strokeLinecap: "round",
} as const;

export type ArtName =
	| "fish"
	| "flap"
	| "laser"
	| "catnip"
	| "zoomies"
	| "treatJar"
	| "bill"
	| "comb"
	| "vet"
	| "caught"
	| "nap"
	| "bowl"
	| "box"
	| "catHouse";

const ART: Record<ArtName, ReactNode> = {
	fish: (
		<>
			<path d="M78 50 L96 34 L94 66 Z" fill={SKY} {...line} />
			<ellipse cx="46" cy="50" rx="36" ry="24" fill={SKY} {...line} />
			<path d="M30 36 Q38 50 30 64" fill="none" {...line} />
			<circle cx="20" cy="46" r="4" fill={OUTLINE} />
		</>
	),
	flap: (
		<>
			<rect
				x="20"
				y="10"
				width="60"
				height="80"
				rx="10"
				fill={CARDBOARD}
				{...line}
			/>
			<rect
				x="32"
				y="44"
				width="36"
				height="34"
				rx="8"
				fill={CREAM}
				{...line}
			/>
			<path d="M34 44 L66 44" {...line} strokeWidth={6} />
			<ellipse cx="50" cy="66" rx="6" ry="5" fill={PINK} />
			<circle cx="42" cy="58" r="2.5" fill={PINK} />
			<circle cx="50" cy="55" r="2.5" fill={PINK} />
			<circle cx="58" cy="58" r="2.5" fill={PINK} />
		</>
	),
	laser: (
		<>
			<rect
				x="14"
				y="58"
				width="50"
				height="16"
				rx="8"
				transform="rotate(-35 39 66)"
				fill={LILAC}
				{...line}
			/>
			<path
				d="M58 44 L70 34"
				stroke={PINK}
				strokeWidth={5}
				strokeLinecap="round"
			/>
			<circle cx="76" cy="28" r="13" fill={PINK} {...line} />
			<circle cx="72" cy="24" r="4" fill={STICKER} />
		</>
	),
	catnip: (
		<>
			<path d="M50 90 Q48 60 52 20" fill="none" {...line} />
			<ellipse
				cx="34"
				cy="62"
				rx="16"
				ry="9"
				transform="rotate(-30 34 62)"
				fill={MINT}
				{...line}
			/>
			<ellipse
				cx="66"
				cy="50"
				rx="16"
				ry="9"
				transform="rotate(30 66 50)"
				fill={MINT}
				{...line}
			/>
			<ellipse
				cx="38"
				cy="34"
				rx="14"
				ry="8"
				transform="rotate(-40 38 34)"
				fill={MINT}
				{...line}
			/>
			<ellipse
				cx="60"
				cy="20"
				rx="12"
				ry="7"
				transform="rotate(35 60 20)"
				fill={MINT}
				{...line}
			/>
		</>
	),
	zoomies: (
		<>
			<rect
				x="22"
				y="10"
				width="56"
				height="80"
				rx="10"
				fill={LILAC}
				{...line}
			/>
			<path
				d="M56 20 L38 52 L52 52 L42 80 L64 44 L50 44 Z"
				fill={BUTTER}
				{...line}
				strokeWidth={3.5}
			/>
		</>
	),
	treatJar: (
		<>
			<rect
				x="20"
				y="30"
				width="60"
				height="60"
				rx="14"
				fill="#d6ecf5"
				{...line}
			/>
			<rect x="26" y="14" width="48" height="18" rx="6" fill={PINK} {...line} />
			<path
				d="M34 64 Q42 56 50 64 Q42 72 34 64 Z M50 64 L56 58 L56 70 Z"
				fill={GINGER}
				{...line}
				strokeWidth={3}
			/>
			<path
				d="M50 78 Q58 70 66 78 Q58 86 50 78 Z M66 78 L72 72 L72 84 Z"
				fill={GINGER}
				{...line}
				strokeWidth={3}
			/>
			<path
				d="M28 42 L28 58"
				stroke={STICKER}
				strokeWidth={5}
				strokeLinecap="round"
			/>
		</>
	),
	bill: (
		<>
			<path d="M24 10 H68 L78 20 V90 H24 Z" fill={CREAM} {...line} />
			<path d="M34 34 H68 M34 48 H68 M34 62 H56" {...line} strokeWidth={3.5} />
			<circle cx="64" cy="76" r="9" fill={PINK} {...line} strokeWidth={3} />
		</>
	),
	comb: (
		<>
			<rect
				x="12"
				y="30"
				width="76"
				height="22"
				rx="10"
				fill={LILAC}
				{...line}
			/>
			<path
				d="M22 52 V76 M32 52 V76 M42 52 V76 M52 52 V76 M62 52 V76 M72 52 V76 M80 52 V70"
				{...line}
				strokeWidth={5}
			/>
			<circle cx="24" cy="41" r="3" fill={STICKER} />
		</>
	),
	vet: (
		<>
			<circle cx="50" cy="50" r="38" fill={CREAM} {...line} />
			<path
				d="M42 24 H58 V42 H76 V58 H58 V76 H42 V58 H24 V42 H42 Z"
				fill={PINK}
				{...line}
				strokeWidth={3.5}
			/>
		</>
	),
	// A glass knocked off the counter, mid-spill.
	caught: (
		<>
			<path
				d="M16 78 Q30 66 54 72 Q76 78 88 72 Q92 86 70 88 H24 Q10 88 16 78 Z"
				fill={SKY}
				{...line}
			/>
			<g transform="rotate(-62 46 46)">
				<path d="M30 14 H62 L56 78 H36 Z" fill="#d6ecf5" {...line} />
				<path
					d="M33 40 H59 L56 78 H36 Z"
					fill={SKY}
					{...line}
					strokeWidth={3}
				/>
			</g>
			<circle cx="82" cy="58" r="4" fill={SKY} {...line} strokeWidth={2.5} />
			<circle cx="74" cy="48" r="3" fill={SKY} {...line} strokeWidth={2.5} />
		</>
	),
	nap: (
		<>
			<rect
				x="10"
				y="48"
				width="80"
				height="38"
				rx="18"
				fill={LILAC}
				{...line}
			/>
			<path d="M26 60 Q50 70 74 60" fill="none" {...line} strokeWidth={3} />
			<path
				d="M64 10 A18 18 0 1 0 82 34 A14 14 0 1 1 64 10 Z"
				fill={BUTTER}
				{...line}
				strokeWidth={3.5}
			/>
		</>
	),
	bowl: (
		<>
			<ellipse
				cx="34"
				cy="40"
				rx="12"
				ry="8"
				fill={GINGER}
				{...line}
				strokeWidth={3}
			/>
			<ellipse
				cx="56"
				cy="36"
				rx="14"
				ry="9"
				fill={GINGER}
				{...line}
				strokeWidth={3}
			/>
			<ellipse
				cx="68"
				cy="44"
				rx="10"
				ry="7"
				fill={GINGER}
				{...line}
				strokeWidth={3}
			/>
			<path d="M10 48 H90 Q86 86 50 86 Q14 86 10 48 Z" fill={PINK} {...line} />
			<path
				d="M38 64 Q44 70 50 64 Q56 70 62 64"
				fill="none"
				stroke={STICKER}
				strokeWidth={4}
				strokeLinecap="round"
			/>
		</>
	),
	box: (
		<>
			<path d="M14 36 L50 22 L86 36 L50 50 Z" fill={CARDBOARD} {...line} />
			<path d="M14 36 V72 L50 88 V50 Z" fill={CARDBOARD_DARK} {...line} />
			<path d="M86 36 V72 L50 88 V50 Z" fill={CARDBOARD} {...line} />
			<path d="M32 29 L68 43" {...line} stroke={CREAM} strokeWidth={5} />
		</>
	),
	catHouse: (
		<>
			<rect
				x="20"
				y="44"
				width="60"
				height="44"
				rx="4"
				fill={CREAM}
				{...line}
			/>
			<path d="M10 48 L50 16 L90 48 Z" fill={PINK} {...line} />
			<path
				d="M24 36 L26 14 L40 26 Z M76 36 L74 14 L60 26 Z"
				fill={PINK}
				{...line}
				strokeWidth={3}
			/>
			<path
				d="M40 88 V70 Q50 58 60 70 V88 Z"
				fill={CARDBOARD_DARK}
				{...line}
				strokeWidth={3}
			/>
		</>
	),
};

/**
 * One sticker. Small uses (`plain`) drop the Paw White border, which would
 * swamp a 12px drawing.
 */
export function Art({
	name,
	className,
	plain = false,
	label,
}: {
	name: ArtName;
	className?: string;
	plain?: boolean;
	label?: string;
}) {
	return (
		<svg
			viewBox="0 0 100 100"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn(
				"shrink-0 overflow-visible",
				!plain && "drop-shadow-sticker",
				className,
			)}
		>
			{!plain && (
				// The same drawing, fattened and flattened into a sticker border.
				<g className="[&_*]:!fill-[#fff4f8] [&_*]:!stroke-[#fff4f8] [&_*]:![stroke-width:14px]">
					{ART[name]}
				</g>
			)}
			{ART[name]}
		</svg>
	);
}

/** The fish currency, sized to sit in a line of text. */
export function FishIcon({ className }: { className?: string }) {
	return (
		<Art
			name="fish"
			plain
			label="fish"
			className={cn(
				"ml-[0.2em] inline-block h-[0.95em] w-[1.3em] align-[-0.12em]",
				className,
			)}
		/>
	);
}

/** Swaps every 🐟 in engine text for the drawn fish. */
export function withFish(text: string): ReactNode {
	const parts = text.split(/\s?🐟/);
	if (parts.length === 1) return text;
	return parts.flatMap((part, i) =>
		// biome-ignore lint/suspicious/noArrayIndexKey: stable split of one string
		i === 0 ? [part] : [<FishIcon key={i} />, part],
	);
}
