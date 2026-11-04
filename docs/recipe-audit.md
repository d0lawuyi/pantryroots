# Recipe catalog audit

November 4, 2026. Baseline: commit `74ef4ce`.

## Acceptance criteria

- All 23 curated recipes have a positive serving count and an amount for every required ingredient.
- Named method ingredients participate in the existing pantry matcher and shopping list; quantities do not replace the canonical ingredient names.
- Optional serving extras are displayed in recipe and cooking views, and are excluded from required-ingredient matching.
- Water and preparation guidance are displayed separately. Pre-cooking beans or softening stockfish does not set the overnight-preparation flag.
- Existing Party Jollof and sample-pantry regression checks continue to pass.

## Findings and changes

The other 22 cards lacked amounts and serving counts. Method/checklist gaps included garlic, hot pepper and oil in Thieboudienne; frying oil in Yassa; hot pepper in Amala and Fufu; stock and cooked beef in Egusi; stock in Nsala and Tuwo; oil, stock, thyme and curry powder in Ghana Jollof; garlic, ginger, oil and black pepper in Pilau; oil, garlic, salt and curry powder in Mchuzi; oil in Githeri and Tilapia; and beef, garlic and oil in Bariis.

The remaining cards were checked for complete amounts and usable preparation steps. Salt is listed when used in the method. Honey and yogurt for Chechebsa, avocado for Githeri, lime for Thieboudienne, and other optional sides are explicitly separated. Suya uses premade yaji; extra roasted peanuts are optional. Stockfish and dried fish must be softened and deboned before the relevant soup steps. Githeri and Mukimo quantities refer to already cooked maize and beans. The Luwombo method now explains how its listed onion, tomato and peanut butter form the parcel sauce.

The existing `matchDish`, `AddToListButton`, shared Dish type, and amount rendering are reused. `RecipeExtras` supplies the same preparation and optional-extra content in both recipe and cooking views. No dependency or storage migration is needed.

## Culinary references consulted

These references were used to cross-check ingredients, preparation and optional accompaniments. PantryRoots retains its own simplified recipes and suggested quantities; these are not exact transcriptions or kitchen-tested versions of the sources.

- [Lola Osinkolu: Chicken Yassa](https://cheflolaskitchen.com/chicken-yassa-poulet-au-yassa/) — onion/lemon/mustard marinade, frying oil and refrigerated marination.
- [Lola Osinkolu: East African Pilau](https://cheflolaskitchen.com/east-african-pilau/) — oil, garlic, ginger, spices, beef and rice broth.
- [Flo, All Nigerian Recipes: Fried Egusi](https://www.allnigerianrecipes.com/soups/fried-egusi-soup/) — beef, softened stockfish, crayfish, palm oil and soup preparation.
- [Flo, All Nigerian Recipes: Nsala](https://www.allnigerianrecipes.com/soups/nsala-soup/) — catfish, yam thickener, hot pepper, crayfish and utazi.
- [Flo, All Nigerian Recipes: Miyan Kuka](https://www.allnigerianrecipes.com/soups/miyan-kuka/) — baobab powder, dried fish, dawadawa, palm oil and broth.
- [Ajoke, My Active Kitchen: Gbegiri](https://www.myactivekitchen.com/gbegiri-abula/) — peeled beans, palm oil, pepper and optional cooked meat.
- [Kimberly Killebrew: Doro Wat](https://www.daringgourmet.com/doro-wat-spicy-ethiopian-chicken-stew/) — slow-cooked onions, berbere, niter kibbeh, chicken and eggs.
- [Kaluhi Adagala: Githeri](https://www.kaluhiskitchen.com/chili-and-ginger-githeri/) — already boiled maize and beans, frying oil and optional avocado.
- [Zoe Adjonyoh: Waakye Rice, authorized guest recipe](https://www.nigella.com/recipes/guests/zoe-adjonyohs-waakye-rice) — beans/rice, sorghum leaves and optional accompaniments.
- [Abdullahi and Leila, Xawaash: Somali Rice Pilaf](https://xawaash.com/recipes/somali-rice-pilaf/) — garlic, oil, aromatic spices and measured cooking liquid. The app's existing beef-and-tomato Bariis variant is retained.
- [Abdullahi and Leila, Xawaash: Somali Anjero](https://xawaash.com/recipes/somali-anjero/) — flour/corn mixture, yeast, pourable batter and fermentation.
- [Amena Teferi: Chechebsa](https://www.youtube.com/watch?v=UliSgnNWtZg) — flour/water batter, salt, spiced butter and berbere.
- [A Cookbook of Uganda's Traditional Foods](https://www.eresourcesforhealth.org/wp-content/uploads/2024/06/A-Cookbook-of-Ugandas-Traditional-Foods.pdf) — banana-leaf steaming and groundnut-based accompaniments.

## Verification and boundaries

The new catalog checks failed 38 of 39 checks on the original catalog (before the last preparation-note check was added). After the changes, the full suite passes 46 checks. TypeScript and production builds pass. Changed TS/TSX files have no lint errors; CookMode retains its existing Fast Refresh warning.

Desktop browser checks confirmed Ghana Jollof shows 7 of 11 required ingredients with the sample pantry, and adding its missing ingredients adds four shopping-list entries. Chechebsa reaches 4 of 4 without honey or yogurt; both remain visible under Optional extras, along with its water note, in recipe and cooking views.

Quantities and timings still need kitchen trials and cultural review by cooks familiar with each dish. Pantry matching checks names, not available quantities, freshness or preparation state. Live AI nutrition estimates are unchanged and are not calculated from these amounts. No production deployment, mobile-device certification, complete accessibility audit, or live API verification is included in this change.
