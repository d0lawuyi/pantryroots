import { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext, type AppApi, type Tab } from "@/lib/app-context";
import { usePersistentState } from "@/lib/storage";
import { rankDishes } from "@/lib/pantry";
import { Icon, type IconName } from "@/components/Icon";
import { Toast } from "@/components/ui";
import { CookScreen } from "@/screens/CookScreen";
import { PantryScreen } from "@/screens/PantryScreen";
import { ExploreScreen } from "@/screens/ExploreScreen";
import { BattlesScreen, type Ratings, type VoteCounts } from "@/screens/BattlesScreen";
import { NeighborsScreen } from "@/screens/NeighborsScreen";
import { DishSheet } from "@/screens/DishSheet";
import { SwapSheet } from "@/screens/SwapSheet";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "cook", label: "Cook", icon: "cook" },
  { id: "pantry", label: "Pantry", icon: "pantry" },
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "battles", label: "Battles", icon: "battles" },
  { id: "neighbors", label: "Neighbors", icon: "neighbors" },
];

const STARTER_PANTRY = ["Rice", "Tomato", "Tomato Paste", "Onion", "Scotch Bonnet", "Palm Oil", "Garlic", "Ginger", "Vegetable Oil", "Red Bell Pepper", "Bay Leaf"];

function tabFromHash(): Tab {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.some((t) => t.id === id) ? (id as Tab) : "cook";
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [pantry, setPantry] = usePersistentState<string[]>("pantry", STARTER_PANTRY);
  const [ratings, setRatings] = usePersistentState<Ratings>("ratings", {});
  const [votes, setVotes] = usePersistentState<VoteCounts>("votes", {});
  const [dishId, setDishId] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ ingredient?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const label = TABS.find((t) => t.id === tab)?.label;
    document.title = tab === "cook" ? "PantryRoots" : `${label} – PantryRoots`;
  }, [tab]);

  const go = useCallback((t: Tab) => {
    window.location.hash = `/${t}`;
    window.scrollTo({ top: 0 });
  }, []);

  const notify = useCallback((m: string) => setToast(m), []);
  const clearToast = useCallback(() => setToast(null), []);

  const api: AppApi = useMemo(
    () => ({
      pantry,
      addItems: (items) => {
        const owned = new Set(pantry.map((p) => p.toLowerCase()));
        const fresh = [...new Set(items.filter(Boolean))].filter((i) => !owned.has(i.toLowerCase()));
        if (fresh.length) setPantry([...pantry, ...fresh]);
        setToast(fresh.length === 1 ? `Added ${fresh[0]}` : fresh.length > 1 ? `Added ${fresh.length} items` : "Already in your pantry");
      },
      removeItem: (item) => setPantry((prev) => prev.filter((p) => p !== item)),
      openDish: (id) => { setSwap(null); setDishId(id); },
      openSwap: (ingredient) => { setDishId(null); setSwap({ ingredient }); },
      notify,
      go,
    }),
    [pantry, setPantry, notify, go],
  );

  const readyCount = useMemo(() => rankDishes(pantry).filter((m) => m.need.length === 0).length, [pantry]);

  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <aside className="sidebar" aria-label="Main">
          <div className="wordmark">
            <Logo />
            PantryRoots
          </div>
          <nav className="sidebar__nav">
            {TABS.map((t) => (
              <a key={t.id} href={`#/${t.id}`} className="sidebar__item" aria-current={tab === t.id ? "page" : undefined}>
                <Icon name={t.icon} size={20} />
                {t.label}
              </a>
            ))}
          </nav>
          <div className="sidebar__foot">
            <strong className="num">{readyCount}</strong>
            {readyCount === 1 ? "dish" : "dishes"} you can cook with your {pantry.length} pantry items
          </div>
        </aside>

        <main className="main" id="main">
          {tab === "cook" && <CookScreen ratings={ratings} />}
          {tab === "pantry" && <PantryScreen />}
          {tab === "explore" && <ExploreScreen />}
          {tab === "battles" && <BattlesScreen ratings={ratings} setRatings={setRatings} votes={votes} setVotes={setVotes} />}
          {tab === "neighbors" && <NeighborsScreen />}
        </main>

        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className="tabbar__item" aria-current={tab === t.id ? "page" : undefined}>
              <Icon name={t.icon} size={24} strokeWidth={tab === t.id ? 2 : 1.75} />
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      {dishId && <DishSheet id={dishId} onClose={() => setDishId(null)} />}
      {swap && <SwapSheet initial={swap.ingredient} onClose={() => setSwap(null)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </AppContext.Provider>
  );
}

/** A jar with roots: indigo body, gold contents line. */
function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="8" fill="var(--indigo)" />
      <path d="M9 9.5h10v9a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 9 18.5z" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M8 7h12" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M11 14.5h6" stroke="var(--gold)" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}
