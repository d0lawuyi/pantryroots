import assert from "node:assert/strict";
import { test } from "node:test";
import { dishById } from "../.test-build/data/dishes.js";
import { covers, matchDish } from "../.test-build/lib/pantry.js";

const originalPantry = ["Rice", "Tomato", "Tomato Paste", "Onion", "Scotch Bonnet", "Palm Oil", "Garlic", "Ginger", "Vegetable Oil", "Red Bell Pepper", "Bay Leaf"];

test("fresh tomato and tomato paste remain distinct while rice and oil aliases work", () => {
  assert.equal(covers("tomato paste", "tomato"), false);
  assert.equal(covers("tomato", "tomato paste"), false);
  assert.equal(covers("tomato paste", "tomato paste"), true);
  assert.equal(covers("rice", "long grain rice"), true);
  assert.equal(covers("canola oil", "vegetable oil"), true);
});

test("Party Jollof reports the seasonings and stock missing from the sample pantry", () => {
  const match = matchDish(dishById["party-jollof"], originalPantry);
  assert.deepEqual(match.need, ["thyme", "curry powder", "stock"]);
  assert.ok(match.ratio < 1);
});

test("Party Jollof becomes ready only after every required ingredient is supplied", () => {
  const dish = dishById["party-jollof"];
  assert.equal(matchDish(dish, [...originalPantry, "Thyme", "Curry Powder", "Stock"]).ratio, 1);
  for (const ingredient of dish.ingredients) {
    const match = matchDish(dish, dish.ingredients.filter((name) => name !== ingredient));
    assert.deepEqual(match.need, [ingredient]);
  }
});

test("Party Jollof has a yield and a suggested amount for every required ingredient", () => {
  const dish = dishById["party-jollof"];
  assert.equal(dish.servings, 4);
  assert.deepEqual(Object.keys(dish.amounts ?? {}).sort(), [...dish.ingredients].sort());
  assert.ok(Object.values(dish.amounts).every((amount) => typeof amount === "string" && amount.trim()));
});
