import { useMemo, useState } from "react";
import { DISHES, PEOPLES, type Region } from "@/data/dishes";
import { matchDish } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { DishRow } from "@/components/DishRow";
import { Icon } from "@/components/Icon";
import { PageHeader, Section, Segmented } from "@/components/ui";

type RegionFilter = "all" | Region;

export function ExploreScreen() {
  const { pantry } = useApp();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<RegionFilter>("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PEOPLES.filter((p) => region === "all" || p.region === region)
      .map((people) => {
        const dishes = DISHES.filter((d) => d.peopleId === people.id).filter(
          (d) =>
            !q ||
            people.name.toLowerCase().includes(q) ||
            people.area.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q) ||
            d.ingredients.some((i) => i.includes(q)),
        );
        return { people, matches: dishes.map((d) => matchDish(d, pantry)) };
      })
      .filter((g) => g.matches.length > 0);
  }, [query, region, pantry]);

  const total = groups.reduce((n, g) => n + g.matches.length, 0);

  return (
    <div className="page">
      <PageHeader title="Explore" lede="Dishes grouped by the people who cook them, not just the country on the map." />

      <div className="stack" style={{ marginBottom: 8 }}>
        <div className="search">
          <Icon name="search" size={18} />
          <label htmlFor="explore-q" className="visually-hidden">Search dishes, peoples or ingredients</label>
          <input
            id="explore-q"
            className="input"
            type="search"
            placeholder="Dish, people or ingredient"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Segmented<RegionFilter>
          label="Region"
          value={region}
          onChange={setRegion}
          options={[
            { value: "all", label: "All" },
            { value: "West Africa", label: "West Africa" },
            { value: "East Africa", label: "East Africa" },
          ]}
        />
      </div>

      {total === 0 && (
        <div className="group empty" style={{ marginTop: 24 }}>
          <strong>No dishes match "{query}"</strong>
          Try an ingredient like "plantain" or a people like "Akan".
        </div>
      )}

      {groups.map(({ people, matches }) => (
        <Section key={people.id} title={people.name} action={<span className="small muted">{people.area}</span>}>
          <div className="group">
            {matches.map((m) => (
              <DishRow key={m.dish.id} match={m} showPeople={false} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
