import { type CSSProperties, useEffect, useRef, useState } from "react";

type Spot = readonly [left: number, top: number]; // viewport percentages

interface Pair {
	/** Candidate spots in the pair's corner of the room, tried in order. */
	spots: Spot[];
	size: number; // rem
	tilt: number;
	cycle: number;
	delay: number;
	double?: boolean;
}

// Each pair lives in its own region so the eyes stay scattered but still cover
// the page evenly. Each blinks on its own cycle length (and a couple
// double-blink), so the cycles drift apart and they never blink in unison.
const PAIRS: Pair[] = [
	{
		spots: [
			[7, 16],
			[4, 30],
			[12, 7],
			[3, 44],
		],
		size: 3.4,
		tilt: -8,
		cycle: 7.3,
		delay: -1.2,
	},
	{
		spots: [
			[88, 11],
			[95, 24],
			[80, 6],
			[96, 38],
		],
		size: 2.6,
		tilt: 6,
		cycle: 9.1,
		delay: -5.4,
		double: true,
	},
	{
		spots: [
			[4, 63],
			[3, 78],
			[5, 52],
			[10, 88],
		],
		size: 2.9,
		tilt: 4,
		cycle: 11.2,
		delay: -3.1,
	},
	{
		spots: [
			[91, 58],
			[95, 72],
			[96, 48],
			[88, 84],
		],
		size: 3.6,
		tilt: -5,
		cycle: 8.2,
		delay: -7.6,
	},
	{
		spots: [
			[22, 90],
			[40, 95],
			[62, 94],
			[78, 96],
		],
		size: 2.4,
		tilt: 10,
		cycle: 12.7,
		delay: -9.8,
		double: true,
	},
];

// Breathing room kept between eyes and anything on the page, in px.
const CLEARANCE = 20;

/** Rects of everything a player reads or touches: text, controls, pieces, cards. */
function contentRects(root: HTMLElement): DOMRect[] {
	const rects: DOMRect[] = [];
	for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
		if (root.contains(el) || el.closest("[aria-hidden='true']")) continue;
		const style = getComputedStyle(el);
		const hasText = [...el.childNodes].some(
			(n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
		);
		const isThing =
			hasText ||
			el.matches("button, a, input, svg, [role='img']") ||
			style.borderTopWidth !== "0px" ||
			(style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
				el !== document.body &&
				el.tagName !== "HTML");
		if (!isThing) continue;
		const r = el.getBoundingClientRect();
		// Skip page-sized wrappers; they'd block every spot.
		if (r.width === 0 || r.width * r.height > innerWidth * innerHeight * 0.5)
			continue;
		rects.push(r);
	}
	return rects;
}

function overlaps(a: DOMRect, b: DOMRect) {
	return (
		a.left - CLEARANCE < b.right &&
		a.right + CLEARANCE > b.left &&
		a.top - CLEARANCE < b.bottom &&
		a.bottom + CLEARANCE > b.top
	);
}

function Eye({ cx }: { cx: number }) {
	return (
		<g>
			<path
				d={`M${cx - 11} 12 Q${cx} 1 ${cx + 11} 12 Q${cx} 23 ${cx - 11} 12 Z`}
				fill="url(#cat-eye-iris)"
			/>
			<ellipse cx={cx} cy="12" rx="1.8" ry="8" fill="#0d0a10" />
			<circle cx={cx + 3} cy="8.5" r="1.4" fill="#f4ffe6" opacity={0.9} />
		</g>
	);
}

/**
 * Black cats lurking in the dark around the page, blinking now and then. They
 * only ever sit in empty space: each pair takes the first of its spots that
 * doesn't overlap content, or stays hidden, re-checked as the page changes.
 */
export function CatEyes() {
	const root = useRef<HTMLDivElement>(null);
	// Index into each pair's spots, or null while hidden (and before first check).
	const [placed, setPlaced] = useState<(number | null)[]>(() =>
		PAIRS.map(() => null),
	);

	useEffect(() => {
		const container = root.current;
		if (!container) return;
		let timer = 0;

		const place = () => {
			const content = contentRects(container);
			const rem = parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			setPlaced(
				PAIRS.map((pair) => {
					const width = pair.size * rem;
					const height = width * 0.4;
					const free = pair.spots.findIndex(([x, y]) => {
						const cx = (x / 100) * innerWidth;
						const cy = (y / 100) * innerHeight;
						const box = new DOMRect(
							cx - width / 2,
							cy - height / 2,
							width,
							height,
						);
						return !content.some((r) => overlaps(box, r));
					});
					return free === -1 ? null : free;
				}),
			);
		};
		const schedule = () => {
			clearTimeout(timer);
			timer = window.setTimeout(place, 150);
		};

		// Fonts change text widths, so place once they're in.
		document.fonts.ready.then(place);
		// Re-check when the page changes, but not when only the eyes themselves do.
		const observer = new MutationObserver((records) => {
			if (records.some((r) => !container.contains(r.target))) schedule();
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		window.addEventListener("resize", schedule);
		return () => {
			clearTimeout(timer);
			observer.disconnect();
			window.removeEventListener("resize", schedule);
		};
	}, []);

	return (
		<div
			ref={root}
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
		>
			<svg className="absolute size-0" aria-hidden="true">
				<defs>
					<radialGradient id="cat-eye-iris" cx="50%" cy="50%" r="60%">
						<stop offset="0%" stopColor="#e9ff8a" />
						<stop offset="55%" stopColor="#8fdc4f" />
						<stop offset="100%" stopColor="#3f8f2a" />
					</radialGradient>
				</defs>
			</svg>
			{PAIRS.map((pair, i) => {
				const spot = placed[i];
				const [left, top] = pair.spots[spot ?? 0];
				return (
					<svg
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed set of pairs
						key={i}
						aria-hidden="true"
						viewBox="0 0 60 24"
						className={`cat-eyes absolute transition-opacity duration-700 ${
							spot === null ? "!opacity-0" : ""
						}`}
						style={
							{
								left: `${left}%`,
								top: `${top}%`,
								width: `${pair.size}rem`,
								transform: `translate(-50%, -50%) rotate(${pair.tilt}deg)`,
								"--cycle": `${pair.cycle}s`,
								"--delay": `${pair.delay}s`,
							} as CSSProperties
						}
					>
						<g className={pair.double ? "cat-blink-double" : "cat-blink"}>
							<Eye cx={15} />
							<Eye cx={45} />
						</g>
					</svg>
				);
			})}
		</div>
	);
}
