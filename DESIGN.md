# PantryRoots design system — "Adire & Kente"

The palette comes from the subject. Indigo is the dye of Yoruba **adire** cloth and carries every action and the navigation. **Kente** gold marks what you already have. Leaf green and pepper red are used only for have/need status.

Tokens live in `src/styles/tokens.css`. Components are plain CSS in `src/styles/components.css`, and there are no utility classes in markup.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | `#F2F3F5` | `#0E1016` | Page background |
| `--surface` | `#FFFFFF` | `#181B24` | Grouped lists, sheets |
| `--ink` | `#151826` | `#ECEEF3` | Primary text |
| `--ink-2` | `#555B6E` | `#A5ABBA` | Secondary text |
| `--indigo` | `#22337A` | `#4256B8` | Buttons, active nav |
| `--gold` | `#E9A825` | — | Match meter, pantry tokens |
| `--leaf` | `#17663F` | `#6FCF9C` | "Have" |
| `--pepper` | `#A8301B` | `#F08A74` | "Need" |

### Contrast (WCAG 2.1)

| Pair | Ratio | Grade |
|---|---|---|
| Ink on canvas | 15.9 : 1 | AAA |
| Secondary text on white | 6.8 : 1 | AA |
| White on indigo button | 11.5 : 1 | AAA |
| Gold-ink on gold-tint token | 6.1 : 1 | AA |
| Leaf on leaf-tint | 6.0 : 1 | AA |
| Pepper on pepper-tint | 5.7 : 1 | AA |

The previous palette's inactive tab icons were 2.5 : 1, which fails AA.

## Type

One family: **Schibsted Grotesk** (400–800). Large titles use 800 weight with −0.03em tracking, body text is 15px with 1.5 line height, and numbers use `tabular-nums`.

## Layout

- Phone: large-title header, grouped lists, bottom tab bar.
- ≥ 960px: left sidebar replaces the tab bar; content column max 720px.
- Sheets become centred dialogs at ≥ 720px.
- Radius grows with container size: inputs 10, groups 14, sheets 20. Shadows only on things that float (sheets, toasts).

## Signature element

The **match meter** shows one bar per ingredient, filled gold for what's in your pantry. It appears on every dish row and in the dish sheet.

## Rules

- Sentence case everywhere. No all-caps eyebrow labels.
- Buttons say what happens ("Add", "Copy list", "Post"); the result toast repeats that verb.
- Be honest about what is local or sample data.
