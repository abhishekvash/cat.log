import { useEffect, useRef, useState } from "react";
import { CATS, type Cat, PAW_COLORS, type PawColor } from "#/lib/cats";
import { CatHead, PawToken, Sticker } from "./cat-face";

const PIECES = 44;
const GRAVITY = 700; // px/s²
const MAX_LIFE = 7; // seconds; pieces normally leave the screen well before this
const FADE = 0.8; // seconds of fade-out at the end of a piece's life

const pick = <T,>(items: readonly T[]) =>
	items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);

interface Piece {
	id: number;
	/** A cat face, or (every sixth piece) a paw. */
	look: { cat: Cat } | { paw: PawColor };
	size: string;
	// Physics state, in px and degrees relative to the burst origin.
	x: number;
	y: number;
	vx: number;
	vy: number;
	rot: number;
	spin: number;
	/** Air resistance. Higher drag means a slower, floatier fall. */
	drag: number;
	swayAmp: number;
	swayFreq: number;
	phase: number;
}

function makePieces(): Piece[] {
	return Array.from({ length: PIECES }, (_, id) => {
		// Mostly upward and outward, like a popped confetti cannon.
		const angle = between(-Math.PI * 0.95, -Math.PI * 0.05);
		const speed = between(900, 2600);
		// Every sixth piece is a paw so the burst isn't only faces.
		const paw = id % 6 === 5;
		return {
			id,
			look: paw ? { paw: pick(PAW_COLORS) } : { cat: pick(CATS) },
			size: `${between(paw ? 1.25 : 1.75, paw ? 2 : 3.25).toFixed(2)}rem`,
			x: 0,
			y: 0,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			rot: between(-30, 30),
			spin: between(-720, 720),
			drag: between(3.2, 4.6),
			swayAmp: between(18, 42),
			swayFreq: between(1.4, 2.6),
			phase: between(0, Math.PI * 2),
		};
	});
}

/**
 * Exploding kittens: cat faces (and a few paws) burst from the middle of the
 * screen, slow down against the air and then flutter down like confetti.
 * Positions are simulated per frame and written straight to the DOM, so React
 * only renders once. Removes itself when done; skipped under reduced motion.
 */
export function KittenBurst({ onDone }: { onDone: () => void }) {
	const [pieces] = useState(makePieces);
	const nodes = useRef<(HTMLSpanElement | null)[]>([]);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			onDone();
			return;
		}
		const originX = window.innerWidth / 2;
		const originY = window.innerHeight / 2;
		const floor = window.innerHeight + 80;
		let last = performance.now();
		let elapsed = 0;
		let frame = 0;

		const step = (now: number) => {
			// Clamp dt so a backgrounded tab doesn't teleport everything.
			const dt = Math.min((now - last) / 1000, 1 / 20);
			last = now;
			elapsed += dt;
			let alive = 0;

			pieces.forEach((p, i) => {
				const node = nodes.current[i];
				if (!node) return;
				// Gravity plus drag gives a quick burst that eases into a gentle
				// terminal-velocity fall instead of an ever-accelerating drop.
				p.vy += GRAVITY * dt;
				p.vx -= p.vx * p.drag * dt;
				p.vy -= p.vy * p.drag * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				// Spin settles into a lazy tumble as the piece slows down.
				p.spin -= p.spin * 1.2 * dt;
				p.rot += p.spin * dt;

				// Side-to-side flutter grows in once the burst has calmed down.
				const settle = Math.min(elapsed / 1.2, 1);
				const sway =
					Math.sin(elapsed * p.swayFreq + p.phase) * p.swayAmp * settle;
				const wobble = Math.sin(elapsed * p.swayFreq * 1.3 + p.phase) * 18;
				const opacity = Math.min(1, (MAX_LIFE - elapsed) / FADE);
				const onScreen = originY + p.y < floor && opacity > 0;
				if (onScreen) alive++;

				node.style.opacity = onScreen ? String(opacity) : "0";
				node.style.transform = `translate(${originX + p.x + sway}px, ${
					originY + p.y
				}px) translate(-50%, -50%) rotate(${p.rot + wobble * settle}deg)`;
			});

			if (alive > 0) frame = requestAnimationFrame(step);
			else onDone();
		};

		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [pieces, onDone]);

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
		>
			{pieces.map((piece, i) => (
				<span
					key={piece.id}
					ref={(node) => {
						nodes.current[i] = node;
					}}
					className="absolute top-0 left-0 opacity-0 will-change-transform"
				>
					{"cat" in piece.look ? (
						<CatHead cat={piece.look.cat} size={piece.size} />
					) : (
						<Sticker size={piece.size} className="rounded-full">
							<PawToken color={piece.look.paw} />
						</Sticker>
					)}
				</span>
			))}
		</div>
	);
}
