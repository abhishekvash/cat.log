import { DoorOpenIcon } from "@phosphor-icons/react/DoorOpen";
import { MoonIcon } from "@phosphor-icons/react/Moon";
import { Link } from "@tanstack/react-router";
import { GameBreadcrumb } from "#/components/catalog/game-breadcrumb";
import { ConfirmAction } from "#/components/confirm-action";
import { RejoinLinkAlert } from "#/components/multiplayer/rejoin-link-alert";
import { useRoom } from "#/components/multiplayer/room-context";
import { SeatList } from "#/components/multiplayer/seat-list";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { MEWDO } from "#/lib/catalog";
import { ordinal } from "#/lib/mewdo/board";
import type { GameState, HouseRules, Move, Player } from "#/lib/mewdo/types";
import { seatById } from "#/lib/multiplayer/room";
import { viewTurns } from "./geometry";
import { tintOf } from "./palette";
import { Results } from "./results";
import { MewdoTable, PlayerStatus } from "./table";

const useMewdoRoom = () => useRoom<GameState, Move, HouseRules>();

/** A Mewdo game in an online room: your corner at the bottom left. */
export function MewdoRoomTable() {
	const { room, seat, live, move, act, isHost, code } = useMewdoRoom();
	const state = room.game;
	if (!state) throw new Error("MewdoRoomTable needs a started game.");
	const me = state.players.find((p) => p.id === seat?.id);
	const racing = me && !me.gone && me.place === null;
	const current = state.players.find((p) => p.id === state.turn?.playerId);
	const playerOf = (id: number) => state.players.find((p) => p.id === id);

	return (
		<MewdoTable
			state={state}
			controls={me?.id ?? null}
			onMove={(_, m) => move(m)}
			live={live}
			view={viewTurns(me?.corner ?? 0)}
			header={
				<div className="cat-eyes-occupied flex items-center justify-between gap-2 text-sm">
					<GameBreadcrumb to={MEWDO.path}>{MEWDO.title}</GameBreadcrumb>
					<span className="flex items-center gap-1 text-muted-foreground">
						Room {code}
						{racing && state.phase === "playing" && (
							<ConfirmAction
								title="Leave this game?"
								description="Your kittens leave the board and you'll watch from the sidelines."
								action="Leave game"
								onConfirm={() => act({ type: "resign" })}
							>
								<Button variant="ghost" size="compact">
									<DoorOpenIcon />
									Leave
								</Button>
							</ConfirmAction>
						)}
					</span>
				</div>
			}
			players={(shownTurn) => (
				<SeatList
					current={shownTurn ?? null}
					badges={(s) => {
						const p = playerOf(s.id);
						return (
							p && (
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ background: tintOf(p.corner) }}
									title="Their corner"
								/>
							)
						);
					}}
					extra={(s) => {
						const p = playerOf(s.id);
						return p && <PlayerStatus player={p} />;
					}}
					outLabel={(s) => {
						const p = playerOf(s.id);
						if (p?.place)
							return state.phase === "playing"
								? `Home ${ordinal(p.place)}, watching`
								: `${ordinal(p.place)} place`;
						return p?.gone ? "Left the game" : "Out";
					}}
				/>
			)}
			extras={
				<>
					{current && isHost && <WanderedOff current={current} />}
					<RejoinLinkAlert />
				</>
			}
			results={
				<Results
					state={state}
					actions={
						<>
							{isHost ? (
								<Button
									size="compact-lg"
									onClick={() => act({ type: "playAgain" })}
								>
									Play again
								</Button>
							) : (
								<p className="w-full text-sm text-muted-foreground">
									The host can start another game.
								</p>
							)}
							<Button asChild size="compact-lg" variant="outline">
								<Link to="/">Back to cat.log</Link>
							</Button>
						</>
					}
				/>
			}
		/>
	);
}

/** For the host: the current player has wandered off, so skip or remove them. */
function WanderedOff({ current }: { current: Player }) {
	const { room, seat: me, act } = useMewdoRoom();
	const seat = seatById(room, current.id);
	if (current.id === me?.id || !seat?.away) return null;
	return (
		<Alert className="cat-eyes-occupied">
			<MoonIcon />
			<AlertTitle>
				{current.name} wandered off
				{seat.connected ? " mid-turn" : " (disconnected)"}
			</AlertTitle>
			<AlertDescription>
				<div className="flex flex-wrap gap-2 pt-1">
					<Button
						size="compact"
						onClick={() => act({ type: "hostSkip", seat: current.id })}
					>
						Skip their turn
					</Button>
					<ConfirmAction
						title={`Remove ${current.name}?`}
						description="Their kittens leave the board and they're out of the game."
						action="Remove"
						onConfirm={() => act({ type: "hostRemove", seat: current.id })}
					>
						<Button size="compact" variant="outline">
							Remove them
						</Button>
					</ConfirmAction>
				</div>
			</AlertDescription>
		</Alert>
	);
}
