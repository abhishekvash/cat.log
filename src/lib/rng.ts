/** Randomness is injected so game rules stay pure and tests can replay games. */
export interface Rng {
	/** A whole number from 0 up to (not including) `max`. */
	int(max: number): number;
}

/** Unbiased crypto randomness, for the server. */
export const cryptoRng: Rng = {
	int(max) {
		const limit = Math.floor(0x1_0000_0000 / max) * max;
		const buf = new Uint32Array(1);
		do crypto.getRandomValues(buf);
		while (buf[0] >= limit);
		return buf[0] % max;
	},
};

/** mulberry32: small, fast and repeatable. For tests. */
export function seededRng(seed: number): Rng {
	let a = seed >>> 0;
	return {
		int(max) {
			a = (a + 0x6d2b79f5) >>> 0;
			let t = a;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			const r = ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
			return Math.floor(r * max);
		},
	};
}

export const rollDie = (rng: Rng) => rng.int(6) + 1;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = rng.int(i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
