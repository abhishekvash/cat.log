import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WakingKitties } from "#/components/catalog/waking-kitties";
import { SleepyCat } from "#/components/mastermind/pins";
import { Board } from "#/components/monopawly/board";
import { Center } from "#/components/monopawly/center";
import { Lobby } from "#/components/monopawly/lobby";
import { SidePanel } from "#/components/monopawly/side-panel";
import { withFish } from "#/components/monopawly/tile-art";
import type { TradeDraft } from "#/components/monopawly/trade-panel";
import { usePartyGame } from "#/components/monopawly/use-game";
import { Button } from "#/components/ui/button";
import { GAME_NAME } from "#/lib/monopawly/board";
import { CODE_PATTERN, newRoomCode } from "#/lib/monopawly/protocol";
import { seo } from "#/lib/seo";

interface Search {
	new?: boolean;
	rejoin?: string;
}

export const Route = createFileRoute("/monopawly/$code")({
	validateSearch: (search: Record<string, unknown>): Search => ({
		new: search.new === true || search.new === "true" ? true : undefined,
		rejoin: typeof search.rejoin === "string" ? search.rejoin : undefined,
	}),
	beforeLoad: ({ params }) => {
		if (!CODE_PATTERN.test(params.code)) throw notFound();
	},
	head: ({ params }) =>
		seo({
			title: `Room ${params.code} · ${GAME_NAME} · cat.log`,
			description: `Join a game of ${GAME_NAME} on cat.log.`,
			path: `/monopawly/${params.code}`,
			noindex: true,
		}),
	// Rooms are live sockets, so the room itself only renders in the browser.
	// "data-only" still runs beforeLoad on the server, so a bad code renders
	// the same not-found page on both sides instead of a hydration mismatch.
	ssr: "data-only",
	component: Room,
});

function Room() {
	const { code } = Route.useParams();
	// A fresh view per room, so nothing carries over when the code changes.
	return <RoomView key={code} code={code} />;
}

function RoomView({ code }: { code: string }) {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const game = usePartyGame(code, {
		create: !!search.new,
		rejoin: search.rejoin,
		onTaken: () =>
			navigate({
				to: "/monopawly/$code",
				params: { code: newRoomCode() },
				search: { new: true },
				replace: true,
			}),
	});
	const [selected, setSelected] = useState<number | null>(null);
	useGameToasts(game);
	const [draft, setDraft] = useState<TradeDraft | null>(null);

	// Once in, drop the one-shot flags so a refresh just reconnects.
	useEffect(() => {
		if (game.me !== null && (search.new || search.rejoin))
			navigate({ to: ".", search: {}, replace: true });
	}, [game.me, search.new, search.rejoin, navigate]);

	if (game.status === "gone") return <Gone />;
	const state = game.state;
	if (!state) return <WakingKitties />;
	if (state.phase === "lobby")
		return <Lobby game={game} state={state} code={code} />;

	return (
		<main className="flex h-dvh flex-col gap-3 overflow-hidden p-2 landscape:flex-row sm:p-3">
			{/* The board is always the biggest thing on screen: a square as large as fits. */}
			<div className="aspect-square shrink-0 self-center m-5 [width:min(calc(100dvh-3.5rem),calc(100vw-21.5rem))] portrait:[width:min(calc(100vw-3.5rem),calc(100dvh-16rem))]">
				<Board
					state={state}
					selected={selected}
					onSelect={(i) => setSelected((s) => (s === i ? null : i))}
				>
					<Center
						game={game}
						state={state}
						selected={selected}
						onCloseSpace={() => setSelected(null)}
						draft={draft}
						onDraftChange={setDraft}
						onCloseDraft={() => setDraft(null)}
					/>
				</Board>
			</div>
			<SidePanel
				game={game}
				state={state}
				code={code}
				onSelectSpace={(i) => {
					setDraft(null);
					setSelected(i);
				}}
				onCompose={(d) => {
					setSelected(null);
					setDraft(d);
				}}
			/>
		</main>
	);
}

/** Moves the server turned down, and connection trouble, as Sonner toasts. */
function useGameToasts(game: ReturnType<typeof usePartyGame>) {
	useEffect(() => {
		if (game.notice) toast(withFish(game.notice.text), { id: game.notice.id });
	}, [game.notice]);
	useEffect(() => {
		if (game.status === "reconnecting")
			toast.loading("Reconnecting…", { id: "reconnect" });
		else toast.dismiss("reconnect");
	}, [game.status]);
}

function Gone() {
	const navigate = useNavigate();
	return (
		<main
			className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center"
			style={{ "--pin": "4rem" } as React.CSSProperties}
		>
			<SleepyCat />
			<div className="space-y-1.5">
				<h1 className="font-display text-xl font-semibold">
					This game has ended 💤
				</h1>
				<p className="text-muted-foreground">
					Rooms tidy themselves away once a game is over or everyone has left.
				</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				<Button
					size="compact-lg"
					onClick={() =>
						navigate({
							to: "/monopawly/$code",
							params: { code: newRoomCode() },
							search: { new: true },
						})
					}
				>
					Start a new room
				</Button>
				<Button asChild size="compact-lg" variant="outline">
					<Link to="/">Back to cat.log</Link>
				</Button>
			</div>
		</main>
	);
}
