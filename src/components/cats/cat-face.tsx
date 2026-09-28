import { type ReactNode, useId } from "react";
import type { Cat, PawColor } from "#/lib/cats";
import { cn } from "#/lib/utils";
import {
	BLUSH,
	COATS,
	CREAM,
	INK,
	INNER_EAR,
	NOSE,
	PAW_SHADES,
	SLEEPY_FUR,
	STICKER,
} from "./palette";

/** SVG ids from useId can contain characters that break `url(#id)` references. */
export const useSvgId = () => `svg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

/**
 * A 100×100 drawing as a square sticker of the given size, with the sticker
 * drop shadow. Every cat head, paw token and game pin is one of these.
 */
export function Sticker({
	size,
	className,
	children,
}: {
	size: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<span
			aria-hidden="true"
			style={{ width: size, height: size }}
			className={cn("block shrink-0", className)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				className="size-full overflow-visible drop-shadow-sticker"
			>
				{children}
			</svg>
		</span>
	);
}

interface Coat {
	fur: string;
	iris: string;
	leftEar?: string;
	rightEar?: string;
	/** Patches and stripes, clipped to the head shape. */
	markings?: ReactNode;
}

const stripes = (color: string, width: number, paths: string[]) => (
	<g stroke={color} strokeWidth={width} strokeLinecap="round">
		{paths.map((d) => (
			<path key={d} d={d} />
		))}
	</g>
);

const MARKINGS: Partial<Record<Cat, Omit<Coat, "fur" | "iris">>> = {
	grey: {
		markings: stripes(COATS.grey.accent, 3.5, [
			"M44 31 L46 40",
			"M50 30 L50 40",
			"M56 31 L54 40",
		]),
	},
	ginger: {
		markings: (
			<>
				<ellipse cx="50" cy="76" rx="19" ry="13" fill={CREAM} />
				{stripes(COATS.ginger.accent, 4, [
					"M43 30 L45 40",
					"M50 29 L50 41",
					"M57 30 L55 40",
					"M11 58 L20 60",
					"M89 58 L80 60",
				])}
			</>
		),
	},
	// Beige coat with near-black points on the ears and face mask.
	siamese: {
		leftEar: COATS.siamese.accent,
		rightEar: COATS.siamese.accent,
		markings: (
			<ellipse cx="50" cy="71" rx="26" ry="20" fill={COATS.siamese.accent} />
		),
	},
	calico: {
		leftEar: COATS.ginger.fur,
		rightEar: COATS.black.fur,
		markings: (
			<>
				<ellipse cx="28" cy="40" rx="18" ry="13" fill={COATS.ginger.fur} />
				<ellipse cx="74" cy="42" rx="15" ry="11" fill={COATS.black.fur} />
			</>
		),
	},
};

const coatOf = (cat: Cat): Coat => ({
	fur: COATS[cat].fur,
	iris: COATS[cat].iris,
	...MARKINGS[cat],
});

// Shapes in a 100x100 box: pointy ears above a wide, round cat head.
const LEFT_EAR = "M15 50 L19 11 Q20 6 25 8 L48 28 Z";
const RIGHT_EAR = "M85 50 L81 11 Q80 6 75 8 L52 28 Z";
const HEAD = { cx: 50, cy: 60, rx: 40, ry: 33 };

/** A cat's face, drawn into a 100×100 SVG box. */
export function CatFace({
	cat,
	asleep = false,
}: {
	cat: Cat;
	asleep?: boolean;
}) {
	return (
		<Face
			coat={asleep ? { fur: SLEEPY_FUR, iris: INK } : coatOf(cat)}
			asleep={asleep}
		/>
	);
}

function Face({ coat, asleep }: { coat: Coat; asleep: boolean }) {
	const clip = useSvgId();
	const line = {
		stroke: INK,
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
				<g stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none">
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
							stroke={INK}
							strokeWidth={2.5}
						/>
						<ellipse cx={cx} cy="60" rx="3.5" ry="6" fill={INK} />
						<circle cx={cx + 2.5} cy="56.5" r="2.5" fill={STICKER} />
					</g>
				))
			)}
			<ellipse cx="22" cy="72" rx="6" ry="3.5" fill={BLUSH} opacity={0.6} />
			<ellipse cx="78" cy="72" rx="6" ry="3.5" fill={BLUSH} opacity={0.6} />
			<path
				d="M46.5 70 L53.5 70 L50 74 Z"
				fill={NOSE}
				stroke={INK}
				strokeWidth={1.5}
				strokeLinejoin="round"
			/>
			<path
				d="M43 77 Q46.5 81 50 77 Q53.5 81 57 77"
				stroke={INK}
				strokeWidth={2.5}
				strokeLinecap="round"
				fill="none"
			/>
		</>
	);
}

/** A single cat head: player tokens, seat lists, decorations. */
export function CatHead({
	cat,
	size,
	className,
}: {
	cat: Cat;
	size: string;
	className?: string;
}) {
	return (
		<Sticker size={size} className={className}>
			<CatFace cat={cat} />
		</Sticker>
	);
}

/** A sleeping cat that won't tell: hidden codes, loading and empty states. */
export function SleepyCat({ size = "var(--pin)" }: { size?: string }) {
	return (
		<span
			role="img"
			aria-label="Hidden"
			style={{ width: size, height: size }}
			className="relative block"
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				className="size-full overflow-visible opacity-80"
			>
				<CatFace cat="grey" asleep />
			</svg>
			<span className="absolute -top-1 -right-1 text-xs font-bold text-primary">
				z
			</span>
		</span>
	);
}

/** A paw print in a 100×100 box. */
export function Paw({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
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

/** A glossy round token with a paw print, drawn into a 100×100 SVG box. */
export function PawToken({ color }: { color: PawColor }) {
	const id = useSvgId();
	const [light, base, shade] = PAW_SHADES[color];
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
