import { type CSSProperties, useEffect, useRef, useState } from "react";
import { LURKING_EYES } from "./palette";

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

/** Content owners mark their occupied surfaces with the non-styling class. */
function contentRects(regions: Iterable<Element>): DOMRect[] {
	const rects: DOMRect[] = [];
	for (const region of regions) {
		const rect = region.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) rects.push(rect);
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
			<ellipse cx={cx} cy="12" rx="1.8" ry="8" fill={LURKING_EYES.pupil} />
			<circle
				cx={cx + 3}
				cy="8.5"
				r="1.4"
				fill={LURKING_EYES.glint}
				opacity={0.9}
			/>
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
		let disposed = false;
		const observed = new Set<Element>();

		const place = () => {
			if (disposed) return;
			const regions = new Set(document.querySelectorAll(".cat-eyes-occupied"));
			for (const region of observed) {
				if (!regions.has(region)) {
					resizeObserver.unobserve(region);
					observed.delete(region);
				}
			}
			for (const region of regions) {
				if (!observed.has(region)) {
					resizeObserver.observe(region);
					observed.add(region);
				}
			}
			const content = contentRects(regions);
			const rem = parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			const next = PAIRS.map((pair) => {
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
			});
			setPlaced((previous) =>
				previous.every((spot, i) => spot === next[i]) ? previous : next,
			);
		};
		const schedule = () => {
			if (disposed || timer) return;
			timer = window.setTimeout(() => {
				timer = 0;
				place();
			}, 150);
		};
		const resizeObserver = new ResizeObserver(schedule);
		const onLayoutChange = (event: Event) => {
			if (event.target instanceof Node && !container.contains(event.target))
				schedule();
		};

		schedule();
		// Fonts can move regions even when their own dimensions stay the same.
		document.fonts.ready.then(schedule);
		document.fonts.addEventListener("loadingdone", schedule);
		// Re-check when the page changes, but not when only the eyes themselves do.
		const observer = new MutationObserver((records) => {
			if (records.some((r) => !container.contains(r.target))) schedule();
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "style", "hidden", "open", "data-state"],
		});
		window.addEventListener("resize", schedule);
		document.addEventListener("scroll", schedule, {
			capture: true,
			passive: true,
		});
		document.addEventListener("transitionend", onLayoutChange);
		return () => {
			disposed = true;
			clearTimeout(timer);
			observer.disconnect();
			resizeObserver.disconnect();
			document.fonts.removeEventListener("loadingdone", schedule);
			window.removeEventListener("resize", schedule);
			document.removeEventListener("scroll", schedule, true);
			document.removeEventListener("transitionend", onLayoutChange);
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
						<stop offset="0%" stopColor={LURKING_EYES.light} />
						<stop offset="55%" stopColor={LURKING_EYES.iris} />
						<stop offset="100%" stopColor={LURKING_EYES.shade} />
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
