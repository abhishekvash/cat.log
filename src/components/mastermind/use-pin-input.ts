import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { type Dispatch, useEffect, useState } from "react";
import {
	type Action,
	activeCodeTarget,
	type GameState,
} from "#/lib/mastermind";
import type { DragData, DropData, Selection } from "./pins";

/**
 * How pins get onto the board: drag from a tray or between holes, drag off to
 * remove, or tap a tray pin and then tap holes. Turns all of that into moves.
 */
export function usePinInput(state: GameState, dispatch: Dispatch<Action>) {
	const [selection, setSelection] = useState<Selection | null>(null);
	const [dragging, setDragging] = useState<DragData | null>(null);
	const target = activeCodeTarget(state);

	// A selected pin from the previous turn shouldn't leak into the next one.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on phase change only
	useEffect(() => setSelection(null), [state.phase]);

	function onDragEnd({ active, over }: DragEndEvent) {
		setDragging(null);
		const src = active.data.current as DragData;
		const drop = over?.data.current as DropData | undefined;
		const dst = drop?.enabled ? drop : undefined;
		const from = src.from;

		if (dst && dst.kind === src.kind) {
			if (from === dst.index) return;
			if (src.kind === "code" && target) {
				dispatch(
					from === undefined
						? { type: "placeCode", target, index: dst.index, color: src.color }
						: { type: "moveCode", target, from, to: dst.index },
				);
			} else if (src.kind === "key") {
				dispatch(
					from === undefined
						? { type: "setKey", index: dst.index, color: src.color }
						: { type: "moveKey", from, to: dst.index },
				);
			}
			return;
		}
		// A placed pin dropped anywhere else is taken off the board.
		if (from === undefined) return;
		if (src.kind === "code" && target)
			dispatch({ type: "clearCode", target, index: from });
		if (src.kind === "key")
			dispatch({ type: "setKey", index: from, color: null });
	}

	function tapCode(index: number, current: string | null) {
		if (!target) return;
		if (selection?.kind === "code" && selection.color !== current) {
			dispatch({ type: "placeCode", target, index, color: selection.color });
		} else if (current) {
			dispatch({ type: "clearCode", target, index });
		}
	}

	function tapKey(index: number, current: string | null) {
		if (selection?.kind !== "key") return dispatch({ type: "cycleKey", index });
		dispatch({
			type: "setKey",
			index,
			color: selection.color === current ? null : selection.color,
		});
	}

	const toggle = (next: Selection) =>
		setSelection((prev) =>
			prev?.kind === next.kind && prev.color === next.color ? null : next,
		);

	return {
		/** The tray pin picked for tapping, if any. */
		selection,
		toggle,
		/** What's being dragged, for the drag overlay. */
		dragging,
		dnd: {
			onDragStart: ({ active }: DragStartEvent) =>
				setDragging(active.data.current as DragData),
			onDragCancel: () => setDragging(null),
			onDragEnd,
		},
		tapCode,
		tapKey,
	};
}
