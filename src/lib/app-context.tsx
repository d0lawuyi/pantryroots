import { createContext, useContext } from "react";
import type { Dish } from "@/data/dishes";
import type { Profile } from "@/lib/profile";
import type { ScanMode } from "@/lib/concierge-types";

export type Tab = "cook" | "pantry" | "explore" | "battles" | "neighbors";

export type AppApi = {
  pantry: string[];
  /** Food roots and preferences from onboarding. */
  profile: Profile;
  openShopping: () => void;
  /** Open the week plan sheet. */
  openPlan: () => void;
  addItems: (items: string[]) => void;
  removeItem: (item: string) => void;
  openDish: (id: string) => void;
  openSwap: (ingredient?: string) => void;
  /** Full-screen, step-by-step cooking view. */
  startCooking: (id: string) => void;
  /**
   * Open the concierge, optionally sending a message straight away.
   * `images`: one data URL or several (video-sweep frames); `mode` says what they are.
   */
  ask: (prompt?: string, images?: string | string[], mode?: ScanMode) => void;
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
