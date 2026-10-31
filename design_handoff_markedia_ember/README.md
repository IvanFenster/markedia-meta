# Handoff: Markedia — "Ember" redesign

## Overview
Markedia is a marketplace of ideas: **Visioners** document and publish ideas, an AI scores them across six weighted criteria and writes a spoiler-free public preview, and **Builders** browse, buy, and build them. This package covers the complete redesigned front end — 11 screens plus a dialog set — in the "Ember" visual direction (warm cream paper, floating soft-edged white surfaces, pill controls, round score orbs, one orange accent).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show intended look and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Svelte, SwiftUI, native, whatever is in use) using its established component patterns, routing, and state libraries. If no environment exists yet, pick the most appropriate framework for the product and implement the designs there.

Note on file format: each `.dc.html` is a self-contained page whose markup sits inside an `<x-dc>` element. Read them as plain HTML — the surrounding wrapper and `support.js` are prototype tooling and have no production meaning. All shared styling lives in two stylesheets, and that is where the design system actually is:

- `styles.css` — base component layer (structure, sizing, layout of `.btn`, `.card`, `.score`, `.table`, forms…)
- `markedia-skin.css` — the **Ember** skin: overrides every token and re-skins every component. **This file is the source of truth for the visual language.** Where the two disagree, the skin wins (it is loaded second).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, and interaction states. Recreate pixel-accurately using the codebase's own libraries. Content is realistic placeholder copy — wire it to real data.

---

## Design Tokens

All tokens are CSS custom properties defined in `markedia-skin.css` under `:root`. Port them into the target system's token layer.

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#fdf8f2` | Page ground (warm cream) |
| `--color-surface` | `#ffffff` | Cards, panels, inputs |
| `--color-text` | `#241a13` | Primary ink (warm near-black) |
| `--color-divider` | `rgba(36,26,19,0.085)` | Hairlines — used sparingly |

Page background additionally carries two very low-opacity radial halos (do not skip — the flat cream reads dead without them):
```css
background-image:
  radial-gradient(900px 520px at 82% -8%, rgba(232,93,31,0.07), transparent 70%),
  radial-gradient(700px 460px at 4% 8%,  rgba(234,161,28,0.05), transparent 68%);
background-repeat: no-repeat;
```

**Neutrals (warm greys):** 100 `#faf5ef` · 200 `#f2ebe3` · 300 `#e6ddd3` · 400 `#cfc3b7` · 500 `#ab9c8e` · 600 `#8a7a6c` · 700 `#665a4f` · 800 `#3f362e` · 900 `#2a221c`

**Accent (orange) — the only brand hue:** `--color-accent` `#e85d1f`
100 `#fef1e8` · 200 `#fcdcc9` · 300 `#f9bd9b` · 400 `#f28c58` · 500 `#e85d1f` · 600 `#cf4d15` · 700 `#a83d11` · 800 `#7d2d0d` · 900 `#4e1d09`

Rules: 500 is the fill for the single primary action per view. 600 = hover, 700 = pressed **and** the color for accent text on paper (500 fails contrast at body size). 100 = tint fills (AI-preview blocks, avatars, step orbs). White labels on 500.

**Secondary amber** (mid-range signals only — drafts, mid states): `--color-accent-2` `#eaa11c`, 100 `#fdf4e2`, 700 `#a86f12`.

**Verdict scale** (score orbs, meters, criterion figures — red→amber→green, deliberately muted):
`--color-score-low` `#bd3a1f` · `--color-score-mid` `#a8760f` · `--color-score-high` `#3a7d55`
`--color-positive` `#3a7d55` · `--color-danger` `#bd3a1f` · `--color-danger-100` `#fdeeea`

### Typography
- **Display / headings:** `Bricolage Grotesque` (Google Fonts, opsz 12–96, weights 400–700). Weight 600, `letter-spacing: -0.025em` (h1 `-0.032em`, h3/h4 `-0.018em`), `line-height: 1.06` (h3/h4 `1.2`), `text-wrap: pretty`.
- **Body / UI:** `Manrope` (400–800). Body `letter-spacing: -0.005em`.
- There is **no monospace font**. Micro-labels are Manrope 700, 11.5–12px, `letter-spacing: 0.05em`, uppercase.
- Figures (prices, scores, counts, table numbers) set `font-variant-numeric: tabular-nums`.
- Scale in use: h1 `clamp(46px,5.6vw,82px)` · section h2 `clamp(30px,3.4vw,42px)` · card h4 `19–23px` · body `17.5px` hero / `14–16.5px` elsewhere · micro-label `11.5–12px`.

### Radius
`--radius-sm` 12px · `--radius-md` 18px · `--radius-lg` 30px · `--radius-full` 999px.
Nothing in this design has a square corner. Hero/CTA/footer panels use 38px; AI-preview blocks 22px; pipeline cards 26px.

### Shadow (warm-tinted, never neutral grey)
```
--shadow-sm: 0 1px 2px rgba(74,42,18,.05), 0 8px 20px -14px rgba(74,42,18,.28)
--shadow-md: 0 2px 4px rgba(74,42,18,.05), 0 18px 40px -22px rgba(74,42,18,.32)
--shadow-lg: 0 4px 8px rgba(74,42,18,.05), 0 40px 80px -34px rgba(74,42,18,.38)
```
Primary buttons carry a colored shadow: `0 1px 2px rgba(120,45,10,.14), 0 12px 24px -14px rgba(200,70,20,.7)`.

### Layout & spacing
Content column `max-width: 1200px`, horizontal padding `32px`. Section vertical padding 52–104px. Card grids: 3 columns, `gap: 24px`. Card interior padding 24–26px.

---

## Components

Recreate these as the codebase's own components; the class names below are only how the prototype refers to them.

### Buttons (`.btn`)
Pill (`999px`), `1.5px` transparent border, Manrope 700, `letter-spacing:-0.01em`, padding `11px 20px`. Transitions `.16s ease` on transform/background/border/shadow. **Hover lifts `translateY(-1px)`**, active returns to 0.
- `btn-primary` — accent 500 fill, `#fff` label, colored shadow; hover 600 (deeper shadow), active 700.
- `btn-dark` — `#241a13` fill, `#fff8f2` label; hover neutral-800.
- `btn-secondary` — white fill, `1.5px` neutral-300 border, `--shadow-sm`; hover border accent-300.
- `btn-ghost` — transparent, neutral-800 label; hover `rgba(36,26,19,.055)`.
- `btn-danger` — transparent, danger label; hover `--color-danger-100`.
- Sizes: `btn-sm` `8px 15px / 13.5px` · default · `btn-lg` `15px 28px / 15.5px` · `btn-icon` 42×42 circle.
- Only **one** primary (solid orange) action per view.

### Chips / tags / badges
- `.chip` — pill, white, `1.5px` neutral-300, Manrope 600 13px, padding `8px 15px`; hover border accent-300. `.chip-active` = ink fill, `#fff8f2` label. `.chip-dashed` = dashed neutral-400 on transparent.
- `.tag` — pill, borderless tint, 600 12px, padding `5px 12px`. Variants: neutral (`neutral-200` on `neutral-800`), accent (`accent-100` on `accent-700`), accent-2, outline (inset `1.5px` ring).
- `.badge` — pill, 700 11px, `letter-spacing:.04em`, padding `5px 11px`. published/owned/live = `rgba(58,125,85,.13)` on `#2c5f41`; draft = amber tint; unpublished/archived = neutral; secured = ink fill on `#fff8f2`.

### Surfaces
- `.card` / `.panel` — **no border**, `--radius-lg`, white, `--shadow-sm`; card hover → `--shadow-md` (list cards also `translateY(-3px)`).
- `.panel-flat` neutral-100, no shadow · `.panel-accent` accent-100, no shadow · `.panel-dark` `#1d1510` with `#fff8f2` text and `--shadow-lg`.

### Score orb (`.score`) — signature element
A **circle**, not a solid blob: 58×58 (`score-lg` 84, `score-sm` 44), `border-radius:999px`, Bricolage 700 21px (`lg` 31 / `sm` 16), `letter-spacing:-0.03em`, tabular figures. Tinted background + a **2px inset ring** in the same hue, figure in the deep tone:
- high `rgba(58,125,85,.12)` / ring `rgba(58,125,85,.32)` / text `#2c5f41`
- mid `rgba(168,118,15,.13)` / ring `rgba(168,118,15,.32)` / text `#8a600c`
- low `rgba(189,58,31,.11)` / ring `rgba(189,58,31,.30)` / text `#a3311a`
- none neutral-100 / ring neutral-300 / text neutral-500

`.score-label` sits beneath: Manrope 700, 10.5px, `.06em`, uppercase, neutral-600.
`.meter` — 7px tall, fully rounded, `neutral-200` track; fill uses the same three verdict colors.

### Nav (`.nav`)
Sticky, `padding:14px 32px`, `background: rgba(253,248,242,.82)` with `backdrop-filter: saturate(1.4) blur(14px)`, 1px divider underneath. Brand: Bricolage 700 21px + a 32px **circular** orange mark ("M", white, glow shadow). Links Manrope 600 14.5px neutral-700 → ink on hover; current page gets a soft pill background `rgba(36,26,19,.055)`.

### Forms
- `.input` — `--radius-md`, `1.5px` neutral-300, `#fffdfb` fill, min-height 46px, padding `12px 14px`. Focus: border accent-400 + `0 0 0 4px rgba(232,93,31,.14)` ring (no browser outline). Selects are fully pill.
- Labels: Manrope 700 12px `.045em`, neutral-700.
- `.seg` segmented control: pill container, `1.5px` neutral-300, 3px inner padding; selected option = ink fill, `#fff8f2` label, pill.
- Focus-visible globally: `2px solid var(--color-accent-400)`, offset 3px, 6px radius.

### Table (`.table`)
No vertical rules. Header: Manrope 700 11.5px `.055em` uppercase neutral-600 on transparent, 1px divider under. Rows separated by 1px divider (last row none), row hover `neutral-100`.

### Dialog
`--radius-lg`, no border, `--shadow-lg`, backdrop `rgba(36,26,19,.42)` + `blur(3px)`.

---

## Screens

All screens share the nav, the cream ground, the 1200px column, and the dark rounded footer (`#1d1510`, `border-radius:38px 38px 0 0`, four columns: brand blurb + Market / Visioners / Company link lists, then a divider row with `markedia.me` and `Terms · Privacy`).

### 1. Home — `Markedia.dc.html`
Marketing landing page.
- **Hero** — two-column grid `1.02fr / 0.98fr`, gap 56, padding `72px 32px 40px`. Left: a white pill eyebrow ("The market of ideas") with an 8px accent dot ringed by `4px var(--color-accent-100)`; h1 "Get an idea / for your **Startup.**" (last word accent); a row of outline pills `Research / Content / Project` plus muted "…anything you're about to build"; 52ch paragraph; primary "Browse ideas" + secondary "Open Ideas Lab" (arrow icon); footnote. Right: a **collage** — an organic accent-100 blob (`border-radius: 52% 48% 44% 56% / 48% 52% 48% 52%`, `rotate(-4deg)`), an amber circle behind, a specimen idea card `rotate(-1.4deg)` with `--shadow-lg`, and below it a white pill (`rotate(2deg)`, `z-index:2`) reading "Scored on 6 criteria before it goes live" with a 30px orange circular sparkle icon.
- **Top ideas** — section head (eyebrow "On the market", h2 "Top ideas, ready to build", two circular prev/next buttons). Three idea cards; below, a centered secondary "See all ideas on the Market".
- **Ideas Lab CTA** — `panel-dark`, `border-radius:38px`, padding 60, two-column (copy / primary button), with an off-canvas blurred orange radial glow top-right (`filter: blur(18px)`, transparent final stop).
- **How it works** — four cards in a 4-column grid, **staggered** `margin-top: 0 / 22 / 44 / 66px`, radius 26. Each: 38px circular number orb (accent-100 on accent-700), h4, 14px body. The fourth card is **solid accent** with white text and a colored shadow — the payoff of the diagonal.

### 2. Market — `Market.dc.html`
Browse and filter. Page head with two stats (`248 IDEAS LIVE`, `7.4 MEDIAN SCORE`), a large search input + dark "AI search" button, an accent-tinted natural-language search panel ("Describe what you're looking for" + Find), a wrapping row of category chips (`All` active), a sort select, a result count, then a 3-column card grid. Cards may carry `OWNED` / `YOUR LISTING` badges, a strikethrough original price with an AI-suggested price, or a "Secure for $1,400" ink pill.

### 3. Idea detail — `Idea.dc.html`
Public listing: title, author, tags, large score orb with per-criterion breakdown (label + weight tag + figure + meter, colored by verdict), the AI preview block, price and buy action, and locked full-content teaser.

### 4. Ideas Lab — `Lab.dc.html`
The Visioner's workspace: list of the user's ideas with status badges (draft / published / unpublished), scores, prices, and entry points into the editor.

### 5. Editor — `Editor.dc.html`
Create/edit an idea. Left column: idea-type segmented control (Startup / Research), heading field with hint, body fields. Right column: "AI evaluation" panel — overall score orb + "Weighted across 6 criteria", then criterion rows (name, weight tag, figure in verdict color, meter). Header carries an `UNSAVED DRAFT` badge and an autosave timestamp.

### 6. Purchased idea — `Purchased.dc.html`
The unlocked, owned version of an idea page — full content visible, purchase receipt, score breakdown.

### 7. Account — `Account.dc.html` · 8. Profile — `Profile.dc.html`
Own-account settings and a public Visioner profile (avatar, stats, published ideas).

### 9. Auth — `Auth.dc.html`
Split sign-in/sign-up with the pitch "Ideas are worth something. Get yours evaluated."

### 10. Admin — `Admin.dc.html`
Moderation table of ideas/users using the `.table` treatment.

### 11. Dialogs — `Dialogs.dc.html` · 12. Pages index — `Pages.dc.html`
A specimen sheet of modals (confirm, purchase, publish) and an index of every screen. Both are reference sheets, not product routes.

---

## Interactions & Behavior

- **Navigation:** every screen links to the others through the nav and in-content links; prototype links are relative `.html` files → map to real routes.
- **Hover:** buttons lift 1px; cards deepen shadow (list cards lift 3px); chips/inputs shift border to accent-300/neutral-400; table rows tint neutral-100. All transitions `.16–.18s ease`.
- **Focus:** never the browser default — `2px solid accent-400`, offset 3px; inputs use the 4px soft accent ring instead.
- **Idea lifecycle (the core flow):** draft → AI evaluation (six weighted criteria produce an overall score and a public preview that must not reveal the idea) → set price (AI suggests, Visioner decides) → publish to Market → Builder purchases → content unlocks (`Purchased`).
- **Destructive actions** (delete idea, unpublish) confirm through a dialog.
- **Responsive:** prototypes are desktop-first at 1200px. Below ~1000px collapse the 3- and 4-column grids to 2 then 1, drop the hero to a single column (collage below copy), and remove the pipeline stagger.

## State Management
- Auth/session (visitor vs. signed-in Visioner/Builder; admin flag).
- Market: search query, natural-language query, category filter, sort, pagination/carousel index.
- Idea: ownership + purchase state (drives locked vs. unlocked content), publish state.
- Editor: form values, dirty/autosave state, evaluation status (idle / evaluating / scored), returned criterion scores, suggested vs. chosen price.
- Dialog open/target.

## Assets
No images or licensed assets. Icons are inline SVG in the [Lucide](https://lucide.dev) style — 24px viewBox, `stroke-width: 2`, round caps and joins, rendered at 16–17px in interface; substitute the codebase's icon library. Fonts load from Google Fonts (Bricolage Grotesque, Manrope) — self-host in production.

## Files
```
markedia-skin.css     ← Ember visual language (tokens + component skin) — READ FIRST
styles.css            ← base component layer the skin overrides
Markedia.dc.html      ← home
Market.dc.html        Idea.dc.html         Purchased.dc.html
Lab.dc.html           Editor.dc.html
Account.dc.html       Profile.dc.html      Auth.dc.html
Admin.dc.html         Dialogs.dc.html      Pages.dc.html
```
