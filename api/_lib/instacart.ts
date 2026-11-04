import { ENV } from "./env.js";

/** Instacart Developer Platform: create a real shopping-list page and return its URL. */
export async function createShoppingList(title: string, items: string[]): Promise<string> {
  if (!ENV.instacartKey) throw new Error("INSTACART_API_KEY is not set");
  const res = await fetch(`${ENV.instacartHost}/idp/v1/products/products_link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${ENV.instacartKey}`,
    },
    body: JSON.stringify({
      title,
      link_type: "shopping_list",
      expires_in: 7,
      line_items: items.map((name) => ({ name, display_text: name })),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Instacart ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { products_link_url?: string };
  if (!data.products_link_url) throw new Error("Instacart returned no link");
  return data.products_link_url;
}
