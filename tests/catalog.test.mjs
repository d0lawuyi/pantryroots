import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES, dishById } from "../.test-build/data/dishes.js";
import { matchDish } from "../.test-build/lib/pantry.js";

for (const dish of DISHES) {
  test(`${dish.name}: every required ingredient has an amount and the recipe has a yield`, () => {
    assert.ok(Number.isInteger(dish.servings) && dish.servings > 0, "missing positive serving count");
    assert.deepEqual(Object.keys(dish.amounts ?? {}).sort(), [...dish.ingredients].sort(), "amounts must cover exactly the required ingredient names");
    assert.ok(Object.values(dish.amounts).every((amount) => typeof amount === "string" && amount.trim()));
    assert.equal(new Set(dish.ingredients).size, dish.ingredients.length);
    assert.equal(matchDish(dish, dish.ingredients).need.length, 0);
    for (const ingredient of dish.ingredients) {
      assert.deepEqual(matchDish(dish, dish.ingredients.filter((name) => name !== ingredient)).need, [ingredient]);
    }
    for (const optional of Object.keys(dish.optionalIngredients ?? {})) {
      assert.ok(!dish.ingredients.includes(optional), `${optional} cannot be both required and optional`);
    }
    assert.ok(!dish.ingredients.includes("water"), "water should be a preparation note, not a shopping requirement");
  });
}

const missingMethodIngredients = {
  thieboudienne: ["garlic", "scotch bonnet", "vegetable oil"],
  yassa: ["vegetable oil"],
  amala: ["scotch bonnet"],
  egusi: ["stock", "beef"],
  "ofe-nsala": ["stock"],
  suya: ["vegetable oil", "salt"],
  tuwo: ["stock"],
  "ghana-jollof": ["vegetable oil", "stock", "curry powder", "thyme"],
  "fufu-light-soup": ["scotch bonnet"],
  pilau: ["vegetable oil", "garlic", "ginger", "black pepper"],
  mchuzi: ["vegetable oil", "salt", "garlic", "curry powder"],
  githeri: ["vegetable oil", "salt"],
  "ugali-tilapia": ["vegetable oil", "salt"],
  bariis: ["vegetable oil", "garlic", "beef"],
};

for (const [id, ingredients] of Object.entries(missingMethodIngredients)) {
  test(`${dishById[id].name}: method ingredients participate in pantry matching`, () => {
    for (const ingredient of ingredients) {
      assert.ok(dishById[id].ingredients.includes(ingredient), `${ingredient} is missing from the checklist`);
    }
  });
}

test("Ghana Jollof does not claim readiness without oil, stock and seasonings", () => {
  const pantry = ["basmati rice", "tomato", "tomato paste", "onion", "ginger", "garlic", "shito"];
  assert.deepEqual(matchDish(dishById["ghana-jollof"], pantry).need, ["vegetable oil", "stock", "curry powder", "thyme"]);
});

test("optional accompaniments do not block cooking or enter the missing-ingredient list", () => {
  assert.ok(dishById.thieboudienne.optionalIngredients?.lime);
  assert.ok(dishById.chechebsa.optionalIngredients?.yogurt);
  assert.ok(dishById.githeri.optionalIngredients?.avocado);
  assert.ok(dishById.waakye.optionalIngredients?.eggs);
  for (const dish of DISHES) assert.deepEqual(matchDish(dish, dish.ingredients).need, []);
});

test("precooked-ingredient guidance does not mark Githeri and Egusi as overnight recipes", () => {
  for (const id of ["githeri", "egusi"]) {
    assert.ok(dishById[id].prepNote);
    assert.equal(dishById[id].ahead, undefined);
  }
});
