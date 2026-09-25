import { type CSSProperties, useEffect, useState } from "react";
import { CODE_COLORS, KEY_COLORS } from "#/lib/mastermind";
import { Pin } from "./pins";

const PIECES = 44;
const RUNNERS = 4;
const LIFETIME_MS = 3800;

const pick = <T,>(items: readonly T[]) =>
	items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);

function makePieces() {
	return Array.from({ length: PIECES }, (_, id) => {
		const angle = between(0, Math.PI * 2);
		const distance = between(22, 58);
		// Every sixth piece is a paw so the burst isn't only faces.
		const paw = id % 6 === 5;
		return {
			id,
			kind: paw ? ("key" as const) : ("code" as const),
			color: paw ? pick(KEY_COLORS) : pick(CODE_COLORS),
			size: `${between(paw ? 1.25 : 1.75, paw ? 2 : 3.25).toFixed(2)}rem`,
			style: {
				"--dx": `${(Math.cos(angle) * distance).toFixed(1)}vmin`,
				// Bias upward so it reads as an explosion, then gravity pulls it down.
				"--dy": `${(Math.sin(angle) * distance - 14).toFixed(1)}vmin`,
				"--spin": `${between(-540, 540).toFixed(0)}deg`,
				"--dur": `${between(1.9, 2.8).toFixed(2)}s`,
				"--delay": `${between(0, 0.15).toFixed(2)}s`,
			} as CSSProperties,
		};
	});
}

function makeRunners() {
	return Array.from({ length: RUNNERS }, (_, id) => ({
		id,
		color: CODE_COLORS[id % CODE_COLORS.length],
		style: {
			bottom: `${6 + id * 7}vh`,
			"--dur": `${between(2.2, 2.9).toFixed(2)}s`,
			"--delay": `${(0.25 + id * 0.18).toFixed(2)}s`,
		} as CSSProperties,
	}));
}

/**
 * Exploding kittens: a burst of cat faces (and a few paws) from the middle of the
 * screen, plus a little parade of kittens hopping across the bottom. Removes
 * itself when done. Purely decorative and hidden under reduced motion.
 */
export function KittenBurst({ onDone }: { onDone: () => void }) {
	const [pieces] = useState(makePieces);
	const [runners] = useState(makeRunners);

	useEffect(() => {
		const timer = setTimeout(onDone, LIFETIME_MS);
		return () => clearTimeout(timer);
	}, [onDone]);

	return (
		<div
			aria-hidden="true"
			className="kitten-burst pointer-events-none fixed inset-0 z-50 overflow-hidden"
		>
			{pieces.map((piece) => (
				<span
					key={piece.id}
					className="kitten-piece absolute top-1/2 left-1/2"
					style={piece.style}
				>
					<Pin color={piece.color} kind={piece.kind} size={piece.size} />
				</span>
			))}
			{runners.map((runner) => (
				<span
					key={runner.id}
					className="kitten-runner absolute left-0"
					style={runner.style}
				>
					<span className="kitten-hop block">
						<Pin color={runner.color} kind="code" size="2.5rem" />
					</span>
				</span>
			))}
		</div>
	);
}
