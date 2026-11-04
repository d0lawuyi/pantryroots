import { createContext, useContext } from "react";

export type Tab = "cook" | "pantry" | "explore" | "battles" | "neighbors";

export type AppApi = {
  pantry: string[];
  addItems: (items: string[]) => void;
  removeItem: (item: string) => void;
  openDish: (id: string) => void;
  openSwap: (ingredient?: string) => void;
  notify: (message: string) => void;
  go: (tab: Tab) => void;
};

export const AppContext = createContext<AppApi | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppContext.Provider>");
  return ctx;
}
