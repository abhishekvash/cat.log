import { type ReactNode, useId } from "react";
import type { CatToken } from "#/lib/monopawly/types";
import { cn } from "#/lib/utils";

/**
 * Each cat's fur as a repeating swatch. A claimed street wears a strip of its
 * owner's fur, so you read ownership straight off the cat's coat. Colours match
 * the coats in components/mastermind/pins.tsx.
 */

const stripes = (base: string, stripe: string) => ({
	width: 10,
	height: 10,
	body: (
		<>
			<rect width="10" height="10" fill={base} />
			<path d="M2 -2 L6 12" stroke={stripe} strokeWidth={2.6} />
		</>
	),
});

const tufts = (base: string, tuft: string) => ({
	width: 12,
	height: 10,
	body: (
		<>
			<rect width="12" height="10" fill={base} />
			<path
				d="M1 7 Q3 3 5 7 M7 4 Q9 0 11 4"
				fill="none"
				stroke={tuft}
				strokeWidth={1.3}
				strokeLinecap="round"
			/>
		</>
	),
});

const PATTERNS: Record<
	Exclude<CatToken, "siamese">,
	{ width: number; height: number; body: ReactNode }
> = {
	grey: stripes("#a7b0bb", "#7d8793"),
	ginger: stripes("#f4a259", "#d9772e"),
	white: tufts("#fbf8f4", "#e2d6cc"),
	black: tufts("#2d2a31", "#5a5463"),
	calico: {
		width: 34,
		height: 12,
		body: (
			<>
				<rect width="34" height="12" fill="#fbf8f4" />
				<ellipse cx="8" cy="6" rx="7" ry="5" fill="#f4a259" />
				<ellipse cx="25" cy="5" rx="5.5" ry="4" fill="#2d2a31" />
			</>
		),
	},
};

/** Fills its box with a cat's fur, running along the box's long side. */
export function Fur({
	cat,
	vertical = false,
	className,
}: {
	cat: CatToken;
	vertical?: boolean;
	className?: string;
}) {
	const id = `fur${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	return (
		<svg aria-hidden="true" className={cn("block size-full", className)}>
			<defs>
				{cat === "siamese" ? (
					// Beige body with dark seal points at both ends.
					<linearGradient
						id={id}
						x1="0"
						y1="0"
						x2={vertical ? "0" : "1"}
						y2={vertical ? "1" : "0"}
					>
						<stop offset="0%" stopColor="#2f2724" />
						<stop offset="22%" stopColor="#e9d3b1" />
						<stop offset="78%" stopColor="#e9d3b1" />
						<stop offset="100%" stopColor="#2f2724" />
					</linearGradient>
				) : (
					<pattern
						id={id}
						patternUnits="userSpaceOnUse"
						width={PATTERNS[cat].width}
						height={PATTERNS[cat].height}
						patternTransform={vertical ? "rotate(90)" : undefined}
					>
						{PATTERNS[cat].body}
					</pattern>
				)}
			</defs>
			<rect width="100%" height="100%" fill={`url(#${id})`} />
		</svg>
	);
}

/** A little rounded patch of fur, for showing whose coat is whose. */
export function FurSwatch({
	cat,
	className,
}: {
	cat: CatToken;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-block h-2.5 w-6 shrink-0 overflow-hidden rounded-full border border-[#fff4f8]/80",
				className,
			)}
		>
			<Fur cat={cat} />
		</span>
	);
}
