import { createContext, useContext } from "react";
import type { Dish } from "@/data/dishes";

export type Tab = "cook" | "pantry" | "explore" | "battles" | "neighbors";

export type AppApi = {
  pantry: string[];
  addItems: (items: string[]) => void;
  removeItem: (item: string) => void;
  openDish: (id: string) => void;
  openSwap: (ingredient?: string) => void;
  /** Open the concierge, optionally sending a message straight away. */
  ask: (prompt?: string) => void;
  /** Make an AI-written dish openable in the dish sheet. */
  registerDish: (dish: Dish) => void;
  getDish: (id: string) => Dish | undefined;
  notify: (message: string) => void;
  go: (tab: Tab) => void;
};

export const AppContext = createContext<AppApi | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppContext.Provider>");
  return ctx;
}
