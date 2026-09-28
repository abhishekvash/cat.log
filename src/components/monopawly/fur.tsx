import type { ReactNode } from "react";
import { useSvgId } from "#/components/cats/cat-face";
import { COATS } from "#/components/cats/palette";
import type { Cat } from "#/lib/cats";
import { cn } from "#/lib/utils";

/**
 * Each cat's fur as a repeating swatch. A claimed street wears a strip of its
 * owner's fur, so you read ownership straight off the cat's coat. Colours come
 * from the shared coat palette, so they always match the cat heads.
 */

const stripes = ({ fur: base, accent: stripe }: (typeof COATS)[Cat]) => ({
	width: 10,
	height: 10,
	body: (
		<>
			<rect width="10" height="10" fill={base} />
			<path d="M2 -2 L6 12" stroke={stripe} strokeWidth={2.6} />
		</>
	),
});

const tufts = ({ fur: base, accent: tuft }: (typeof COATS)[Cat]) => ({
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
	Exclude<Cat, "siamese">,
	{ width: number; height: number; body: ReactNode }
> = {
	grey: stripes(COATS.grey),
	ginger: stripes(COATS.ginger),
	white: tufts(COATS.white),
	black: tufts(COATS.black),
	calico: {
		width: 34,
		height: 12,
		body: (
			<>
				<rect width="34" height="12" fill={COATS.calico.fur} />
				<ellipse cx="8" cy="6" rx="7" ry="5" fill={COATS.ginger.fur} />
				<ellipse cx="25" cy="5" rx="5.5" ry="4" fill={COATS.black.fur} />
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
	cat: Cat;
	vertical?: boolean;
	className?: string;
}) {
	const id = useSvgId();
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
						<stop offset="0%" stopColor={COATS.siamese.accent} />
						<stop offset="22%" stopColor={COATS.siamese.fur} />
						<stop offset="78%" stopColor={COATS.siamese.fur} />
						<stop offset="100%" stopColor={COATS.siamese.accent} />
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
	cat: Cat;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-block h-2.5 w-6 shrink-0 overflow-hidden rounded-full border border-sticker/80",
				className,
			)}
		>
			<Fur cat={cat} />
		</span>
	);
}
