import { createContext, type ReactNode, useContext, useState } from "react";

/**
 * When each roll was first seen here, so the dice and the walking cats agree
 * on how long ago it happened. Rolls from before the table mounted count as
 * long ago, so arriving mid-game or reconnecting doesn't replay them.
 */
type RollAge = (rollId: number | undefined) => number;

const RollClock = createContext<RollAge>(() => Infinity);

export function RollClockProvider({
	loadedRoll,
	children,
}: {
	/** The latest roll when the table mounted; it shows still. */
	loadedRoll: number | undefined;
	children: ReactNode;
}) {
	const [age] = useState<RollAge>(() => {
		const seenAt = new Map<number, number>();
		return (rollId: number | undefined) => {
			if (rollId === undefined || rollId === loadedRoll) return Infinity;
			if (!seenAt.has(rollId)) seenAt.set(rollId, performance.now());
			return performance.now() - (seenAt.get(rollId) ?? 0);
		};
	});
	return <RollClock.Provider value={age}>{children}</RollClock.Provider>;
}

/** Milliseconds since a roll first showed up here (Infinity if it's old). */
export const useRollAge = () => useContext(RollClock);
