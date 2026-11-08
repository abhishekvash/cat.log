import { createContext, type ReactNode, use, useMemo, useState } from "react";
import type { TradeDraft } from "./trade-panel";

interface TradeDraftActions {
	compose: (draft: TradeDraft) => void;
	close: () => void;
}

const DraftContext = createContext<TradeDraft | null>(null);
const ActionsContext = createContext<TradeDraftActions | null>(null);

/** Keeps draft edits local to the composer while siblings can open a trade. */
export function TradeDraftProvider({ children }: { children: ReactNode }) {
	const [draft, setDraft] = useState<TradeDraft | null>(null);
	const actions = useMemo(
		() => ({ compose: setDraft, close: () => setDraft(null) }),
		[],
	);
	return (
		<ActionsContext value={actions}>
			<DraftContext value={draft}>{children}</DraftContext>
		</ActionsContext>
	);
}

export const useTradeDraft = () => use(DraftContext);

export function useTradeDraftActions(): TradeDraftActions {
	const actions = use(ActionsContext);
	if (!actions) throw new Error("Trade actions need a <TradeDraftProvider>.");
	return actions;
}
