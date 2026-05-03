/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { DocumentMeta } from "./api";

/**
 * Shared multi-category selection state.
 *
 * Hoisted above per-category screens so that when a user selects a few
 * documents from the "Monthly Return" tab and switches to "IFA Report",
 * their existing picks are PRESERVED rather than wiped. A floating
 * action bar (rendered by the parent screen) can then show a single
 * "Share N selected" button spanning categories and invoke the native
 * multi-file share — matching the exact behaviour requested:
 *
 *   "akta category er file select korle porer cate te gele jeno ager
 *    ta un-select na hoye jay ... share korle without zip file actual
 *    file alada alada kore share hobe"
 *
 * We store the full DocumentMeta (not just ids) because the parent
 * "Share" button needs the original filenames for the OS share sheet,
 * and the selected documents live in different child screens that may
 * unmount while the user navigates.
 */
export type SelectionMode = "idle" | "selecting";

export interface SelectionValue {
  /** Map from doc.id → full DocumentMeta of picked documents. */
  picks: Map<string, DocumentMeta>;
  /** When true, tapping a card toggles selection instead of opening it. */
  mode: SelectionMode;

  isSelected: (id: string) => boolean;
  toggle: (doc: DocumentMeta) => void;
  select: (doc: DocumentMeta) => void;
  unselect: (id: string) => void;
  clear: () => void;

  enterSelecting: () => void;
  exitSelecting: () => void;

  /** Total documents selected across all categories. */
  count: number;
  /** List of selected DocumentMeta objects (stable ordering by pick time). */
  list: DocumentMeta[];
}

const SelectionCtx = createContext<SelectionValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [picks, setPicks] = useState<Map<string, DocumentMeta>>(new Map());
  const [mode, setMode] = useState<SelectionMode>("idle");

  const isSelected = useCallback((id: string) => picks.has(id), [picks]);

  const toggle = useCallback((doc: DocumentMeta) => {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.has(doc.id)) next.delete(doc.id);
      else next.set(doc.id, doc);
      return next;
    });
  }, []);

  const select = useCallback((doc: DocumentMeta) => {
    setPicks((prev) => {
      if (prev.has(doc.id)) return prev;
      const next = new Map(prev);
      next.set(doc.id, doc);
      return next;
    });
  }, []);

  const unselect = useCallback((id: string) => {
    setPicks((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setPicks(new Map()), []);

  const enterSelecting = useCallback(() => setMode("selecting"), []);

  const exitSelecting = useCallback(() => {
    setMode("idle");
    setPicks(new Map());
  }, []);

  const value = useMemo<SelectionValue>(
    () => ({
      picks,
      mode,
      isSelected,
      toggle,
      select,
      unselect,
      clear,
      enterSelecting,
      exitSelecting,
      count: picks.size,
      list: Array.from(picks.values()),
    }),
    [picks, mode, isSelected, toggle, select, unselect, clear, enterSelecting, exitSelecting],
  );

  return <SelectionCtx.Provider value={value}>{children}</SelectionCtx.Provider>;
}

/** Safe-to-use-without-provider version — returns a no-op stub so screens
 *  that are not wrapped (e.g. admin side) don't crash. */
const NOOP: SelectionValue = {
  picks: new Map(),
  mode: "idle",
  isSelected: () => false,
  toggle: () => {},
  select: () => {},
  unselect: () => {},
  clear: () => {},
  enterSelecting: () => {},
  exitSelecting: () => {},
  count: 0,
  list: [],
};

export function useSelection(): SelectionValue {
  return useContext(SelectionCtx) ?? NOOP;
}
