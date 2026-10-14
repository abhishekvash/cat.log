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

/**
 * Short strands of differing length, each with a slight curl and its own
 * lean, so a coat reads as fur rather than scales or rain. [x, y, length,
 * angle in degrees, curl, opacity], in a 24×18 tile.
 */
const STRANDS: [number, number, number, number, number, number][] = [
	[1.5, 6, 4, -75, 1.2, 0.85],
	[4, 15, 6.5, -58, -1.5, 0.65],
	[7.5, 8, 2.5, -95, 0.8, 0.5],
	[9, 17, 3.5, -70, 1, 0.8],
	[11.5, 11, 5.5, -62, 1.4, 0.9],
	[13, 4.5, 3, -82, -1, 0.6],
	[16, 16.5, 7, -66, -1.8, 0.75],
	[17.5, 7, 4.5, -54, 1.2, 0.55],
	[20.5, 12, 3, -88, 0.9, 0.8],
	[22.5, 5, 5, -68, -1.2, 0.7],
	[5.5, 2.5, 2, -72, 0.6, 0.45],
];

const strands = (base: string, strand: string) => ({
	width: 24,
	height: 18,
	body: (
		<>
			<rect width="24" height="18" fill={base} />
			{STRANDS.map(([x, y, length, angle, curl, opacity]) => {
				const rad = (angle * Math.PI) / 180;
				const dx = length * Math.cos(rad);
				const dy = length * Math.sin(rad);
				// Bend the middle sideways by `curl` for a little wave.
				const cx = x + dx / 2 - Math.sin(rad) * curl;
				const cy = y + dy / 2 + Math.cos(rad) * curl;
				return (
					<path
						key={`${x}-${y}`}
						d={`M${x} ${y} Q${cx} ${cy} ${x + dx} ${y + dy}`}
						fill="none"
						stroke={strand}
						strokeOpacity={opacity}
						strokeWidth={0.9}
						strokeLinecap="round"
					/>
				);
			})}
		</>
	),
});

const PATTERNS: Record<
	Exclude<Cat, "siamese">,
	{ width: number; height: number; body: ReactNode }
> = {
	grey: stripes(COATS.grey),
	ginger: stripes(COATS.ginger),
	white: strands(COATS.white.fur, COATS.white.accent),
	// Grey strands on black, like light catching the coat.
	black: strands(COATS.black.fur, COATS.grey.accent),
	// Uneven patches of ginger and black, big and small, on white.
	calico: {
		width: 48,
		height: 24,
		body: (
			<>
				<rect width="48" height="24" fill={COATS.calico.fur} />
				<path
					d="M3 5 C8 0 16 1 19 6 C22 11 17 16 11 15 C6 14 4 17 2 13 C0 10 0 8 3 5Z"
					fill={COATS.ginger.fur}
				/>
				<path
					d="M27 11 C30 7 36 6 40 9 C43 12 41 15 38 17 C35 20 29 21 27 18 C25 16 25 13 27 11Z"
					fill={COATS.black.fur}
				/>
				<path
					d="M38 1 C41 0 45 1 46 3 C47 5 44 6 42 6 C40 7 37 5 38 1Z"
					fill={COATS.black.fur}
				/>
				<path
					d="M13 19 C16 17 21 18 22 20 C23 22 19 23 16 23 C13 23 11 21 13 19Z"
					fill={COATS.ginger.fur}
				/>
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
