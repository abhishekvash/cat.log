import type { CSSProperties } from "react";

// Hand-placed so they feel scattered but still cover the page evenly. Each pair
// blinks on its own cycle length (and a couple double-blink), so the cycles drift
// apart and the eyes never blink in unison.
const PAIRS = [
	{ left: "7%", top: "16%", size: 3.4, tilt: -8, cycle: 7.3, delay: -1.2 },
	{
		left: "88%",
		top: "11%",
		size: 2.6,
		tilt: 6,
		cycle: 9.1,
		delay: -5.4,
		double: true,
	},
	{ left: "4%", top: "63%", size: 2.9, tilt: 4, cycle: 11.2, delay: -3.1 },
	{ left: "91%", top: "58%", size: 3.6, tilt: -5, cycle: 8.2, delay: -7.6 },
	{
		left: "22%",
		top: "90%",
		size: 2.4,
		tilt: 10,
		cycle: 12.7,
		delay: -9.8,
		double: true,
	},
];

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

/** Black cats lurking in the dark around the page, blinking now and then. */
export function CatEyes() {
	return (
		<div
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
			{PAIRS.map((pair) => (
				<svg
					key={`${pair.left}-${pair.top}`}
					aria-hidden="true"
					viewBox="0 0 60 24"
					className="cat-eyes absolute"
					style={
						{
							left: pair.left,
							top: pair.top,
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
			))}
		</div>
	);
}
