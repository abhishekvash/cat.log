import { cn } from "#/lib/utils";
import { INNER_EAR } from "./palette";

function Ear({ side }: { side: "left" | "right" }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 52 46"
			className={cn(
				"absolute -top-[2.35rem] h-[2.75rem] w-[3.1rem] overflow-visible",
				side === "left"
					? "left-[1.6rem] -rotate-12 origin-bottom-right cat-ear-twitch"
					: "right-[1.6rem] rotate-12 -scale-x-100",
			)}
		>
			{/* The base dips below the card's top edge so the ear grows out of it. */}
			<path
				d="M0 46 L0 42 L19 5 Q23 -1 28 5 L52 42 L52 46 Z"
				className="fill-card"
			/>
			<path
				d="M0 42 L19 5 Q23 -1 28 5 L52 42"
				className="fill-none stroke-border"
				strokeWidth={2}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<path
				d="M12 40 L22 16 Q24 12 27 16 L40 40 Z"
				fill={INNER_EAR}
				opacity={0.75}
			/>
		</svg>
	);
}

/** A pair of cat ears perched on top of a card. The parent must be `relative`. */
export function CatEars() {
	return (
		<>
			<Ear side="left" />
			<Ear side="right" />
		</>
	);
}
