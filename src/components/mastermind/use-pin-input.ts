import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { type Dispatch, useEffect, useState } from "react";
import {
	type Action,
	activeCodeTarget,
	type CodeTarget,
	type GameState,
} from "#/lib/mastermind";
import type { DragData, DropData, Selection } from "./pins";

/** A pin dropped into a hole of its own kind: placed fresh, or moved. */
function onto(
	src: DragData,
	index: number,
	target: CodeTarget | null,
): Action | null {
	if (src.kind === "key")
		return src.from === undefined
			? { type: "setKey", index, color: src.color }
			: { type: "moveKey", from: src.from, to: index };
	if (!target) return null;
	return src.from === undefined
		? { type: "placeCode", target, index, color: src.color }
		: { type: "moveCode", target, from: src.from, to: index };
}

/** A placed pin dropped anywhere else is taken off the board. */
function off(src: DragData, target: CodeTarget | null): Action | null {
	if (src.from === undefined) return null;
	if (src.kind === "key")
		return { type: "setKey", index: src.from, color: null };
	return target ? { type: "clearCode", target, index: src.from } : null;
}

/** The move a finished drag makes, if any. */
export function dropAction(
	src: DragData,
	drop: DropData | undefined,
	target: CodeTarget | null,
): Action | null {
	if (!drop?.enabled || drop.kind !== src.kind) return off(src, target);
	if (src.from === drop.index) return null;
	return onto(src, drop.index, target);
}

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
		const action = dropAction(
			active.data.current as DragData,
			over?.data.current as DropData | undefined,
			target,
		);
		if (action) dispatch(action);
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
