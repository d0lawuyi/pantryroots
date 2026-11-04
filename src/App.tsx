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
import { Concierge } from "@/components/Concierge";
import { CookMode } from "@/components/CookMode";
import { Onboarding } from "@/components/Onboarding";
import { ShoppingSheet, ShoppingListButton } from "@/components/ShoppingSheet";
import { useProfile } from "@/lib/profile";
import { WeekPlanSheet, CalendarIcon } from "@/components/WeekPlanSheet";
import { dishById, type Dish } from "@/data/dishes";
import type { PendingAsk } from "@/lib/concierge-types";
import { SAMPLE_PANTRY, matchesSamplePantry } from "@/data/sample-pantry";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "cook", label: "Cook", icon: "cook" },
  { id: "pantry", label: "Pantry", icon: "pantry" },
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "battles", label: "Battles", icon: "battles" },
  { id: "neighbors", label: "Neighbors", icon: "neighbors" },
];

function tabFromHash(): Tab {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.some((t) => t.id === id) ? (id as Tab) : "cook";
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [pantry, setPantry] = usePersistentState<string[]>("pantry", []);
  const [profile, setProfile] = useProfile();
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [ratings, setRatings] = usePersistentState<Ratings>("ratings", {});
  const [votes, setVotes] = usePersistentState<VoteCounts>("votes", {});
  const [dishId, setDishId] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ ingredient?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [cookingId, setCookingId] = useState<string | null>(null);
  const [pendingAsk, setPendingAsk] = useState<PendingAsk | null>(null);
  const [aiDishes, setAiDishes] = useState<Record<string, Dish>>({});

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
      usingSamplePantry: matchesSamplePantry(pantry),
      startOwnPantry: () => { setPantry([]); notify("Started an empty pantry. You can try the sample again anytime."); },
      trySamplePantry: () => {
        if (pantry.length) return;
        setPantry([...SAMPLE_PANTRY]);
        notify("Loaded sample ingredients. Check them against your kitchen.");
      },
      addItems: (items) => {
        const owned = new Set(pantry.map((p) => p.toLowerCase()));
        const fresh = [...new Set(items.filter(Boolean))].filter((i) => !owned.has(i.toLowerCase()));
        if (fresh.length) setPantry([...pantry, ...fresh]);
        setToast(fresh.length === 1 ? `Added ${fresh[0]}` : fresh.length > 1 ? `Added ${fresh.length} items` : "Already in your pantry");
      },
      removeItem: (item) => setPantry((prev) => prev.filter((p) => p !== item)),
      openDish: (id) => { setSwap(null); setDishId(id); },
      openSwap: (ingredient) => { setDishId(null); setSwap({ ingredient }); },
      startCooking: (id) => { setDishId(null); setSwap(null); setCookingId(id); },
      ask: (prompt, images, mode) => {
        setDishId(null);
        setSwap(null);
        setConciergeOpen(true);
        const list = images === undefined ? undefined : Array.isArray(images) ? images : [images];
        if (prompt || list?.length) setPendingAsk({ text: prompt ?? "", images: list?.length ? list : undefined, mode, nonce: Date.now() });
      },
      registerDish: (dish) => setAiDishes((m) => (m[dish.id] ? m : { ...m, [dish.id]: dish })),
      getDish: (id) => dishById[id] ?? aiDishes[id],
      profile,
      openShopping: () => { setDishId(null); setSwap(null); setShoppingOpen(true); },
      openPlan: () => { setDishId(null); setSwap(null); setPlanOpen(true); },
      notify,
      go,
    }),
    [pantry, setPantry, notify, go, aiDishes, profile],
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
          <button type="button" className="sidebar__item" onClick={() => setPlanOpen(true)}>
            <CalendarIcon />
            Week plan
          </button>
          <ShoppingListButton variant="sidebar" onClick={() => setShoppingOpen(true)} />
          <a className="sidebar__item" href="/welcome/">
            About PantryRoots
          </a>
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

        <Concierge open={conciergeOpen} onClose={() => setConciergeOpen(false)} pending={pendingAsk} />

        {!conciergeOpen && (
          <button type="button" className="ask-fab" onClick={() => setConciergeOpen(true)}>
            <Icon name="chat" size={20} />
            Ask
          </button>
        )}

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
      {shoppingOpen && <ShoppingSheet onClose={() => setShoppingOpen(false)} />}
      {planOpen && <WeekPlanSheet onClose={() => setPlanOpen(false)} />}
      {swap && <SwapSheet initial={swap.ingredient} onClose={() => setSwap(null)} />}
      {cookingId && api.getDish(cookingId) && <CookMode dish={api.getDish(cookingId)!} onClose={() => setCookingId(null)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
      {!profile.done && (
        <Onboarding
          onDone={(p) => { setProfile(p); notify("Saved your cooking roots"); }}
          onSkip={() => setProfile((p) => ({ ...p, done: true }))}
        />
      )}
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
