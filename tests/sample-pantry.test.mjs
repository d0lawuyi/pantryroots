import assert from "node:assert/strict";
import { test } from "node:test";
import { SAMPLE_PANTRY, matchesSamplePantry } from "../.test-build/data/sample-pantry.js";

test("recognizes the legacy sample regardless of case and order", () => {
  assert.equal(matchesSamplePantry([...SAMPLE_PANTRY].reverse().map((item) => item.toLowerCase())), true);
});

test("never treats empty or customized pantry contents as the sample", () => {
  assert.equal(matchesSamplePantry([]), false);
  assert.equal(matchesSamplePantry([...SAMPLE_PANTRY, "Plantain"]), false);
  assert.equal(matchesSamplePantry(SAMPLE_PANTRY.slice(1)), false);
});
