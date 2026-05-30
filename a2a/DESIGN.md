# DESIGN.md — Agentic Open Market (AOM)

> Spatial-AI Data Broker · Blitz Buenos Aires 2026
> The design source of truth. Every UI decision is calibrated against this file.

---

## 1. Design Principles

1. **The demo is the product.** The UI exists to make machine-speed settlement
   *legible* to a human audience watching a live pitch. Latency must be visible,
   state must be unambiguous, and the on-chain confirmation must land as a
   physical "tick." If a judge can't tell what just happened in under a second,
   the design failed.
2. **App UI, not a landing page.** Calm surface hierarchy, strong typography, few
   colors, minimal chrome. No dashboard-card mosaics, no decorative gradients in
   the working area, no ornamental icons. Cards exist only when the card *is* the
   interaction.
3. **One accent. Gold means "Monad / value / settled."** Gold (`--forged-gold`)
   is reserved for the brand mark, the primary action, and the moment value
   settles on-chain. Everything else is ink on dark surface. If gold is
   everywhere, the settlement moment stops reading.
4. **Mono is for machine state.** Logs, tx hashes, block numbers, latency
   readouts, agent IDs, NDVI values, coordinates — all `Geist Mono`, tabular.
   Sans (`Geist`) is for human-facing headings and prose only.
5. **Dark-locked.** `color-scheme: dark`. There is no light mode. This is a
   terminal aimed at a projector in a dim room.
6. **Omit, then omit again.** No happy talk, no instructions, no welcome
   paragraphs in the console. Labels are nouns and verbs: "Escrow locked",
   "NDVI computing", "Claimed 0.1 MON". If a label needs a sentence to explain
   it, the layout failed.

---

## 2. Color System

Dark surfaces are **locked**. Define everything as CSS variables; never hardcode
hex in components. Gold is the only chromatic accent; pearl is a cool counterweight
used sparingly for Agent B / "data/cool" affordances.

### Tokens (drop into `:root`)

```css
:root {
  /* ── Accent: Crafter Station / Monad gold (value, settlement, brand) ── */
  --forged-gold: #FFC107;   /* primary accent */
  --gold-deep:   #C68B05;   /* gradient floor, pressed states */
  --gold-light:  #FFD435;   /* hover */
  --gold-ember:  #DDA607;
  --gold-mute:   #B07E04;

  /* ── Co-accent: pearl (cool side — Agent B / data / "computing") ── */
  --pearl:       #E7ECF2;
  --pearl-dim:   #9AA3AE;

  /* ── Dark surfaces — locked ── */
  --bg:          #0D0D0D;   /* page */
  --surface:     #141414;   /* panels, cards */
  --surface-2:   #1F1F1F;   /* nested / log rows */
  --surface-3:   #262626;   /* hover, scrollbar, raised */
  --hairline:        rgba(255, 255, 255, 0.08);  /* default border */
  --hairline-strong: rgba(255, 255, 255, 0.16);  /* emphasized border */

  /* ── Ink ── */
  --ink:      #F5F5F5;   /* primary text (off-white, never pure white) */
  --ink-mute: #8A8A8A;   /* secondary text, captions */
  --ink-dim:  #525252;   /* tertiary, disabled, timestamps */

  /* ── Semantic (status) ── */
  --ok:    #34D399;   /* settled, confirmed, success */
  --warn:  #FFC107;   /* pending — reuse gold, it IS the "in-flight value" color */
  --error: #F87171;   /* reverted, failed, timeout */
  --info:  var(--pearl);

  --label-color: var(--forged-gold);
  --shadow-card: 0 24px 64px rgba(0, 0, 0, 0.5);

  color-scheme: dark;
}
```

### Rules

- **Body text contrast:** `--ink` (#F5F5F5) on `--surface` (#141414) ≈ 15:1 —
  passes WCAG AAA. `--ink-mute` on `--surface` ≈ 4.7:1 — passes AA for body.
  Never put `--ink-dim` on a text size below 14px.
- **Gold text on dark only** for accent runs; gold-as-background uses near-black
  ink (`#1a1300`) for the label — see button section.
- **No purple/violet/indigo anywhere.** That gradient is the #1 AI-slop tell.
  Our only gradient is the gold display gradient (§3) and the subtle radial
  ambient on the *cover/idle* screen.
- **Status by color AND glyph.** Never color-only. `● settled` (green dot),
  `◐ computing` (pearl), `○ pending` (gold ring), `✕ reverted` (red). 8% of men
  have red-green deficiency — the dot shape and label carry the meaning too.
- Palette ceiling: gold ramp + pearl + 3 status colors + grays. Stay under the
  12-non-gray-color budget. If you reach for a 4th hue, you're decorating.

---

## 3. Typography

Two families, loaded from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- **Geist** — display, headings, human prose.
  `font-family: "Geist", "Inter", system-ui, sans-serif;`
  Enable `font-feature-settings: "ss01","ss03","cv11";` `-webkit-font-smoothing: antialiased;`
- **Geist Mono** — every machine value: logs, hashes, block #, latency, agent IDs,
  coordinates, NDVI, eyebrows, section numbers, button labels, status pills.
  `font-family: "Geist Mono", ui-monospace, "SF Mono", monospace;`
  Use `font-variant-numeric: tabular-nums;` on any column of numbers so
  latency/block counters don't jitter.

> Note: Geist is a real, intentional typeface — this is **not** the
> system-ui/`-apple-system` "I gave up on typography" anti-pattern. Geist is the
> designed brand voice; the system fallback exists only for FOUT safety.

### Type scale (fluid, `clamp()`)

```css
--type-display: clamp(48px, 8vw, 96px);  /* idle / cover hero only */
--type-h1:      clamp(36px, 5vw, 56px);  /* console title */
--type-h2:      clamp(28px, 3.5vw, 40px);/* panel headers */
--type-h3:      clamp(20px, 2.2vw, 24px);
--type-body:    16px;                    /* minimum body size — never below */
--type-body-sm: 14px;
--type-caption: 12px;                    /* timestamps, fine print only */
--type-log:     13px;                    /* mono log lines */
```

- Heading line-height ~1.0–1.1; body 1.5–1.55.
- Headings use negative tracking: `letter-spacing: -0.035em` (h2) to `-0.045em`
  (display). Mono labels use **positive** tracking `0.12em–0.18em`, uppercase.
- Curly quotes (`"" ''`), real ellipsis (`…`), real `×` for the lockup — never
  straight quotes or `...`.
- Loading verbs end in `…`: "Locking funds…", "Computing NDVI…", "Settling…".
- No skipped heading levels. Console title = h1, panel headers = h2,
  sub-blocks = h3.

### The eyebrow / numbered-section pattern (ported)

Reuse it for the demo's *phases* so the audience can follow the agent flow as numbered steps:

```
01 · INTENT        Agent A scopes a hectare for drought audit
02 · ESCROW LOCK   lockFunds(taskId, agentB) → Monad
03 · INTERCEPT     Rust sidecar reads the exec-events ring buffer
04 · PIPELINE      FastAPI computes NDVI on .tif telemetry
05 · SETTLEMENT    completeTask() → 0.1 MON released
```

```css
.label, .sec-eyebrow {
  font-family: "Geist Mono", monospace;
  font-size: 11px; font-weight: 500;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--ink-mute);
}
.sec-num {
  font-family: "Geist Mono", monospace;
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em;
  color: var(--forged-gold);
  padding: 4px 8px; border-radius: 4px;
  background: color-mix(in srgb, var(--forged-gold) 12%, transparent);
}
```

---

## 4. Layout & Spacing

### The console: split-screen (PRD §4)

The PRD mandates a split-screen view. This is the primary screen and it is an
**App UI layout**, not a stack of marketing cards.

```
┌──────────────────────────── TopBar (pill, fixed) ────────────────────────────┐
│  ⬣ AOM        INTENT · ESCROW · INTERCEPT · PIPELINE · SETTLE       Monad ●    │
└───────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────┬────────────────────────────────────────────────┐
│  AGENT A — Macro Buyer        │  AGENT B — Geospatial Engine                    │
│  (gold-tinted left rail)      │  (pearl-tinted right rail)                      │
│                               │                                                 │
│  ▸ log line  mono             │   NDVI map / .tif preview                       │
│  ▸ log line  mono             │   plot-by-plot health report                    │
│  ▸ lockFunds(0x…) → 0.1 MON   │   NDVI = (NIR − Red)/(NIR + Red)                 │
│                               │                                                 │
├──────────────────────────────┴────────────────────────────────────────────────┤
│  MONAD LEDGER  · block #1234567 · finality 480ms · TaskFunded → TaskCompleted   │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Two columns, one bottom rail.** Left = Agent A (gold side: it holds the
  value / issues intent). Right = Agent B (pearl side: it computes / is the
  "cool" data engine). Bottom = the Monad ledger ticker, full width, where
  settlement physically lands.
- Built with CSS **grid**, not JS measurement:
  `grid-template-columns: 1fr 1fr; grid-template-rows: 1fr auto;`
  Collapse to a single column under 900px (`1fr` / stacked) so it still reads on a
  laptop; the bottom ledger stays pinned.
- A **center seam** (1px `--hairline-strong`) divides A from B. When the sidecar
  fires the WebSocket trigger, animate a single gold pulse traveling left→right
  along the seam — that *is* the "microsecond intercept" made visible.

### Spacing scale (8px base)

Use a strict 4/8 scale. No magic numbers.

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

--pad-x: clamp(20px, 4vw, 64px);
--pad-y: clamp(32px, 4vw, 56px);
```

### Radius (hierarchy, not uniform bubble)

```css
--radius-sm:   8px;   /* chips, status pills inner, log-row hover */
--radius-card: 16px;  /* panels, cards */
--radius-pill: 999px; /* topbar, CTAs, status pills, agent badges */
```

- Nested radius rule: inner radius = outer − gap. A pill inside a 16px card with
  8px padding gets ≤8px radius.
- Do **not** put one giant uniform radius on everything — that's AI-slop tell #5.
  Pills for chrome/actions, 16px for panels, 8px for inner chips.

### Borders & elevation

- Default panel border: `1px solid var(--hairline)`.
- Elevation by **surface step + hairline**, not by lightness inversion or thick
  borders. `--surface` panel on `--bg`, `--surface-2` for nested log rows.
- No thick borders, no colored left-border-on-cards (AI-slop tell #8). The one
  allowed accent border is the **active-phase** panel: `box-shadow: inset 0 0 0 1px
  color-mix(in srgb, var(--forged-gold) 40%, transparent)`.

---

## 5. Components

### TopBar (ported — floating pill)

Fixed, centered, `border-radius: 999px`, `backdrop-filter: blur(16px) saturate(160%)`,
`background: color-mix(in srgb, var(--surface) 86%, transparent)`, `--shadow-card`.
Three zones: brand mark (left) · phase tabs (center, mono uppercase) · Monad
status (right: `● connected · testnet 10143`). Phase tabs collapse off-screen
under 820px.

### Buttons / CTAs (ported)

```css
.cta {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 20px; border-radius: 999px;
  font-family: "Geist Mono", monospace;
  font-size: 11.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  transition: transform 200ms var(--ease-spring), background 200ms ease, border-color 200ms ease;
}
.cta--primary { background: var(--forged-gold); color: #1a1300; }   /* near-black ink on gold */
.cta--primary:hover { transform: translateY(-2px); background: var(--gold-light); }
.cta--ghost { background: transparent; border: 1px solid var(--hairline-strong); color: var(--ink); }
.cta--ghost:hover { border-color: var(--ink-mute); background: color-mix(in srgb, var(--ink) 6%, transparent); }
```

- Exactly **one** primary (gold) action visible per view. In the demo that's
  "Trigger audit" / "Run demo". Everything else is ghost.
- Button labels are specific verbs: "Trigger audit", "Lock 0.1 MON", "Replay" —
  never "Submit" / "Continue".
- Disabled: `opacity: 0.45; cursor: not-allowed;` and remove the hover transform.

### Agent panels

- Header row: agent badge (pill) + role label (mono) + live status dot.
  Agent A badge tinted gold, Agent B tinted pearl.
- Body: for A, a **log stream**; for B, the **NDVI/data view**.
- Active agent gets the gold inset ring (§4). Idle agent dims to `--ink-mute`
  headers so attention follows the live one.

### Log stream (Agent A) — this is core, design it well

```css
.log-row {
  display: grid; grid-template-columns: auto auto 1fr; gap: var(--space-3);
  padding: 6px var(--space-3);
  font-family: "Geist Mono", monospace; font-size: var(--type-log); line-height: 1.5;
  border-radius: var(--radius-sm);
}
.log-row + .log-row { margin-top: 2px; }
.log-ts   { color: var(--ink-dim); font-variant-numeric: tabular-nums; }
.log-tag  { color: var(--forged-gold); }       /* event type */
.log-msg  { color: var(--ink); }
.log-hash { color: var(--pearl-dim); }         /* tx hashes / addresses */
.log-row[data-level="ok"]    .log-tag { color: var(--ok); }
.log-row[data-level="error"] .log-tag { color: var(--error); }
```

- New lines **append at the bottom** and auto-scroll; entrance = 120ms fade +
  4px slide-up (`--ease-out`), never a layout-shifting reflow.
- Hashes/addresses are truncated middle (`0x1a2b…9f` ) and copyable on click with
  a 1s "copied" tick. Full value in `title`.
- Monospace + `tabular-nums` so columns stay aligned as values stream.

### Monad ledger ticker (bottom rail) — the money shot

- Full-width strip. Shows: current **block #** (mono, tabular, counting up),
  **finality latency** (e.g. `480ms`, gold when sub-second), and the two events
  `TaskFunded → TaskCompleted` as a connected pair.
- On `TaskCompleted`: flash the strip border gold for 320ms, snap the latency
  readout, and emit one confident "settled" state — green `●` + "0.1 MON
  released to Agent B". This is the climax of the live demo; it must feel like a
  *tick*, not a fade.
- Latency is the hero metric. Render it large-ish (`--type-h3`), tabular, with the
  unit in `--ink-mute`. Sub-second values go gold; over a second go `--ink`.

### Status pills

```
● settled    (--ok,    green dot)
○ pending    (--warn,  gold ring, gentle pulse)
◐ computing  (--pearl, half dot, spin/pulse)
✕ reverted   (--error, red ×)
```

Shape + color + label all carry the state. Mono, uppercase, `--radius-pill`,
`--surface-2` background, 1px hairline.

### Empty / idle / error states

- **Idle (pre-demo):** the one place ambient atmosphere is allowed — a calm dark
  surface with the AOM lockup, a single radial gold glow (low opacity), and one
  primary CTA: "Trigger audit". Mono subtitle states what will happen in one
  line. No drifting orbs in the working console (that's landing-page furniture);
  keep them out of the live view.
- **Error/timeout:** specific, actionable, mono. "Sidecar lost ring-buffer
  connection — retrying in 2s" not "Something went wrong." Red `✕`, fix/next-step
  always included.
- **Reverted task:** show the revert in the ledger with the reason
  ("hash mismatch — funds returned to Agent A"), don't just disappear it.

---

## 6. Motion

Restrained, purposeful, and tied to making latency legible.

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--dur-xs: 120ms; --dur-sm: 200ms; --dur-md: 320ms; --dur-lg: 520ms; --dur-xl: 800ms;
```

- **Animate only `transform` and `opacity`.** Never `transition: all`, never
  animate `width/height/top/left` (the log stream must not jank).
- The **three intentional motions** of the demo:
  1. **Seam pulse** — gold dot travels left→right along the A|B seam when the
     sidecar fires the WebSocket trigger. Makes "microsecond intercept" visible.
  2. **Ledger settle tick** — border flash + latency snap on `TaskCompleted`
     (`--dur-md`, `--ease-spring`).
  3. **Log entrance** — fade + 4px slide-up per new line (`--dur-xs`, `--ease-out`).
- Entering = `ease-out`, exiting = `ease-in`, moving = `ease-in-out`.
- Always honor `prefers-reduced-motion: reduce` — disable orbs, seam pulse, and
  slides; keep instant state changes (the demo still has to *work* reduced-motion).

---

## 7. Accessibility & Responsive

- `focus-visible` ring on every interactive element — a 2px gold outline with
  2px offset. Never `outline: none` without a replacement.
- Touch targets ≥ 44px (the demo may be driven from a phone/tablet on stage).
- Body text ≥ 16px; log lines 13px is the floor and only for mono machine data
  on high-contrast `--ink`.
- All status conveyed by glyph + label, not color alone (§2).
- No `user-scalable=no`. `viewport-fit=cover` + `env(safe-area-inset-*)` for
  notch devices.
- Console collapses to single column < 900px; topbar tabs hide < 820px; the
  ledger ticker stays pinned at all sizes — it's the one thing the audience must
  always see.

---

## 8. AI-Slop Guardrails (hard rejections)

This is a hackathon demo built fast with AI. Actively reject these:

1. ❌ Purple/violet/indigo gradients or blue→purple schemes. Our only gradient is
   the gold display gradient.
2. ❌ The 3-column icon-in-colored-circle feature grid. There are no marketing
   feature cards in this product.
3. ❌ Icons in colored circles as decoration.
4. ❌ Center-everything. The console is a left-aligned working layout; only the
   idle/cover screen centers.
5. ❌ Uniform bubbly radius on everything (use the §4 radius hierarchy).
6. ❌ Decorative blobs / floating circles / wavy dividers in the working console.
   (Ambient glow is allowed *only* on the idle screen.)
7. ❌ Emoji as design elements. Status glyphs are geometric (●○◐✕), not emoji.
8. ❌ Colored left-border-on-cards.
9. ❌ Generic hero copy ("Unlock the power of…", "Your all-in-one solution…").
   Copy is operational and specific to the agent flow.
10. ❌ `system-ui`/`-apple-system` as the *primary* font. Geist is the brand voice.

