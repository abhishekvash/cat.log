import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { newRoomCode, roomPath } from "#/lib/multiplayer/protocol";

/** Opens a brand-new room for a game, with this device as its creator. */
export function useStartRoom(gameId: string) {
	const router = useRouter();
	return useCallback(
		(opts: { replace?: boolean } = {}) =>
			router.navigate({
				href: `${roomPath(gameId, newRoomCode())}?new=true`,
				replace: opts.replace,
			}),
		[router, gameId],
	);
}
