# Magic Beyond Himalaya V2 — FINAL BUILD SPEC

Locked by the lead engineer. Builders work from this file alone. Where BRIEF.md and this file disagree, BRIEF.md's hard constraints win; where DRAFT-SPEC.md or any proposal disagrees with this file, this file wins. Every name below (route tokens, CSS classes, data fields, function names, db paths, storage keys) is a contract: use it verbatim.

Files: `index.html`, `styles.css`, `data.js`, `maps.js`, `app.js`, `admin.js`, `images/*.jpeg` (existing: sunrise-peak, manaslu-village, forest-ridge, prayer-flags, trail-village, summit-pose, sandip).

---

## 1. Decisions

### 1.1 The one bold move: the Thread
One amber line, 2.5px, round caps, that is always literally a route. It is: the underline drawn under the wordmark on first load; the elevation-profile title block on every trek page (drawn from that trek's real `days_data[].alt`, so the eight trek pages open with eight different silhouettes); the route on the sketch map; the spine of the agenda's month strip; the capacity bar inside every departure row; the progress bar in the admin desk. Nothing else is decorated: no gradients, no glassmorphism, no contour patterns, no photo backgrounds, no icons grid, no reviews, no stars. The same numbered day glyph (cream disc, deep-green ring, DM Sans number) appears as the agenda date badge, the map night marker and the profile dot, so agenda → departure → map → itinerary read as one journey line. On a departure page the glyph carries a real date ("D4 · Thu 16 Oct").

Only the Thread that is the primary content of the current view animates (profile hero on trek pages, month strip on agenda, wordmark underline on home). Low-end phones draw one line per screen, not five.

### 1.2 IA (resolved). Hash routes, bare tokens only, `[a-z0-9-]`
| Token | View |
|---|---|
| `#home` (also empty/unknown) | Typographic hero, heroNote, Next departures (≤4 real open rows), trek index, Your guide, How booking works, FAQ, contact |
| `#treks` | Full ruled trek index with difficulty/length chips and sort by days/price |
| `#trek-{trekId}` | ProfileHero → intro (photo 4:5 + 3 overview paragraphs) → RouteMap + ElevationProfile + DayList (shared highlightDay) → highlights → PriceTiers with pax stepper → Included/Not included/Add-ons → Departures for this trek → Ask Sandip |
| `#agenda` | Title "Departures", MonthStrip, FitMyDates panel, trek filter chips, month-grouped DepartureRows |
| `#departure-{id}` | Date block, trek, start→end, spots, fixed price, note, DateStrip (every day with its real date), RouteMap in static mode with dated markers, CTAs |
| `#book-{id}` | Departure view underneath + BookingSheet (full-height sheet on phone, right panel on desktop). Browser back closes it |
| `#my-trips` | Viewer's own bookings (bookings/{me.id}) with withdraw |
| `#about` | Sandip portrait, guide paragraph (FAQ sentences only), included/not/add-ons, FAQ, contact block, prototype line |
| `#admin` | Gate → Inbox (default) |
| `#admin-departures`, `#admin-departure-{id}`, `#admin-bookings`, `#admin-settings` | Admin screens; every one re-runs the gate |

No `#contact` route (folded into `#about` and footer). No `#reviews`. Sub-state (selected day, filters, pax, form drafts) lives in memory + sessionStorage, never in the hash.

Departure ids are admin-generated slugs `{trekId}-{YYYYMMDD}` (`-2`, `-3` on collision) written with `db.doc("departures/"+id).set()`, so every hash stays a bare token and a date is shareable on WhatsApp. Any id used in a hash is sanitised with `/[^a-z0-9-]/g → ""`.

### 1.3 Mobile pattern (resolved)
- 390px first, 16px gutters, max content width 680px single column; ≥1024px two columns at 1120px max (sticky left map/profile, scrolling right itinerary; agenda list left, departure detail right).
- TopBar 52px sticky (`top: env(safe-area-inset-top, 0px)`): wordmark left; WhatsApp icon (opens Ask sheet) and theme toggle right; no hamburger. Desktop adds inline nav links.
- BottomTabs 56px + `env(safe-area-inset-bottom, 0px)`: **Home · Dates · Treks · My trips** ("Dates" second from left, under the thumb). Active tab: amber sliding underline. On `#trek-*` and `#departure-*` the tab bar is replaced by CtaBar (price left, one primary button right). On `#book-*` neither shows; the sheet has its own sticky submit. On `#admin*` the admin tabs occupy the slot.
- Agenda: vertical list grouped by month, sticky month headers under the TopBar, 72px full-width tap rows (serif day numeral + small weekday/month left, trek/meta middle, price + SpotsPill right, amber capacity thread inside the row). MonthStrip above: horizontal `scroll-snap` chips (next 12 months), current month pre-scrolled, dot on months with departures. **No month grid anywhere** — 44px cells at 390px cannot carry trek names.
- Booking: single scrolling form (no wizard), 48px inputs at 16px, `inputmode="tel"`, PaxStepper 44px buttons (1–12), live price line computed locally, every field persisted to sessionStorage on input (keyed by departure id), inline validation, one adaptive primary button, ConfirmationCard replaces the form body. Never disabled while capabilities resolve.
- Patchy data: everything static renders before `claude.use` is called. Live regions show a skeleton for at most 4s, then either cached rows with a "cached" stamp or the honest empty line. No spinner ever persists.

### 1.4 Admin pattern (resolved)
- Gate at `#admin*` with four states: checking (≤6s) / editor (Open desk) / view-only (explains claude.ai identity, shows resolved name) / identity unavailable. No password field. Admin subscribes to `bookings` only after `canEdit` resolves true.
- Default admin screen is the **Inbox**: every `requested` item sorted by departure start ascending (soonest departure first), a departure header inserted when ≥2 requests share a departure, each row carrying the computed consequence line ("5 of 8 booked · confirming leaves 1" / amber "Would overbook by 2"), Confirm / Decline / Ask on WhatsApp. Then "Departing within 14 days" and "Counter drift" sections.
- Capacity truth = `manualPax + Σ confirmedPax` from the bookings collection. `departure.spotsLeft` is a public projection, recomputed by the idempotent `syncDeparture(id)` (exposed as "Recount"). Confirm writes the **booking item first**, then syncDeparture. Cancel from requested touches no departure. Restore sets `requested`, never `confirmed`.
- Explicit Save buttons, no autosave. `updatedAt` on every departure; "Edited {rel} on another device — Reload" banner. Delete only with zero non-cancelled bookings; otherwise Close. Duplicate (+7 days) instead of editing a start date (start is read-only after creation so shared `#departure-{id}` links stay true).
- Text only, no images on admin routes. Every destructive action is a two-tap inline confirm. Empty bookings list says "No requests visible".

### 1.5 Map concept (resolved)
Pure inline SVG per trek, no tiles, no library. Field-notebook sketch: cream paper, faint graticule every 0.05°, straight polyline with round joins (no smoothing), walked legs amber, drive/fly legs dashed deep green, numbered night dots, ×2 ring for rest days, amber triangles for passes and high points with authored elevation, small hollow rings for `via` points, start house glyph, end flag glyph, labels with paint-order halo and greedy collision hiding, a computed scale bar and north mark, legend "Sketch map, not for navigation · coordinates approximate". Equirectangular projection with cos(mid-lat) correction. Out-and-back repeats offset 8px. Elevation profile docked below (x = day index, y = altitude, pass spikes, one dotted guide at 4,000 m only when the trek crosses it). Route draws itself once on first viewport entry; two-way tap-to-highlight between marker, profile and day row; a compact day card under the map. No zoom, no pinch, no Walk-it playback in this build. `destroy()` cleans everything.

### 1.6 Visual direction (resolved)
Cream page, deep green reserved for the masthead band, admin band and "high ground" panels, amber for exactly one thing per screen (the Thread or the primary action). Photos only in 4:5 or 1:1 crops with a hairline rule, `loading="lazy"`, explicit dimensions, never full-bleed, never captioned as a trek they may not depict (shared images have generic alt text). DM Serif Display for display, trek names, agenda day numerals and Sandip's italic asides; DM Sans everywhere else; `font-variant-numeric: tabular-nums` on every number. Copy in Sandip's voice comes only from existing FAQ/overview sentences; no time promises anywhere ("Sandip confirms on WhatsApp", never "within 24h"). Primary action wording is always **Request a spot**, never Reserve.

### 1.7 The four open questions
1. **Calendar vs list** → List grouped by month with sticky month headers plus a compact snap-scrolling MonthStrip with departure dots. Same component on desktop, two columns wide.
2. **Spots left for public viewers** → Show only `departure.spotsLeft` (admin-maintained projection, recomputed from bookings by admin). Status wins over the number (`full` → "Full"; `closed` → never rendered). The number is always written ("3 of 8 spots left"). A public request never changes capacity; if pax > spotsLeft show an amber note and never block. Every group departure carries its own fixed per-person `price` (admin must set it); public shows one price, "fixed for this group departure", never a tier computed from the trekker's pax.
3. **Admin inbox** → Neither newest-first nor grouped: requested items sorted by departure start ascending with a departure header when ≥2 share a departure and a consequence line per row. Full flat list with filters lives in Bookings; per-departure party list lives in `#admin-departure-{id}`.
4. **Boldest move** → The Thread (§1.1).

---

## 2. Design tokens (copy verbatim into styles.css)

```css
:root{
  /* brand constants (never used directly in components; map to semantic tokens) */
  --cream:#faf6ef; --cream-2:#f3ece0; --green:#1f3d3a; --green-2:#14302d;
  --amber:#c8842b; --amber-2:#efc079; --ink:#1a1714; --line-c:#d9cfbe;

  /* semantic — light */
  --bg:#faf6ef; --surface:#f3ece0; --surface-2:#ece3d2; --surface-3:#e4d9c4;
  --text:#1a1714; --text-2:#5b544c; --text-3:#8a8177; --text-inv:#faf6ef;
  --rule:#d9cfbe; --rule-2:#e8dfcd;
  --brand:#1f3d3a; --brand-2:#14302d; --on-brand:#faf6ef; --on-brand-2:#c9c1b3;
  --accent:#c8842b; --accent-soft:rgba(200,132,43,.14); --on-accent:#1a1714;
  --thread:#c8842b; --thread-halo:rgba(200,132,43,.18);
  --ok:#2f6b4f; --ok-soft:rgba(47,107,79,.14);
  --warn:#c8842b; --warn-soft:rgba(200,132,43,.14);
  --danger:#a63d2f; --danger-soft:rgba(166,61,47,.12);
  --neutral-soft:rgba(26,23,20,.07);
  --focus:#c8842b;
  --map-paper:#f3ece0; --map-grid:rgba(26,23,20,.07); --map-travel:#1f3d3a;
  --skeleton:rgba(26,23,20,.07); --skeleton-hi:rgba(26,23,20,.12);
  --backdrop:rgba(20,48,45,.55);

  /* type */
  --font-display:"DM Serif Display",Georgia,"Times New Roman",serif;
  --font-body:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --fs-xs:11px; --fs-sm:13px; --fs-base:16px; --fs-md:18px; --fs-lg:22px;
  --fs-xl:28px; --fs-2xl:clamp(32px,6vw,44px); --fs-hero:clamp(40px,9vw,88px);
  --fs-num:34px;            /* agenda day numeral */
  --fs-num-lg:44px;         /* trek index day numeral */
  --lh-tight:1.1; --lh-body:1.5; --lh-loose:1.65;
  --track-caps:.14em;

  /* spacing */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --s-7:48px; --s-8:64px;
  --gutter:16px; --content:680px; --content-wide:1120px;

  /* radii */
  --r-sm:6px; --r-md:10px; --r-lg:16px; --r-pill:999px;

  /* shadows */
  --sh-1:0 1px 2px rgba(26,23,20,.06);
  --sh-2:0 6px 24px rgba(26,23,20,.12);
  --sh-sheet:0 -8px 40px rgba(26,23,20,.18);

  /* z layers */
  --z-sticky:30; --z-bar:30; --z-sheet:40; --z-toast:50;

  /* chrome sizes */
  --topbar-h:52px; --tabbar-h:56px; --ctabar-h:64px;

  /* motion */
  --ease-out:cubic-bezier(.2,.8,.2,1); --dur-sheet:240ms; --dur-thread:900ms;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
    --bg:#14302d; --surface:#1f3d3a; --surface-2:#24463f; --surface-3:#2b5048;
    --text:#f4efe6; --text-2:#c9c1b3; --text-3:#9a9388; --text-inv:#14302d;
    --rule:rgba(250,246,239,.18); --rule-2:rgba(250,246,239,.10);
    --brand:#0f2624; --brand-2:#0b1e1c; --on-brand:#faf6ef; --on-brand-2:#c9c1b3;
    --accent:#efc079; --accent-soft:rgba(239,192,121,.16); --on-accent:#14302d;
    --thread:#efc079; --thread-halo:rgba(239,192,121,.2);
    --ok:#7fc39f; --ok-soft:rgba(127,195,159,.16);
    --warn:#efc079; --warn-soft:rgba(239,192,121,.16);
    --danger:#e08a7b; --danger-soft:rgba(224,138,123,.16);
    --neutral-soft:rgba(250,246,239,.08);
    --focus:#efc079;
    --map-paper:#1f3d3a; --map-grid:rgba(250,246,239,.07); --map-travel:#c9c1b3;
    --skeleton:rgba(250,246,239,.08); --skeleton-hi:rgba(250,246,239,.14);
    --backdrop:rgba(0,0,0,.6);
    --sh-1:0 1px 2px rgba(0,0,0,.3); --sh-2:0 6px 24px rgba(0,0,0,.4); --sh-sheet:0 -8px 40px rgba(0,0,0,.5);
  }
}
:root[data-theme="dark"]{
  color-scheme:dark;
  /* IDENTICAL block to the one above — duplicate every declaration verbatim */
}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:var(--fs-base);line-height:var(--lh-body);margin:0;
  padding-bottom:calc(var(--tabbar-h) + env(safe-area-inset-bottom,0px));}
@media (min-width:1024px){ body{padding-bottom:0} }
```

Breakpoints: phone `<720px`, tablet `720–1023px`, desktop `≥1024px`. Use `@media (min-width:720px)` and `@media (min-width:1024px)` only. Reduced motion: one `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{animation:none!important;transition:none!important} }` block plus JS check `matchMedia('(prefers-reduced-motion: reduce)').matches` before any JS-driven animation.

Type rules: headings `font-family:var(--font-display);font-weight:400;letter-spacing:-.015em;line-height:var(--lh-tight);text-wrap:balance`. Eyebrows/labels `.eyebrow{font-size:var(--fs-xs);letter-spacing:var(--track-caps);text-transform:uppercase;color:var(--text-2)}`. Numbers `.tnum{font-variant-numeric:tabular-nums}`. Prose max `64ch`. Focus: `:focus-visible{outline:2px solid var(--focus);outline-offset:2px}`.

---

## 3. CSS class contract (BEM-ish; app.js/admin.js emit exactly these)

Global: `.container` (max `--content`, `padding:0 var(--gutter)`, auto margins) · `.container--wide` (max `--content-wide`) · `.section` (`padding:var(--s-6) 0`) · `.section__head` (flex, baseline) · `.section__eyebrow` · `.section__title` (h2, `--fs-xl`) · `.section__more` (link right) · `.rule` (1px `--rule` hr) · `.prose` (64ch, `--lh-loose`) · `.aside` (serif italic, `--text-2`) · `.eyebrow` · `.tnum` · `.sr-only` · `.view` (root of every route, `id="view"`) · `.view__title` (h1, `tabindex=-1`) · `.view__back` ("← Back" text link).

**Thread primitive**: `.thread` (svg) · `.thread__line` (path/line: `stroke:var(--thread);stroke-width:2.5;fill:none;stroke-linecap:round`) · `.thread.is-drawn .thread__line` (dashoffset → 0 over `--dur-thread`).

**TopBar**: `.topbar` (sticky, `top:env(safe-area-inset-top,0px)`, bg `--brand`, color `--on-brand`, z `--z-sticky`) · `.topbar__inner` · `.topbar__brand` (link to `#home`) · `.topbar__wordmark` (display font, 20px) · `.topbar__thread` (the underline svg, 2.5px, drawn once) · `.topbar__nav` (hidden <1024) · `.topbar__link` · `.topbar__link.is-active` · `.topbar__actions` · `.iconbtn` (44×44, transparent, `--on-brand`) · `.iconbtn--wa` · `.iconbtn--theme` · `.topbar--admin` (adds "Sandip's desk" label).

**BottomTabs**: `.tabbar` (fixed bottom, bg `--surface`, border-top `--rule`, `padding-bottom:env(safe-area-inset-bottom,0px)`, z `--z-bar`, hidden ≥1024) · `.tabbar__tab` (flex col, 56px, 11px label) · `.tabbar__tab.is-active` (color `--accent`) · `.tabbar__icon` (24px svg) · `.tabbar__label` · `.tabbar__ink` (2px amber underline, `transform:translateX()` 200ms) · `.tabbar.is-hidden`.

**CtaBar**: `.ctabar` (same position/z as tabbar; bg `--surface`; shown <1024 on trek/departure routes; ≥1024 rendered inline in the page head as `.ctabar--inline`) · `.ctabar__price` (display font 22px) · `.ctabar__price-note` (11px `--text-2`) · `.ctabar__btn` (a `.btn.btn--primary`).

**Hero (home)**: `.hero` (cream, `padding:var(--s-7) 0`) · `.hero__tagline` (h1, `--fs-hero`) · `.hero__note` (`--fs-md`, `--text-2`) · `.hero__note--live` (from settings.heroNote; left 2.5px amber border).

**ProfileHero (trek)**: `.phero` (relative, bg `--surface`, hairline bottom rule) · `.phero__svg` (absolute, full width, 160px, `.elev.elev--hero` inside) · `.phero__eyebrow` (region) · `.phero__title` (h1, `--fs-2xl`) · `.phero__facts` (flex wrap) · `.phero__fact` (`.tnum`, 13px) · `.phero__fact-key` (eyebrow).

**Trek index**: `.trek-list` (ruled: children separated by 1px `--rule`) · `.trek-card` (row; `display:grid;grid-template-columns:56px 1fr 72px` phone, `72px 1fr 96px 120px` ≥720; whole row is `<a href="#trek-{id}">`) · `.trek-card__num` (display font `--fs-num-lg`, days) · `.trek-card__num-key` ("days", 11px) · `.trek-card__body` · `.trek-card__name` (h3 display 22px) · `.trek-card__meta` (13px, `--text-2`: region · altitude · difficulty) · `.trek-card__spark` (svg sparkline 100×28, thread colour) · `.trek-card__price` (`.tnum`; "from $160" label + big number) · `.trek-card__thumb` (72×72 1:1 img, hairline border, `loading=lazy width height`) · `.trek-card__next` (13px, only when live: "Next: Thu 16 Oct · 3 spots") · `.trek-card.is-hidden` (filtered out).

**Stat row**: `.stats` (grid 2 cols phone / 4 cols ≥720, gap `--s-4`) · `.stat` · `.stat__val` (display 22px `.tnum`) · `.stat__key` (eyebrow).

**Chips / badges**: `.chips` (horizontal scroll row, `gap:8px`, `-webkit-overflow-scrolling:touch`) · `.chip` (32px pill, border `--rule`, 13px) · `.chip.is-on` (bg `--brand`, color `--on-brand`) · `.chip[data-group]` · `.pill` (22px pill, 12px, 500 weight, `padding:0 8px`) · status: `.pill--open` (`--ok-soft`/`--ok`), `.pill--few` (`--warn-soft`/`--warn`), `.pill--full` (`--neutral-soft`/`--text-2`), `.pill--closed` (`--neutral-soft`, `--text-3`) · booking: `.pill--requested` (`--warn-soft`), `.pill--confirmed` (`--ok-soft`), `.pill--cancelled` (`--neutral-soft`, line-through none) · difficulty: `.diff` (eyebrow style) + `.diff--easy|--moderate|--challenging|--strenuous` (colour hint only via a 6px dot `::before`; text always present) · **SpotsPill**: `.spots` (`.pill` + `.tnum`; text always written: "5 of 8 spots left" / "2 left" / "Full" / "Closed") + `.spots--plenty` (ok tint, >2) · `.spots--few` (warn tint, 1–2) · `.spots--full` · `.spots--closed`.

**Buttons**: `.btn` (44px, `--r-md`, 16px, 500, inline-flex, gap 8px, `min-width:44px`) · `.btn--primary` (bg `--accent`, color `--on-accent`) · `.btn--ghost` (transparent, 1px `--brand` border; in dark `--text`) · `.btn--dark` (bg `--brand`, color `--on-brand`; used for WhatsApp buttons with `.btn__icon`) · `.btn--danger` (transparent, `--danger` text/border) · `.btn--link` (no chrome, underline) · sizes `.btn--sm` (36px, 14px) · `.btn--lg` (52px) · `.btn--block` (width 100%) · `.btn__icon` (20px svg) · `.btn[disabled]` (opacity .5) · `.btn.is-busy` (spinner `::after`, text kept) · `.btn.is-quiet-flip` (no transition on label change).

**Sheet**: `.sheet-root` (fixed inset 0, z `--z-sheet`, `hidden` when closed) · `.sheet-root.is-open` · `.sheet__backdrop` (bg `--backdrop`) · `.sheet` (bottom-anchored panel, max-height 92vh, bg `--surface`, `--r-lg` top corners, `--sh-sheet`, `transform:translateY(100%)`) · `.sheet.is-in` (`translateY(0)` over `--dur-sheet` `--ease-out`) · `.sheet--full` (height 100dvh, radius 0; used by `#book-*` on phone) · `.sheet--panel` (≥1024: right-hand panel 440px wide, full height, slides from right) · `.sheet__handle` (36×4 pill; on `.sheet--full` it is the Back tap target) · `.sheet__head` (sticky top, title + close) · `.sheet__title` (display 22px) · `.sheet__close` (`.iconbtn`, 44px) · `.sheet__body` (scroll, `padding:var(--s-4)`) · `.sheet__foot` (sticky bottom, `padding-bottom:calc(var(--s-4) + env(safe-area-inset-bottom,0px))`, bg `--surface`, border-top `--rule`).

**Forms**: `.form` (grid, gap `--s-4`) · `.field` · `.field__label` (14px, 500) · `.field__hint` (13px `--text-2`, right of label) · `.input` (48px, 16px, `--r-md`, 1px `--rule`, bg `--bg`; shared by `input/select/textarea`) · `.input--textarea` (min 96px) · `.input--date` · `.field__row` (2 cols) · `.field__prefix` (e.g. "+" hint inside tel field wrapper `.field__wrap`) · `.field__help` (13px `--text-2`) · `.field__error` (13px `--danger`, `role=alert`) · `.field.is-invalid .input` (border `--danger`) · **Stepper**: `.stepper` (inline-flex, border `--rule`, `--r-md`) · `.stepper__btn` (44×44, `aria-label`) · `.stepper__val` (display 22px `.tnum`, min-width 44px, centred) · `.stepper__btn[disabled]` · `.radios` · `.radio` (44px row with native input) · `.check` (native checkbox row) · `.price-line` (`.tnum`; "$175 per person · $350 for 2") · `.price-line__total`.

**MonthStrip (the only "calendar")**: `.mstrip` (horizontal `scroll-snap-type:x mandatory`, `overflow-x:auto`, relative; `::before` = 2px amber spine at vertical centre, `transform-origin:left`, scaleX 0→1 over `--dur-thread` when `.is-drawn`) · `.mstrip__chip` (72px wide, `scroll-snap-align:start`, bg `--surface`, `--r-md`, 13px month + 11px year) · `.mstrip__chip.is-current` · `.mstrip__chip.is-on` (selected filter) · `.mstrip__dot` (6px amber disc, present only when the month has departures) · `.mstrip__chip.is-empty` (`--text-3`). **There is no month grid; no `.cal*` classes exist.**

**Agenda**: `.agenda` · `.agenda__tools` (chips + fit panel) · `.agenda__month` (h2 sticky: `top:calc(var(--topbar-h) + env(safe-area-inset-top,0px))`, bg `--bg`, eyebrow style, `padding:var(--s-3) 0`, `scroll-margin-top` same; `id="m-YYYY-MM"`) · `.agenda__list` (ruled) · **DepartureRow** `.dep` (`<a href="#departure-{id}">`, grid `64px 1fr auto`, min-height 72px, `padding:var(--s-3) 0`, relative) · `.dep__date` (text-align centre) · `.dep__day` (display `--fs-num` `.tnum`) · `.dep__wd` (11px eyebrow: "THU · OCT") · `.dep__body` · `.dep__trek` (display 20px) · `.dep__meta` (13px `--text-2`: "5 days · ends Thu 20 Oct") · `.dep__cap` (2px track `--rule-2`, margin-top 6px) · `.dep__cap-fill` (2px `--thread`, width = booked/capacity %) · `.dep__right` (flex col, align end, gap 6px) · `.dep__price` (`.tnum` 500; "$175 pp") · `.dep .spots` · `.dep--full` (opacity .6; SpotsPill "Full"; row still tappable) · `.dep--dim` (opacity .45; FitMyDates non-fit) · `.dep__fit` (11px `--ok`: "leaves you 2 spare days") · `.dep__note` (13px italic, admin note, optional). **FitMyDates**: `.fit` (details/summary) · `.fit__toggle` (summary, 44px) · `.fit__fields` (`.field__row` of two `.input--date`) · `.fit__clear` (`.btn--link`).

**Departure page**: `.depage` · `.depage__head` (grid `64px 1fr`; big `.dep__date` reused) · `.depage__title` (h1 display) · `.depage__sub` (13px: "Thu 16 Oct → Mon 20 Oct · 5 days") · `.depage__price` (`.tnum` display 28px + "per person · fixed for this group departure") · `.depage__note` (`.aside`) · **capacity dots** `.capdots` (flex gap 6px) · `.capdots__dot` (12px ring `--brand`) · `.capdots__dot--taken` (filled `--brand`) · `.capdots__text` (13px, always present) · **DateStrip** `.datestrip` (ruled list) · `.datestrip__row` (grid `40px 96px 1fr`, 44px min) · `.datestrip__day` (day glyph: 28px cream disc, green ring, number) · `.datestrip__date` (13px `.tnum`: "Thu 16 Oct") · `.datestrip__route` (14px) · `.datestrip__alt` (11px `--text-2`) · `.depage__actions` (two buttons) · `.depage__missing` (empty state variant).

**Trek page pieces**: `.intro` (grid: photo 4:5 `.intro__photo` 160px wide phone / 280px desktop, `.intro__text`) · `.intro__photo img` (hairline border) · **DayList** `.days` (ruled) · `.day` (row, `data-day`) · `.day__head` (button, grid `40px 1fr auto`, min 56px) · `.day__num` (day glyph) · `.day__route` (16px 500) · `.day__facts` (13px `.tnum` `--text-2`: "sleep 2,860 m · +810 m · 5–6 hrs"; hours omitted when `time===""`; rest days show "rest" tag instead of delta) · `.day__body` (hidden until `.day.is-open`) · `.day__desc` · `.day__tags` (`.chip.chip--tag` 26px static) · `.day.is-active` (left 2.5px amber border, from map highlight) · **PriceTiers** `.tiers` (table) · `.tiers__row` · `.tiers__row.is-on` (bg `--accent-soft`) · `.tiers__label` · `.tiers__price` (`.tnum`) · `.tiers__stepper` (`.stepper` + `.price-line`) · `.tiers__fallback` (table only; shown if tier parsing fails) · **IncludedColumns** `.cols` (1 col phone / 3 cols ≥720) · `.cols__col` · `.cols__title` (eyebrow) · `.cols__list` (ruled ul) · `.addon` · `.addon__name` · `.addon__price` (`.tnum`) · `.addon__note` · `.highlights` (ul, `--fs-md`).

**Booking (BookingSheet)**: `.book` (form) · `.book__summary` (sticky under sheet head: trek, dates, `.spots`; `.book__change` link → `#agenda`) · `.book__pax` (`.stepper` + `.price-line`) · `.book__warn` (13px `--warn`, only when pax > spotsLeft: "Only 2 spots left — you can still request, Sandip will reply") · `.book__submit` (`.btn.btn--primary.btn--block.btn--lg`) · `.book__cap-note` (11px `--text-2` under button: "Checking if this can be saved to My trips…" while user pending; removed after) · **ConfirmationCard** `.confirm-card` (bg `--surface-2`, `--r-lg`, padding `--s-5`) · `.confirm-card__title` (display 22px: "Requested.") · `.confirm-card__body` ("Sandip confirms on WhatsApp.") · `.confirm-card__ref` (`.tnum` 13px: "Ref B1X2Y3") · `.confirm-card__actions` (WhatsApp mirror `.btn--dark` + "See my trips" `.btn--ghost`) · `.confirm-card--fallback` (write failed: body says so plainly).

**My trips**: `.trips` (ruled) · `.trip` · `.trip__head` (trek + `.pill--requested|confirmed|cancelled`) · `.trip__meta` (13px `.tnum`: "Thu 16 Oct · 2 people · Ref …") · `.trip__actions` (Withdraw `.btn--danger.btn--sm` with `.inline-confirm`; or "Message Sandip" `.btn--dark.btn--sm`) · `.trips__signed-out` (empty state).

**ContactStrip / CopyField / WhatsAppAsk**: `.contact` (grid) · `.copyfield` (flex, 44px) · `.copyfield__text` (`.tnum`, selectable) · `.copyfield__btn` (`.btn--ghost.btn--sm`, min 44px, text "Copy") · `.copyfield__btn.is-copied` (text "Copied", ok tint, 1.5s) · `.ask` (sheet body) · `.ask__text` (`.input--textarea`, prefilled, editable) · `.ask__open` (`.btn--dark.btn--block`) · `.footer` (deep-green band, `--on-brand`; contact + prototype line) · `.footer__proto` (11px `--on-brand-2`).

**FAQ**: `.faq` (ruled) · `.faq__item` (`details`) · `.faq__q` (`summary`, 48px, 500) · `.faq__a` (`.prose`).

**RouteMap** (emitted by maps.js; see §5): `.rmap` · `.rmap__stage` (relative) · `.rmap__svg` (block, width 100%, `aspect-ratio` set inline) · `.rmap__paper` · `.rmap__grid` · `.rmap__graticule` · `.rmap__route` · `.rmap__halo` · `.rmap__line` · `.rmap__line--walk` · `.rmap__line--travel` · `.rmap__line--done` · `.rmap__markers` · `.rmap__marker` · `.rmap__marker--start|--stop|--pass|--peak|--via|--end` · `.rmap__marker.is-active` · `.rmap__marker.is-dim` · `.rmap__marker.is-hover` · `.rmap__dot` · `.rmap__ring2` · `.rmap__num` · `.rmap__tri` · `.rmap__via` · `.rmap__glyph` (house/flag path) · `.rmap__labels` · `.rmap__label` · `.rmap__label--elev` (second line "5,416 m") · `.rmap__scale` · `.rmap__scale-line` · `.rmap__scale-text` · `.rmap__north` · `.rmap__legend` (11px `--text-3`, under svg) · `.rmap__daycard` (bg `--surface-2`, `--r-md`, padding `--s-3`; `hidden` until a day is highlighted) · `.rmap__daycard-title` (500: "Day 3 · Poon Hill (3,210m) → Tadapani") · `.rmap__daycard-facts` (13px `.tnum`) · `.rmap.is-visible` (triggers draw-in) · `.rmap--static` (no pointer events on markers, no daycard, no profile).

**ElevationProfile**: `.elev` (relative) · `.elev__svg` (width 100%, height 120px; `.elev--hero .elev__svg` 160px) · `.elev__area` (fill `--thread`, opacity .12) · `.elev__line` (`.thread__line` styling) · `.elev__dot` (day glyph small: 10px disc) · `.elev__dot--active` (r×1.3, stroke `--accent`) · `.elev__spike` (pass/peak point, amber triangle 8px) · `.elev__tick` (11px `.tnum` day numbers) · `.elev__ylabel` (11px altitude labels) · `.elev__guide` (dotted `--text-3`, 4,000 m) · `.elev__guide-label` (11px) · `.elev__hair` (1px `--accent` vertical hairline at active day) · `.elev__hit` (transparent rect per day, `data-day`, cursor pointer) · `.elev--hero` (no ticks/labels/hits/guide).

**Toast**: `.toast-root` (fixed, bottom `calc(var(--tabbar-h) + 12px + env(safe-area-inset-bottom,0px))`, centred, z `--z-toast`, `pointer-events:none`) · `.toast` (bg `--brand`, color `--on-brand`, `--r-pill`, 14px, `padding:10px 16px`, opacity 0, `translateY(8px)`) · `.toast.is-in` · `.toast--ok` (left dot `--ok`) · `.toast--error` (left dot `--danger`).

**Empty / notes / skeleton**: `.empty` (bg `--surface`, `--r-lg`, padding `--s-5`, text-align left) · `.empty__title` (display 20px) · `.empty__body` (`--text-2`) · `.empty__actions` · `.note` (13px `--text-2`, padding `--s-2` 0) · `.note--stale` (left 2px `--warn` border: "Showing dates cached 3 h ago — live availability unavailable") · `.note--live-off` ("Live availability unavailable — dates may be out of date") · `.skel` (bg `--skeleton`, `--r-sm`, `animation:shimmer 1.4s linear infinite` with `--skeleton-hi` band) · `.skel--text` (14px tall, width 60%) · `.skel--row` (72px tall, full) · `.skel--block` (160px) · `.skel-group[data-timeout]` (wrapper; app removes it after 4s).

**InlineConfirm**: `.inline-confirm` (inline-flex, gap 8px, 13px) · `.inline-confirm__q` ("Withdraw this request?") · `.inline-confirm__yes` (`.btn--danger.btn--sm` or `.btn--primary.btn--sm`) · `.inline-confirm__no` (`.btn--ghost.btn--sm`). The trigger button is replaced in place by the `.inline-confirm`; auto-reverts after 6s.

**Banner**: `.banner` (full-width strip, 14px, padding `--s-3` `--s-4`, bg `--warn-soft`) · `.banner--danger` (`--danger-soft`) · `.banner--info` (`--surface-2`) · `.banner__text` · `.banner__action` (`.btn--sm.btn--ghost`).

**Admin**: `.admin` · `.admin__band` (bg `--brand`, `--on-brand`, padding `--s-4`; title "Sandip's desk", `.syncpill`, "Back to site" link) · `.admin__title` (display 22px) · **SyncPill** `.syncpill` (`.pill`; states `.syncpill--live` "Live" ok tint · `.syncpill--saving` "Saving…" warn tint · `.syncpill--waiting` "2 waiting" warn tint, clickable → replay outbox · `.syncpill--off` "Offline view" neutral) · **AdminTabs** `.admin-tabs` (fixed bottom on <1024 in the tabbar slot, same padding rules; static sticky row under the band ≥1024) · `.admin-tabs__tab` · `.admin-tabs__tab.is-active` (amber underline) · `.admin-tabs__badge` (amber disc count) · `.admin__body` (`.container`) · `.admin__section` · `.admin__section-title` (eyebrow) · `.admin__group` (h3 display 18px: "Upcoming" / "Past" / departure header in Inbox) · **rows** `.arow` (ruled row, grid `1fr` phone / `1fr auto` ≥720, padding `--s-3` 0) · `.arow__main` · `.arow__title` (16px 500) · `.arow__meta` (13px `.tnum` `--text-2`) · `.arow__line` (13px; the consequence line) · `.arow__line--warn` (`--warn`) · `.arow__bar` (2px track) · `.arow__bar-fill` (2px `--thread`) · `.arow__actions` (flex wrap gap 8px; buttons `.btn--sm`; full-width buttons on phone via `.arow__actions .btn{flex:1}`) · `.arow__contact` (`.copyfield`s + WhatsApp `.btn--dark.btn--sm`) · `.arow__note` (13px italic) · `.arow__caption` (11px `--text-3`: "claude.ai: {name}") · `.arow.is-pending` (buttons disabled, amber outline; label "Confirming…" / "Saving…") · `.arow.is-echoed` (brief ok flash) · `.arow__error` (13px `--danger`: "Didn't send — tap to retry") · `.arow__notice` (`.banner--danger` inside row: "Spots may be off for {departure} — Recount") · `.arow--drift` · `.arow--past` (opacity .6) · `.arow__badge-verify` (`.pill--few` "Verify") · **DepartureForm** `.dep-form` (`.form`) · `.dep-form__preview` (13px `.tnum`: "Ends Mon 20 Oct · id mardi-himal-20261016") · **TrekPicker** `.trekpick` (grid 2 cols) · `.trekpick__tile` (button, 56px, text only: name + "5 days") · `.trekpick__tile.is-on` · `.kv` (dl grid `120px 1fr`) · `.kv__k` (eyebrow) · `.kv__v` · **Gate** `.gate` (centred, `min-height:60vh`) · `.gate__card` (bg `--surface`, `--r-lg`, padding `--s-6`, max 440px) · `.gate__title` (display 28px: "Sandip's desk.") · `.gate__body` (`--text-2`) · `.gate__who` (flex, avatar + "Signed in as {name} · viewer") · `.gate__avatar` (32px round img or coloured disc) · `.gate__actions` · `.gate--checking` (shows `.skel--text` + "Checking your identity…") · `.gate--denied` · `.gate--unavailable` · `.gate--granted` (Open desk button; auto-continues after 600ms) · **SettingsForm** `.settings-form` (`.form`) · `.settings-form__preset` (`.btn--ghost.btn--sm`: "Use 'guiding until…' preset") · `.settings-form__meta` (13px: "Saved 3 min ago") · `.publish-check` (read-only `.kv` panel).

---

## 4. data.js contract

`data.js` defines `window.MBH = window.MBH || {}` and assigns the constants below. No DOM access, no capability calls. Port every V1 field verbatim (same names, same values, same strings) from `spec/v1-data-extract.js`.

```js
// window.MBH.TREKS — array of 8, in V1 order (poon-hill, mardi-himal, langtang,
// annapurna-tilicho, abc-poon, manaslu-circuit, manaslu-tsum, ebc-gokyo)
{
  id: 'poon-hill',                          // V1
  name: 'Ghorepani Poon Hill',              // V1
  region: 'Annapurna · Foothills',          // V1
  days: 4,                                  // V1
  difficulty: 'Easy to Moderate',           // V1 label (free text)
  diffKey: 'easy',                          // V1
  altitude: '3,210 m',                      // V1 display string
  fromPrice: 150,                           // V1
  season: 'Spring (Mar–May) · Autumn (Sep–Nov)', // V1
  image: 'images/sunrise-peak.jpeg',        // V1 (kept)
  overview, overview2, overview3,           // V1 strings
  highlights: [['text','tagKey'], …],       // V1
  days_data: [{day, route, alt, time, desc, tags:[]}, …], // V1 (time may be "")
  pricing: [['1 pax',300], …],              // V1 (labels are free text: '1 pax','9+ pax','1–2 pax','7+ pax')

  // NEW
  heroImage: 'images/sunrise-peak.jpeg',    // same path as image; the 4:5 intro crop
  imageAlt: 'Sunrise light on Himalayan peaks', // generic; NEVER names a trek for shared images
  imageShared: false,                       // true for mardi-himal and manaslu-circuit (borrowed photos)
  maxElev: 3210,                            // number: max over days_data.alt and route pass/peak elev
  sparkline: [2050, 2860, 2630, 1940],      // days_data.map(d => d.alt)
  route: [ /* waypoints, see below */ ]
}
```

**Waypoint shape** (`trek.route[]`, ordered along the walk):
```js
{ day: 1,                 // itinerary day this point is reached on (1..days)
  name: 'Ulleri',         // real place name as it appears in the itinerary
  lat: 28.362, lng: 83.714, // decimal degrees, 3 decimals, real approximate position
  elev: 2050,             // metres; for stops equals that day's days_data.alt
  kind: 'stop',           // 'start' | 'stop' | 'pass' | 'peak' | 'via' | 'end'
  mode: 'walk'            // OPTIONAL: how this point is reached from the previous one:
                          // 'walk' (default) | 'drive' | 'fly'. Drive/fly legs render dashed green.
}
```
Kinds: `start` = first point (trailhead; may also be night 1) · `stop` = overnight · `pass` = col crossed (triangle) · `peak` = high point visited but not slept at: summit, viewpoint, lake, base camp (triangle) · `via` = visited point that is neither (monastery, trailhead junction, base camp passed through) — small hollow ring · `end` = last point (road end). Cities (Pokhara, Kathmandu) are **never** waypoints; approach drives/flights are off-map. A rest day has no waypoint of its own — the previous stop covers it (the map merges consecutive stops with identical lat/lng and labels "D6–7"). Sleep altitude always comes from `days_data[].alt`; `waypoint.elev` is used only for start elevation and pass/peak spikes.

**The builder must supply real approximate coordinates** for all waypoints below from knowledge of Nepal geography (the named villages, passes, lakes and viewpoints). Keep 3 decimals. Sanity rule (checked by the harness, not shipped): no two consecutive walking waypoints more than 25 km apart; every `stop` day number exists in `days_data`. If unsure of a point, still use the named place's approximate position — never drop it, never invent an unnamed point.

Worked example, Poon Hill (values to verify, not to copy blindly):
```js
route: [
  {day:1,name:'Nayapul',   lat:28.311,lng:83.726,elev:1070,kind:'start'},
  {day:1,name:'Ulleri',    lat:28.362,lng:83.714,elev:2050,kind:'stop'},
  {day:2,name:'Ghorepani', lat:28.400,lng:83.700,elev:2860,kind:'stop'},
  {day:3,name:'Poon Hill', lat:28.401,lng:83.690,elev:3210,kind:'peak'},
  {day:3,name:'Tadapani',  lat:28.400,lng:83.746,elev:2630,kind:'stop'},
  {day:4,name:'Ghandruk',  lat:28.376,lng:83.809,elev:1940,kind:'end'}
]
```

Required waypoint lists (day · name · kind · elev):
- **mardi-himal**: 1 Kande start 1770 · 1 Forest Camp stop 2600 · 2 Badal Danda stop 3210 · 3 High Camp stop 3550 · 4 Mardi Himal Base Camp peak 4500 · 4 Low Camp stop 3150 · 5 Sidding end 1750.
- **langtang**: 1 Syabrubesi start 1460 (night 1) · 2 Lama Hotel stop 2470 · 3 Langtang Village stop 3500 · 4 Kyanjin Gompa stop 3800 · 5 Kyanjin Ri peak 4773 · 5 Lama Hotel stop 2470 · 6 Syabrubesi end 1470. (Day 7 is the drive; no waypoint.)
- **abc-poon**: 1 Tikhedhunga start 1540 · 1 Ulleri stop 2050 · 2 Ghorepani stop 2870 · 3 Poon Hill peak 3210 · 3 Tadapani stop 2600 · 4 Sinuwa stop 2340 · 5 Deurali stop 3230 · 6 Machhapuchhre Base Camp via 3700 · 6 Annapurna Base Camp stop 4130 · 7 Bamboo stop 2310 · 8 Jhinu Danda end 1760.
- **annapurna-tilicho**: 1 Dharapani start 1860 (night 1) · 2 Chame stop 2710 · 3 Upper Pisang stop 3300 · 4 Manang stop 3540 (day 5 rest merges) · 6 Khangsar via 3750 · 6 Tilicho Base Camp stop 4150 · 7 Tilicho Lake peak 4919 · 7 Siri Kharka stop 4060 · 8 Yak Kharka stop 4060 · 9 Thorong High Camp stop 4880 · 10 Thorong La pass 5416 · 10 Muktinath end 3760. (Day 11 drive.)
- **manaslu-circuit**: 1 Machha Khola start 900 (night 1) · 2 Jagat stop 1340 · 3 Deng stop 1860 · 4 Namrung stop 2630 · 5 Shyala stop 3500 · 6 Samagaun stop 3530 (day 7 rest merges) · 8 Samdo stop 3860 · 9 Dharamsala stop 4460 · 10 Larkya La pass 5106 · 10 Bimthang stop 3700 · 11 Tilije end 1900. (Day 12 jeep.)
- **manaslu-tsum**: 1 Machha Khola start 869 (night 1) · 2 Jagat stop 1340 · 3 Lokpa stop 2240 · 4 Chumling stop 2386 · 5 Chhokangparo stop 3031 · 6 Milarepa Cave via 3300 · 6 Nile stop 3361 · 7 Mu Gompa via 3700 · 7 Chhokangparo stop 3031 · 8 Lokpa stop 2240 · 9 Deng stop 1860 · 10 Namrung stop 2630 · 11 Lho stop 3180 · 12 Samagaon stop 3530 (day 13 rest merges) · 14 Samdo stop 3860 · 15 Dharmashala stop 4460 · 16 Larkya La pass 5106 · 16 Bimthang stop 3590 · 17 Gho stop 2515 · 18 Tilche end 1500.
- **ebc-gokyo**: 2 Lukla start 2860 mode 'fly' · 2 Phakding stop 2610 · 3 Namche Bazaar stop 3441 (day 4 rest merges) · 5 Dole stop 4200 · 6 Machhermo stop 4470 · 7 Gokyo stop 4790 · 8 Gokyo Ri peak 5357 · 8 Thangnak stop 4700 · 9 Cho La pass 5368 · 9 Dzongla stop 4830 · 10 Lobuche stop 4910 · 11 Gorak Shep via 5164 · 11 Everest Base Camp peak 5365 · 12 Kala Patthar peak 5555 · 12 Pheriche stop 4300 · 13 Tengboche via 3860 · 13 Namche Bazaar stop 3441 · 14 Lukla end 2804. (Day 1 arrival and day 15 flight have no waypoints; `route[0].day === 2`.)

Other constants:
```js
MBH.ROUTES = Object.fromEntries(MBH.TREKS.map(t => [t.id, t.route])); // alias required by BRIEF
MBH.INCLUDED = [ /* 9 V1 strings */ ];
MBH.NOT_INCLUDED = [ /* 7 V1 strings */ ];
MBH.ADDONS = [ ['Porter','$25 per day','Carries your main pack. Ask for one when you book.'], … ]; // 3 V1 rows
MBH.FAQS = [ ['How fit do I need to be?', '…'], … ]; // 8 V1 pairs
MBH.SITE = {
  name: 'Magic Beyond Himalaya',
  tagline: 'Every step tells a story.',
  guide: 'Sandip Sodari',
  whatsapp: '9779851353347',            // digits only, for wa.me
  whatsappDisplay: '+977 9851353347',
  email: 'magicbeyondhimalaya@gmail.com',
  website: 'magicbeyondhimalaya.com',
  heroFallback: 'Eight treks. One guide. Pokhara and Kathmandu, Nepal.',
  images: { sandip: 'images/sandip.jpeg' },
  guideQuotes: [                        // ONLY sentences already in FAQS; used verbatim on #home and #about
    "We walk slowly and steadily, every day.",
    "I carry a first-aid kit and a pulse oximeter. If anyone shows signs of altitude sickness, descending is always the answer — we're never too proud to turn around.",
    "I'll meet you at arrivals and drive you to your hotel — that's part of every package.",
    "I'll send a full packing list once you book."
  ],
  howItWorks: [                          // no payment claims
    'Pick a departure, or ask for a private date.',
    'Send a request here or on WhatsApp.',
    'Sandip confirms on WhatsApp.'
  ],
  prototypeLine: 'This site is a prototype published on claude.ai; the live site is magicbeyondhimalaya.com.'
};
```

Helpers (pure functions, on `MBH`):
```js
MBH.difficultyBands(trek) → Set<'easy'|'moderate'|'challenging'|'strenuous'>
  // split trek.difficulty on /\s+to\s+/i, lowercase each word; 'Easy to Moderate' → {easy, moderate};
  // 'Challenging to Strenuous' → {challenging, strenuous}; always also add trek.diffKey.
MBH.lengthBand(trek) → 'short' (days ≤ 5) | 'medium' (6–10) | 'long' (≥ 11)
MBH.parseTier(label) → {min, max} | null   // /^(\d+)\s*(?:[–-]\s*(\d+))?\s*(\+)?\s*pax$/i ; '9+' → max Infinity; '2 pax' → {2,2}
MBH.tierFor(trek, pax) → {label, price, index} | null
  // tiers parsed in order; the applicable tier is the one with the largest min ≤ pax
  // (Poon Hill pax 3 → '2 pax' $225; EBC pax 5 → '5–6 pax' $650). null if any label fails to parse.
MBH.trekById(id) → trek | undefined
MBH.SPARK_RANGE = [800, 5600]  // global metres range for comparable sparklines
```

---

## 5. maps.js contract

`maps.js` defines `MBH.RouteMap`, `MBH.ElevationProfile`, `MBH.Sparkline`. No capability access, no globals besides `MBH`.

### 5.1 API
```js
MBH.RouteMap(container, trek, opts) → { highlightDay(n, meta?), destroy(), el }
// opts: {
//   onDaySelect(n, source)   // called on marker/profile tap; source: 'map' | 'profile'
//   dates: { start: 'YYYY-MM-DD' } | null  // when given, marker labels read "D4 · 16 Oct" and daycard shows the date
//   static: false            // true → .rmap--static: no interaction, no daycard, no profile, no hover
//   profile: true            // render the docked ElevationProfile under the map
//   initialDay: null
// }
MBH.ElevationProfile(container, trek, opts) → { highlightDay(n), destroy(), el }
// opts: { hero: false, onDaySelect(n,'profile') }   // hero → .elev--hero (no ticks/labels/hits/guide, 160px)
MBH.Sparkline(trek) → string   // '<svg class="trek-card__spark" viewBox="0 0 100 28" …>' polyline of sparkline[], y-normalised to MBH.SPARK_RANGE
```
`highlightDay(n)` with `n === null` clears. `highlightDay` on RouteMap also drives the docked profile; the trek view wires DayList ↔ map through `onDaySelect` and `highlightDay`. Exactly one RouteMap is alive per page; the view's `destroy()` calls `map.destroy()`.

### 5.2 Sizing
On mount and on resize (ResizeObserver, debounced 120ms, full rebuild): `W = container.clientWidth` (fallback 358), `H = round(W * (W < 720 ? 0.72 : 0.6))`. `viewBox="0 0 W H"` so 1 unit = 1 CSS px and all sizes below are px. The svg gets `style="aspect-ratio:W/H"`.

### 5.3 Projection (equirectangular, cos mid-lat)
```
pts = trek.route; minLat,maxLat,minLng,maxLng from pts (rangeLat = max(maxLat-minLat, .01), rangeLng likewise)
k = cos(((minLat+maxLat)/2) * π/180)
inner = { x: W*.12, y: H*.10, w: W*.76, h: H*.72 }        // bottom 18% reserved for scale bar + legend
s = min(inner.w / (rangeLng*k), inner.h / rangeLat)
offX = inner.x + (inner.w - rangeLng*k*s)/2 ; offY = inner.y + (inner.h - rangeLat*s)/2
px(w) = offX + (w.lng - minLng)*k*s ; py(w) = offY + (maxLat - w.lat)*s
kmPerPx = 111.32 / s
```
Scale bar: pick the largest of [1,2,5,10,20,50] km whose px length ≤ W*.25; draw at (x=16, y=H-28) with text "{km} km". North mark: at (W-24, 28), a 14px upward arrow + "N".
Graticule: lines every 0.05° inside the bbox extended by one step each side, class `rmap__graticule`.

### 5.4 Marker resolution
- Group waypoints by identical `lat,lng` (string key with 3 decimals). Consecutive stops sharing a key → one marker with `.rmap__ring2` and label `D6–7`, `aria-label "Days 6–7, Manang, 3,540 m"`. Non-consecutive repeats → each later occurrence is offset by `(+8, +8)` px × repetition index.
- The **night marker for day d** = the last waypoint with `day === d` and kind ∈ {start, stop, end}. Passes/peaks/vias are never "the night".
- Sizes: stop/start/end disc r=11, stroke 2 `--brand`, fill `--surface`, number 11px DM Sans 500 centred (`dominant-baseline:central`); start adds a 10px house glyph beside the disc, end a flag glyph; pass/peak: 12px triangle `--accent` with a 1px `--surface` stroke; via: r=5 hollow ring stroke `--brand`. Marker `<g>` has `transform-box:fill-box;transform-origin:center`, `data-day`, `tabindex="0"`, `role="button"`, `aria-label`. Static mode: no tabindex/role.

### 5.5 Route paths
Iterate consecutive pairs (i → i+1); the leg's mode = `pts[i+1].mode || 'walk'`. Build two `d` strings (M/L subpaths, coordinates rounded to .1): walk legs → `.rmap__line--walk` (stroke `--thread`, 2.5, round joins/caps) with a `.rmap__halo` copy underneath (stroke `--thread-halo`, 8); drive/fly legs → `.rmap__line--travel` (stroke `--map-travel`, 2, `stroke-dasharray:6 6`). `.rmap__line--done` (stroke `--thread`, 3.5) contains walk legs whose target `day ≤ highlighted day`; it is empty when nothing is highlighted.

### 5.6 Labels
Candidates for every marker except merged duplicates: text = name (+ for pass/peak a second `<text class="rmap__label--elev">` "5,416 m"; with `opts.dates`, stops get "D4 · 16 Oct" instead of the name on phone, and "Ghorepani · 16 Oct" ≥720). 11px DM Sans, `paint-order:stroke`, stroke `--map-paper` 3px, fill `--text`. Priority order: start, end, pass, peak, stop (by day), via. Greedy: for each label try anchor positions right (x+16, y+4), left (`text-anchor:end`, x−16), above (x, y−16, middle), below (x, y+22, middle); estimate box `(0.58 × fontSize × chars) × 13`; accept the first that stays inside the svg and intersects no accepted box or marker disc; otherwise omit (marker still has its number and tooltip). When `W < 480`: skip labels for `via` and for `stop` markers on treks with `days > 8` (numbers only).

### 5.7 Elevation profile (docked and hero)
`viewBox="0 0 W 120"` (hero 160). `padL=36, padR=12, padT=14, padB=22` (hero: 0/0/12/0). `n = trek.days`, `dx = (W-padL-padR)/n`, `x_d = padL + d*dx`. Points: if `route[0].day === 1` prepend `(padL, route[0].elev)`; for each day d: if a pass/peak waypoint has `day === d`, add `(x_d - .5*dx, elev)` as a spike point; then `(x_d, days_data[d-1].alt)`. y-scale: `[floor(min/500)*500, ceil(max/500)*500]` where max includes spikes. Draw `.elev__area` (polygon closed to baseline), `.elev__line`, one `.elev__dot` per day at `(x_d, alt)` (r=5, day glyph styling), `.elev__spike` triangles at spike points, `.elev__tick` every day (every 2nd day when `n > 12 && W < 480`), `.elev__ylabel` at each 1000 m inside range (2000 m step if fewer than 30px apart), `.elev__guide` dotted at 4,000 m with label "4,000 m · acclimatisation days above this" **only when `trek.maxElev > 4000`**, `.elev__hit` rects `[x_d - dx/2, x_d + dx/2]` full height with `data-day`. `.elev__hair` vertical line at the active day (hidden otherwise). Hero variant: area + line + dots only, drawn with the Thread draw-in once visible.

### 5.8 Interaction
Single delegated `click`/`keydown` (Enter/Space) listener on `.rmap` root: target `[data-day]` → `highlightDay(d)` then `opts.onDaySelect(d, 'map'|'profile')`. `pointerenter/leave` on markers (only when `matchMedia('(hover:hover)')`) toggles `.is-hover` without calling onDaySelect. `highlightDay(d)`: set `.is-active` on the night marker for d, `.is-dim` on all other stop/start/end markers, rebuild `--done` path, fill `.rmap__daycard` ("Day d · {route}" / facts "sleep {alt} m" + " · {time}" only if time !== "" + " · {Thu 16 Oct}" when opts.dates) and unhide it, update profile (`.elev__dot--active`, hairline). Static mode ignores all of this.

### 5.9 Animation
IntersectionObserver (threshold .2, once) adds `.rmap.is-visible` (and `.elev.is-drawn` on the profile/hero). CSS on `.rmap.is-visible .rmap__line--walk` and `.rmap__halo`: `stroke-dasharray: L; stroke-dashoffset: L → 0` with `transition: stroke-dashoffset var(--dur-thread) var(--ease-out)`; L is set inline via `getTotalLength()` plus 60ms per day added to duration (cap 1800ms). Markers: `opacity:0; transform:scale(.6)` → `1` with `transition-delay: calc(var(--i) * 70ms)` (`--i` = marker index set inline). Under reduced motion: everything rendered final immediately (JS checks and skips dasharray setup; CSS kill-switch in §2). Draw-in runs once per mount; a rebuild on resize does not re-animate (root keeps `.is-visible`).

### 5.10 Theme hooks
All colours through the tokens named in §3 (`--map-paper`, `--map-grid`, `--thread`, `--thread-halo`, `--map-travel`, `--brand`, `--surface`, `--text`, `--accent`). No hex in maps.js. Theme switches re-colour live with no rebuild.

### 5.11 destroy()
Disconnect IO and ResizeObserver, remove the delegated listeners, clear `container.innerHTML`, null references. Idempotent.

---

## 6. app.js contract

`app.js` owns: theme, CapabilityHub (`caps`), store, router, views, sheet, toast, WhatsApp builder, formatting, storage guards, booking write path. It exports `window.MBH.app`. Boot: at script end, `if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot) else setTimeout(boot, 0)` (so admin.js has executed). `boot()` renders TopBar/BottomTabs/route **synchronously first**, then calls `caps.init()`.

### 6.1 Storage guards
`app.storage = { get(key, fallback), set(key, value), remove(key), session: {get,set,remove} }` — every access JSON-encoded, wrapped in try/catch, never throws. Keys: `mbh.theme` ("system"|"light"|"dark"), `mbh.cache.departures` (`{at: ms, docs: []}`), `mbh.outbox` (`[{type:'syncDeparture', departureId, at}]`), `mbh.profiles` (session-only map), `mbh.fit` (session `{land, flyout}`), `mbh.draft.{departureId}` (session `{name,email,whatsapp,pax,note}`), `mbh.filters.treks` (session `{diff, len, sort}`).

### 6.2 Theme
`app.theme.get()/set(mode)/cycle()`; `set` writes `data-theme` on `document.documentElement` for light/dark, removes it for system, persists `mbh.theme`. The inline script in index.html applies the stored value before first paint.

### 6.3 CapabilityHub
```js
app.caps = {
  status: { db: 'pending'|'ready'|'null', user: 'pending'|'ready'|'null' },
  db: null, user: null,                    // resolved handles (never window.claude.db)
  me: null,                                // {id,name,avatarUrl,color,isOwner,canEdit} | null
  canWrite: null,                          // true | false | null  (null == cannot save)
  dbReady: Promise<db|null>, userReady: Promise<user|null>,
  canEdit(): Promise<boolean>,             // memoised; false on any error
  profiles(ids): Promise<Map<id,{name,avatarUrl}>>, // memoised per id in session
  init()
}
```
`init()`: `const use = (n) => { try { const p = window.claude && window.claude.use ? window.claude.use(n) : null; return Promise.resolve(p).catch(() => null); } catch { return Promise.resolve(null); } }`. Then `dbReady = use('db').then(db => { caps.db = db; status.db = db ? 'ready' : 'null'; if (db) subscribePublic(db); store.emit('status'); return db; })`; `userReady = use('user').then(async u => { caps.user = u; if (u) { caps.me = await safe(u.me()); caps.canWrite = await safe(u.can('data.write')); } status.user = u ? 'ready' : 'null'; store.emit('status'); return u; })`. `Promise.all([dbReady, userReady]).then(subscribeMine)`. A 4s timer: if `store.departures === null` after 4s → `store.set('departuresTimeout', true)`.

`app.db`/`app.user` are getters returning `caps.db`/`caps.user`.

### 6.4 Store
```js
app.store = {
  departures: null,        // Array<{id, trekId, start, days, capacity, spotsLeft, manualPax, price, status, note, createdAt, updatedAt}> | null
  departuresTimeout: false,
  departuresSource: 'none' | 'cache' | 'live',
  settings: null,          // {whatsapp, email, heroNote, heroNoteSetAt, heroNoteUntil} | null
  myBookings: null,        // {items:[]} | null
  adminBookings: null,     // Array<{viewerId, ...item}> | null (admin only)
  adminBookingsRaw: null,  // Map<viewerId, items[]>
  set(key, value), get(key), on(key, fn) → off(), emit(key)
}
```
On boot, `store.departures` is seeded from `mbh.cache.departures` (if present) with `departuresSource='cache'`. Views render live regions from the store and re-render only `[data-live="departures|settings|myBookings|status"]` regions on `store.on`.

### 6.5 Subscriptions (exactly once each)
```js
subscribePublic(db):
  db.collection('departures').onSnapshot(snap => { const docs = app.docsOf(snap); store.set('departures', docs); store.set('departuresSource','live'); app.storage.set('mbh.cache.departures', {at: Date.now(), docs}); }, err => { store.set('departuresTimeout', true); });
  db.doc('settings/site').onSnapshot(snap => store.set('settings', app.snapData(snap)), () => {});
subscribeMine():
  if (caps.db && caps.me && caps.me.id) caps.db.doc('bookings/' + caps.me.id).onSnapshot(snap => store.set('myBookings', app.snapData(snap) || {items: []}), () => {});
```
Helpers (defensive to shape): `app.snapData(snap)` → `null` when `snap` is falsy or `exists` (boolean or function) is false, else `data()` or `.data`; `app.docsOf(snap)` → array of `{id, ...data}` from `snap.docs` or an array; `app.snapExists(snap)` → boolean.

Public selectors: `app.departures.public()` = `store.departures.filter(d => (d.status==='open'||d.status==='full') && d.start >= app.fmt.todayISO())` sorted by `start`; `app.departures.forTrek(trekId)`; `app.departures.byId(id)`; `app.departures.open()` (status open only, for home). `app.settings()` = `store.settings || {}` with fallbacks to `MBH.SITE` for whatsapp/email.

### 6.6 Write helpers
```js
app.writeQueue(path, fn) → Promise   // per-path promise chain; one write in flight per doc path
app.inFlight(path) → boolean
app.newBookingId() → 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,5)   // e.g. b1m2x9k4qz
app.slug(s) → s.toLowerCase().replace(/[^a-z0-9-]/g,'')
```

### 6.7 Booking write path (public)
Preconditions for the db path: `caps.me && caps.me.id && caps.canWrite === true && caps.db`. Otherwise the WhatsApp path. Item:
```js
{ id: app.newBookingId(), departureId, trekId, start: dep.start, name, email, whatsapp, pax, note,
  status: 'requested', createdAt: now, updatedAt: now }
```
```js
const path = 'bookings/' + caps.me.id, ref = caps.db.doc(path);
await app.writeQueue(path, async () => {
  const snap = await ref.get();
  const cur = app.snapData(snap);
  const items = app.mergeItems(cur ? cur.items || [] : [], [item]);
  if (app.snapExists(snap)) await ref.update({ items }); else await ref.set({ items });
});
```
`app.mergeItems(stored, incoming)`: union by `item.id`; when both sides have an id, keep the one with the higher `updatedAt` (tie → stored). Withdraw (`#my-trips`): re-read, find item; if `status !== 'requested'` → toast "Sandip already {status} this — message him to change it" and stop; else set `status:'cancelled', updatedAt: now`, `update({items})`. Bookers never write any other status.

Submit button rules: label `Request a spot` iff the preconditions hold at render time, else `Send request on WhatsApp`; the label may flip quietly (`.is-quiet-flip`) when `status.user` resolves; the button is never disabled while resolving and never waits for a capability. On tap in WhatsApp mode: validate, build the request message, `window.open(waLink, '_blank', 'noopener')`, show the ConfirmationCard variant "Opened WhatsApp with your request" (no ref). On tap in db mode: validate, `.is-busy`, write; success → ConfirmationCard with ref + WhatsApp mirror button (same message + `\nBooking ref: {id}`) + "See my trips"; failure → `.confirm-card--fallback` "Couldn't save the request here — send it on WhatsApp instead" with the WhatsApp button; draft is kept. After success the draft `mbh.draft.{departureId}` is removed.

Validation (inline, no alerts): name ≥ 2 chars; email matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; whatsapp digits (after stripping non-digits) 8–15; pax 1–12 integer; note ≤ 500. First invalid field is focused.

### 6.8 Router
```js
app.route() → { token, name, id }   // e.g. {token:'trek-mardi-himal', name:'trek', id:'mardi-himal'}
app.go(token) → location.hash = '#' + token
```
Parse: `raw = location.hash.slice(1); token = /^[a-z0-9-]+$/.test(raw) ? raw : 'home'`. Match in this order: exact `home|treks|agenda|about|my-trips|admin|admin-departures|admin-bookings|admin-settings`; then prefixes `admin-departure-`, `trek-`, `departure-`, `book-`; else `home`. On `hashchange` and boot: call `state.view.destroy()` if present; `sheet.close({silent:true})`; render the view into `#app` as `<section class="view" id="view">…`; set `document.title` (`Magic Beyond Himalaya` / `{Trek} · Magic Beyond Himalaya` / `Departures · …` / `{Trek} · {Thu 16 Oct} · …` / `Request a spot · …` / `My trips · …` / `About · …` / `Sandip's desk · …`); `window.scrollTo(0,0)` unless the transition is `departure-{id}` ↔ `book-{id}` for the same id; focus `.view__title` with `{preventScroll:true}`; update `.tabbar` active tab and `.topbar__link.is-active`; show/hide `.tabbar`/`.ctabar`/`.admin-tabs` per §1.3. Trek rows tapped with an unknown id render `.empty` "That trek isn't listed" with a link to `#treks`.

State:
```js
app.state = { route: {token,name,id}, prevToken: null, view: null /* {update(key), destroy()} */, sheet: null,
              selectedDay: null, pax: 2, filters: {diff:'all', len:'all', sort:'days'}, agendaTrek: 'all' }
```

### 6.9 Views (each `viewX(root, params) → {update(key), destroy()}`)
- `viewHome`: `.hero` (h1 tagline; `.hero__note--live` when `settings.heroNote` non-empty, else `.hero__note` with `SITE.heroFallback`); section "Next departures" `[data-live="departures"]`: up to 4 `app.departures.open()` rows + `.section__more` "See all dates" → `#agenda`; states: pending (≤4s) → 3 `.skel--row`; cache → rows + `.note--stale`; live empty or db null → `.empty` "Dates are set by Sandip and posted here. Ask on WhatsApp for the next one." + WhatsApp `.btn--dark`; timeout without cache → same `.empty` + `.note--live-off`. Section "Eight treks": `.trek-list` (all 8, sorted by days) — `.trek-card__next` filled only when live departures exist. Section "Your guide": `sandip.jpeg` 4:5 + `SITE.guideQuotes` joined as one `.prose` paragraph in quotes + link `#about`. "How booking works": 3 numbered lines. FAQ (first 4 + "All questions" → `#about`). `.footer` with ContactStrip + prototype line.
- `viewTreks`: chips group `diff` (All, Easy, Moderate, Challenging, Strenuous) and `len` (All, ≤5 days, 6–10, 11+), sort toggle (days/price); a trek matches if `MBH.difficultyBands(t).has(diff)` and `MBH.lengthBand(t) === len`. Filters persist in `mbh.filters.treks`.
- `viewTrek(id)`: ProfileHero (`MBH.ElevationProfile(el, trek, {hero:true})`; facts: `{days} days · highest {maxElev} m · {difficulty} · {season} · from ${fromPrice}`); `.intro` (photo with `imageAlt`; `overview` prose, `overview2` as `.aside`, `overview3` prose); RouteMap block (`MBH.RouteMap(el, trek, {onDaySelect: openDay})`, docked profile) beside/above `.days` (DayList: `day__facts` = "sleep {alt} m" + delta vs previous day (`+810 m`/`−1,390 m`; day 1 shows no delta; a day whose route matches `/acclimatisation|rest day/i` or whose alt equals the previous shows tag "rest") + time when non-empty); tapping a `.day__head` toggles `.is-open`, sets `.is-active`, calls `map.highlightDay(d)`; `openDay(d)` from the map opens the row and `scrollIntoView({block:'nearest', behavior: reduced ? 'auto' : 'smooth'})`. `.highlights`. PriceTiers with stepper (state.pax, 1–12) → `.tiers__row.is-on` and `.price-line` "${price} per person · ${price*pax} for {pax}" via `MBH.tierFor`; `.tiers__fallback` when null. `.cols` Included/Not included/Add-ons. "Departures for this trek" `[data-live="departures"]` (`forTrek` public rows) or `.empty` "No fixed dates yet — ask Sandip for a private date" + WhatsApp (`msg.askTrek`). CtaBar: "From ${fromPrice} pp" + `See dates` (scrolls to the departures section if rows exist, else opens Ask sheet with `msg.askTrek`).
- `viewAgenda`: `.view__title` "Departures" + one line "Scheduled group starts with a fixed price and capacity. A request never holds a spot — Sandip confirms on WhatsApp."; MonthStrip (12 months from current; dots from the filtered set; tap → `scrollIntoView` of `#m-YYYY-MM`); chips by trek (`state.agendaTrek`); FitMyDates (`mbh.fit`; fit = `start >= land && end <= flyout`; annotate spare days; non-fit `.dep--dim`); list grouped by `fmt.monthKey(start)` with `.agenda__month` headers; rows via `renderDepartureRow(dep)`; `.dep--full` for status full (SpotsPill "Full"; page still opens with waitlist CTA). Loading/empty states as viewHome (skeleton 3 rows ≤4s → cache/empty/timeout).
- `viewDeparture(id)`: from `app.departures.byId(id)`; if departures still pending → skeleton (≤4s); if not found (or closed) → `.depage__missing` "This date is no longer listed" + `#agenda` link + Ask button. Otherwise head (date block, trek name link to `#trek-{trekId}`, sub "Thu 16 Oct → Mon 20 Oct · 5 days", `.depage__price` "${price}" + "per person · fixed for this group departure"; if `price` missing show "from ${fromPrice}"), `.capdots` (capacity dots, taken = capacity − spotsLeft, text "3 of 8 spots left" or "Full"), `.depage__note` when `note`, DateStrip (all `days_data` with `fmt.addDays(start, d-1)`), `MBH.RouteMap(el, trek, {static:true, profile:false, dates:{start}})`, link "Read the full itinerary" → `#trek-{trekId}`, actions: primary `Request a spot` → `#book-{id}` (full → `Join waitlist on WhatsApp` `.btn--dark` with `msg.waitlist`), secondary `Ask on WhatsApp` (`msg.askDeparture`). CtaBar mirrors the primary.
- `viewBook(id)`: renders `viewDeparture(id)` beneath, then `app.sheet.open({title:'Request a spot', full:true, panel:true, body: bookingForm, foot: submitButton, onClose: () => history.length > 1 && app.state.prevToken === 'departure-'+id ? history.back() : app.go('departure-'+id)})`. Form per §6.7 with draft restore. If the departure is unknown: sheet body = `.empty` "This date is no longer listed" + Ask button.
- `viewMyTrips`: if `status.user==='pending'` → skeleton (≤4s); if `!caps.me || !caps.me.id || status.db !== 'ready'` → `.trips__signed-out` "Requests are saved to your claude.ai identity. You're not signed in here, so this list is empty; anything you sent on WhatsApp is with Sandip." + WhatsApp button; else `[data-live="myBookings"]` list of items (newest first) → `.trip` with trek name via `MBH.trekById(item.trekId)`, date from `item.start`, pax, status pill, ref; requested → Withdraw (InlineConfirm); confirmed → "To change a confirmed booking, message Sandip" + WhatsApp (`msg.changeBooking`); cancelled → no actions. Empty → `.empty` "No requests yet" + link `#agenda`.
- `viewAbout`: portrait 4:5, guide paragraph (`SITE.guideQuotes`), `.cols`, full FAQ, ContactStrip (CopyFields for `whatsappDisplay` and `email`, WhatsApp button), `SITE.prototypeLine`.
- `viewAdmin(sub, id)`: `if (typeof MBH.mountAdmin !== 'function') render .gate--unavailable ("The desk didn't load. Reload the page.")` else `return MBH.mountAdmin(root, app)`; the router passes the sub-route through `app.state.route`. Admin re-mounts on every admin hash change (the mount is cheap; snapshots live in the store, not in the mount).

`renderDepartureRow(dep, {showTrek=true})` is shared by home, agenda, trek page and admin; SpotsPill logic: `status==='closed'` → not rendered publicly; `status==='full' || spotsLeft<=0` → `.spots--full` "Full"; `spotsLeft<=2` → `.spots--few` "{n} left"; else `.spots--plenty` "{n} of {capacity} spots left". Capacity fill = `(capacity - spotsLeft)/capacity`.

### 6.10 Sheet API
```js
app.sheet.open({ title, body: Node|string, foot?: Node, full?: boolean, panel?: boolean, onClose?: fn, closeLabel?: 'Close'|'Back' }) → { close(), el }
app.sheet.close({ silent?: boolean })   // silent skips onClose
```
Renders into `#sheet-root`: backdrop + `.sheet` (`.sheet--full` when `full && width<1024`; `.sheet--panel` when `panel && width>=1024`), `.is-in` on next frame; body `inert`-like: `#app` gets `aria-hidden="true"`; focus moves to the first focusable in the sheet; Tab wraps; Escape and backdrop tap call `close()`; `body` gets `overflow:hidden`. Only one sheet at a time (opening another closes the first silently).

### 6.11 Toast
`app.toast(message, {kind:'info'|'ok'|'error', ms: 2600})` → appends `.toast` to `#toast-root`, `.is-in` next frame, removes after `ms`. Max 2 visible; oldest removed.

### 6.12 Copy
`app.copy(text, btn)`: `navigator.clipboard.writeText` in try/catch; fallback: temporary `<textarea>` + `select()` + `document.execCommand('copy')`; on success `btn` gets `.is-copied` and text "Copied" for 1500ms, else toast "Couldn't copy — the text is selectable".

### 6.13 WhatsApp builder
```js
app.wa.digits() → (app.settings().whatsapp || MBH.SITE.whatsapp).replace(/\D/g,'')
app.wa.link(text) → 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text)
app.wa.open(text) → window.open(link, '_blank', 'noopener')
app.wa.msg = {
  ask: () => `Hi Sandip, I'm planning a trek in Nepal and would like to ask about dates.`,
  askTrek: (trek) => `Hi Sandip, I'm interested in ${trek.name} (${trek.days} days). Could you tell me about upcoming dates?`,
  askDeparture: (trek, dep) => `Hi Sandip, I'm interested in the ${trek.name} departure starting ${fmt.long(dep.start)} (ref ${dep.id}). Is there space?`,
  waitlist: (trek, dep) => `Hi Sandip, the ${trek.name} departure on ${fmt.short(dep.start)} (ref ${dep.id}) shows full. Could you add me to the waitlist?`,
  request: (trek, dep, f) => [`Hi Sandip, I'd like to request a spot.`, `Trek: ${trek.name} (${trek.days} days)`, `Departure: ${fmt.short(dep.start)} to ${fmt.short(fmt.endDate(dep.start, dep.days))} (ref ${dep.id})`, `Group: ${f.pax}`, `Name: ${f.name}`, `Email: ${f.email}`, `WhatsApp: ${f.whatsapp}`, `Notes: ${f.note || '-'}`].join('\n'),
  changeBooking: (trek, item) => `Hi Sandip, about my confirmed booking ${item.id.toUpperCase()} for ${trek.name} on ${fmt.short(item.start)} — I'd like to ask about a change.`,
  adminChat: (item, trek, dep) => `Hi ${item.name}, this is Sandip from Magic Beyond Himalaya about your ${trek.name} request for ${fmt.short(dep ? dep.start : item.start)} (ref ${item.id.toUpperCase()}).`
}
```

### 6.14 Formatting
`app.fmt`: `parse(iso)` (local `new Date(y,m-1,d)`), `iso(date)`, `todayISO()`, `addDays(iso, n)`, `endDate(start, days) = addDays(start, days-1)`, `short(iso) → 'Thu 16 Oct'` (`en-GB` weekday short, day, month short), `long(iso) → '16 October 2026'`, `monthKey(iso) → '2026-10'`, `monthLabel(key) → 'October 2026'`, `daysBetween(a,b)`, `rel(ms) → 'just now' | '3 min ago' | '2 h ago' | '3 days ago'`, `money(n) → '$175'`, `num(n) → '2,860'`, `esc(str)` (HTML escape; **every** interpolated user/db string passes through it).

### 6.15 Exported surface
```js
window.MBH.app = { state, store, caps, get db(), get user(), theme, route, go, toast, sheet, wa, fmt, copy, storage,
  writeQueue, inFlight, snapData, snapExists, docsOf, mergeItems, newBookingId, slug,
  departures: { public, open, forTrek, byId }, settings, renderDepartureRow, inlineConfirm(btn, {question, yesLabel, onYes, danger}) }
```

---

## 7. admin.js contract

`admin.js` defines `MBH.mountAdmin(root, app) → {update(key), destroy()}`. It uses only `app.*` (never `window.claude`). No images are rendered on admin routes.

### 7.1 Gate
Render `.gate.gate--checking` immediately. Then `app.caps.userReady.then(...)` with a 6s timer:
- user resolved null (or timer fires with `status.user==='pending'`) → `.gate--unavailable`: "Identity isn't available in this view (for example a preview). Open the published artifact directly on claude.ai." + "Back to site" (`#home`).
- `await app.caps.canEdit()` false → `.gate--denied`: title "Sandip's desk.", body "This page checks who you are on claude.ai, not a password. Only the owner and editors of this artifact can open the desk — Sandip can add you as an editor from the share menu.", `.gate__who` "Signed in as {me.name || 'a guest'} · viewer" with avatar, "Back to site".
- true → `.gate--granted` for 600ms ("Signed in as {name} · editor") then mount the dashboard. Also, only now: `if (!adminSubscribed && app.caps.db) { adminSubscribed = true; app.caps.db.collection('bookings').onSnapshot(snap => { const raw = new Map(); const flat = []; app.docsOf(snap).forEach(d => { const items = Array.isArray(d.items) ? d.items : []; raw.set(d.id, items); items.forEach(it => flat.push({viewerId: d.id, ...it})); }); app.store.set('adminBookingsRaw', raw); app.store.set('adminBookings', flat); replayOutbox(); }, () => app.store.set('adminBookings', [])); }` (module-level flag; survives re-mounts). If `status.db !== 'ready'` the dashboard renders with `.syncpill--off` and all write buttons disabled with help text "Database unavailable in this view".

### 7.2 Shell
`.topbar` gets `.topbar--admin`; `.admin__band` with title, `.syncpill`, "Back to site". `.admin-tabs`: Inbox (badge = count of `requested` items) · Departures · Bookings · Settings → `#admin`, `#admin-departures`, `#admin-bookings`, `#admin-settings`. SyncPill: `saving` when any `app.inFlight` path, `waiting` when outbox non-empty, `live` once both admin snapshots have fired, `off` when db null.

Derived helpers (pure, from store): `confirmedPaxFor(depId, excludeItemId)` = Σ over `adminBookings` with `departureId===depId && status==='confirmed'` of `(confirmedPax ?? pax)`; `bookedFor(dep)` = `(dep.manualPax||0) + confirmedPaxFor(dep.id)`; `computedSpots(dep)` = `max(0, dep.capacity - bookedFor(dep))`; `drift(dep)` = `dep.spotsLeft !== computedSpots(dep)`; `requestedFor(depId)`; `nonCancelledCount(depId)`.

### 7.3 Inbox (`#admin`)
Section "Needs a reply": items with `status==='requested'` sorted by the departure's `start` asc (unknown departure last), then `createdAt` asc. Insert `.admin__group` header "{trek} · Thu 16 Oct" whenever ≥2 consecutive items share a `departureId`. Row (`.arow`): title "{name} · {pax} {pax===1?'person':'people'}", meta "{trek} · {Thu 16 Oct} · requested {rel}", contact (`.copyfield` whatsapp, `.copyfield` email, WhatsApp `Chat` button with `app.wa.msg.adminChat`), note, `.arow__caption` "claude.ai: {profile name}" (resolved via `app.caps.profiles`, shown only when it differs from the typed name), consequence line: with `avail = computedSpots(dep)`: `pax <= avail` → "{booked} of {capacity} booked · confirming leaves {avail - pax}" else `.arow__line--warn` "Would overbook by {pax - avail}"; departure missing → "Departure no longer exists — cancel only". Actions: `Confirm` (`.btn--primary.btn--sm`), `Decline` (`.btn--danger.btn--sm`, InlineConfirm "Decline this request?"), `Chat`. Expand toggle "Other requests by this booker (n)". Empty: `.empty` "Nothing needs you." + "Next departure: {trek} {Thu 16 Oct}" or "No upcoming departures". If `adminBookings === null` and db ready → `.skel--row`×3 (≤4s) then `.empty` "No requests visible" (note: access rules may hide them).
Section "Departing within 14 days": departures with `start` in `[today, today+14]` and (`requestedFor(id) > 0` or `bookedFor(dep)===0`) → row with meta and "Open" → `#admin-departure-{id}`.
Section "Counter drift": departures where `drift(dep)` → `.arow--drift` "stored {spotsLeft} · computed {computed}" + `Recount` button → `syncDeparture(dep.id)`.

### 7.4 Departures (`#admin-departures`)
Groups "Upcoming" (`start >= today`, asc) and "Past" (desc, `.arow--past`). Row: title "{trek} · {Thu 16 Oct}", meta "{days} days · ${price} pp · {booked}/{capacity} booked · {requested} requested", `.arow__bar` fill booked/capacity, status `.pill--open|--full|--closed`, drift badge when drifted. Actions: `Open` → `#admin-departure-{id}`, `Edit`, `Close`/`Reopen`, `Duplicate`, `Recount`, `Delete` (enabled only when `nonCancelledCount(id)===0`, InlineConfirm "Delete {trek} {date}?"; otherwise title "Has bookings — close it instead"). Floating `+ New departure` (`.btn--primary`, fixed above the admin tabs on phone, inline ≥1024).

**DepartureForm** (sheet, `.dep-form`), modes new / edit / duplicate:
- TrekPicker (`.trekpick`, required) → sets `days = trek.days` and, when price untouched, `price = (MBH.tierFor(trek, capacity) || {price: trek.fromPrice}).price`.
- `start` (`.input--date`, required, `min = today`; **read-only in edit mode** with help "Dates are fixed once created — Duplicate to move a departure").
- `days` (number, prefilled, editable), `capacity` (stepper 1–20, default 8), `manualPax` (stepper 0–capacity, label "Already booked by WhatsApp", help "People Sandip confirmed outside this site"), `price` (number, required, help "Per person, fixed for this group"), `note` (textarea, optional), `status` radios open/closed (new defaults open; full is never chosen manually — it is computed).
- `.dep-form__preview`: "Ends {Thu 20 Oct} · id {trekId}-{YYYYMMDD}[-2]" live.
- Guards: `capacity >= manualPax + confirmedPaxFor(id)` else `.field__error` "Capacity can't go below the {n} people already confirmed"; `price > 0`; `days >= 1`.
- Save (new/duplicate): `id = app.slug(trekId + '-' + start.replace(/-/g,''))`, append `-2`, `-3`… while `store.departures.some(d => d.id === id)`; `spotsLeft = max(0, capacity - manualPax)`; `await app.writeQueue('departures/'+id, () => app.caps.db.doc('departures/'+id).set({ trekId, start, days, capacity, manualPax, spotsLeft, price, status, note, createdAt: now, updatedAt: now }))`. Duplicate prefills from the source with `start = addDays(source.start, 7)`, `manualPax = 0`, note copied.
- Save (edit): `update({ days, capacity, manualPax, price, note, status: status==='closed' ? 'closed' : (computed===0 ? 'full' : 'open'), spotsLeft: computed, updatedAt: now })` where `computed = max(0, capacity - manualPax - confirmedPaxFor(id))`.
- The form stores `loadedUpdatedAt`; if a store update brings `dep.updatedAt > loadedUpdatedAt`, show `.banner--warn` "Edited {rel} on another device" + `Reload` (re-fills the form) — never silently overwrite.
- Close: `update({status:'closed', updatedAt})`. Reopen: `update({status: computed===0 ? 'full':'open', spotsLeft: computed, updatedAt})`. Delete: `db.doc('departures/'+id).delete()`.
- Success → toast "Saved" and `sheet.close()`; failure → `.banner--danger` inside the sheet "Couldn't save. Nothing changed." (form stays filled).

### 7.5 Departure detail (`#admin-departure-{id}`)
Head (title, dates, price, status, capacity summary "{booked} of {capacity} booked · {manualPax} by WhatsApp · {spotsLeft} left" + drift notice with Recount). Actions: Edit, Close/Reopen, Duplicate, `Copy WhatsApp invite` (clipboard text: `${trek.name} — group departure ${fmt.long(start)} to ${fmt.long(end)}\n${days} days · $${price} per person · ${spotsLeft} of ${capacity} spots left\nDetails and request: ${location.href.split('#')[0]}#departure-${id}`), `Copy trip sheet` (text: trek, dates, "Party:" confirmed items as "{name} × {pax} · {whatsapp}" plus "{manualPax} confirmed by WhatsApp", then "Day plan:" each `days_data` line "Day {d} · {Thu 16 Oct} · {route} · {alt} m"). Party list: `.arow`s for this departure's items grouped Confirmed / Requested / Cancelled with the same actions as §7.6. Missing departure → `.empty` "This departure no longer exists" + list of its orphaned bookings (by `departureId`) with Cancel only.

### 7.6 Bookings (`#admin-bookings`) and the write sequences
Flat list of all items, filters: chips `Requested` (default) / `Confirmed` / `Cancelled` / `All`; `<select>` by departure; name search (`.input`, client-side `includes`). Rows as in the Inbox plus `Restore` on cancelled items. A `confirmed` item with no `confirmedPax` gets `.arow__badge-verify`.

All writes go through `app.writeQueue(path, fn)`; a row whose booking path or departure path is in flight has its buttons disabled and `.is-pending`. `now = Date.now()`.

**Confirm(item)** — only from `requested` (or `cancelled` via Restore→Confirm two steps; never directly):
1. `depSnap = await db.doc('departures/'+item.departureId).get()`; `dep = snapData(depSnap)`; if `!dep` → `.arow__error` "Departure no longer exists — the request can only be cancelled"; stop.
2. `avail = max(0, dep.capacity - (dep.manualPax||0) - confirmedPaxFor(dep.id, item.id))`. If `item.pax > avail` and the row is not in `overbookAck` state → render `.inline-confirm` "Only {avail} left, this needs {item.pax}. Confirm anyway (overbook)? / Not now"; stop until Yes sets `overbookAck` and re-enters.
3. Row → `.is-pending` label "Confirming…". `bpath = 'bookings/'+item.viewerId`; inside `writeQueue(bpath)`: `bs = await db.doc(bpath).get()`; `items = (snapData(bs)||{}).items || []`; find `i` by `item.id` (missing → error "Booking not found — refresh"); if `items[i].status !== 'requested' && items[i].status !== 'cancelled'` → error "Already {status}"; `items[i] = {...items[i], status:'confirmed', confirmedPax: items[i].pax, updatedAt: now}`; `await db.doc(bpath).update({items})`. Optimistically patch `store.adminBookingsRaw/adminBookings` for that viewer.
4. `await syncDeparture(dep.id)` (§7.7). If it throws → push `{type:'syncDeparture', departureId: dep.id, at: now}` to `mbh.outbox`, show `.arow__notice` "Spots were reserved but the counter didn't update for {trek} {date} — Recount" (Retry re-runs only syncDeparture), SyncPill → `waiting`.
5. Row stays `.is-pending` until the next `adminBookings` snapshot shows the item `confirmed` (then `.is-echoed` flash); if step 3 throws → row reverts, `.arow__error` "Didn't send — tap to retry".

**Decline / Cancel(item)**:
- From `requested`: step 3 pattern with `status:'cancelled', updatedAt: now`; **no departure write**.
- From `confirmed`: step 3 with `status:'cancelled', updatedAt: now` (keep `confirmedPax` for history; Σ counts only status `confirmed`), then `syncDeparture(dep.id)` with the same outbox fallback.

**Restore(item)** (from `cancelled`): step 3 with `status:'requested', updatedAt: now`; no departure write. Restoring never bypasses the capacity check because it never sets `confirmed`.

### 7.7 syncDeparture(depId) — idempotent, the only writer of spotsLeft
```
depSnap = await db.doc('departures/'+depId).get(); dep = snapData(depSnap); if (!dep) return;
booked = (dep.manualPax||0) + confirmedPaxFor(depId)        // from the (optimistically patched) store
spotsLeft = max(0, dep.capacity - booked)
status = dep.status === 'closed' ? 'closed' : (spotsLeft === 0 ? 'full' : 'open')
if (dep.spotsLeft === spotsLeft && dep.status === status) return;   // nothing to write
await writeQueue('departures/'+depId, () => db.doc('departures/'+depId).update({ spotsLeft, status, updatedAt: Date.now() }))
```
Exposed as `Recount` everywhere. `replayOutbox()` runs after each admin snapshot: for each queued entry call `syncDeparture`; remove on success; keep on failure (max 20 entries).

### 7.8 Settings (`#admin-settings`)
Form fields `whatsapp` (digits, help "Country code without +, e.g. 9779851353347"), `email`, `heroNote` (textarea, 140 max, help "One line shown on the home page. Leave empty to hide."), preset button "I'm guiding {trek} until {date}, replies may be slow" enabled when an open/full departure includes today (`start <= today <= end`), which also sets `heroNoteUntil = end`. `.settings-form__meta` "Note set {rel}" from `heroNoteSetAt`; `.banner--warn` "This note has been up past {heroNoteUntil}. Clear it?" + `Clear` when `heroNoteUntil && today > heroNoteUntil && heroNote`. Save: `db.doc('settings/site').set({ whatsapp, email, heroNote, heroNoteSetAt: heroNote ? (changed ? now : prev) : null, heroNoteUntil: heroNote ? (heroNoteUntil||null) : null, updatedAt: now })` (set works whether or not the doc exists). "Publish check" `.kv` panel: "Prices, itineraries, photos, FAQ — static in data.js. Edit in source and ask Claude to republish."

### 7.9 Last-writer-wins note
There are no transactions. Every write first re-reads its own document and merges by item id, so two writers touching different items on one bookings doc do not clobber each other unless their read→write windows overlap (seconds). Two admin devices confirming the last spot within that window will both pass the check; the result is an overbook surfaced by the drift section and the consequence line, never hidden. `spotsLeft` is always recoverable with Recount because it is derived, never trusted. Bookers can only move their own item from `requested` to `cancelled` after a fresh read, so they cannot regress an admin decision.

---

## 8. index.html contract

No `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`. Exactly this order:

```html
<title>Magic Beyond Himalaya</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<link rel="stylesheet" href="styles.css">
<script>(function(){try{var t=JSON.parse(localStorage.getItem('mbh.theme'));if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();</script>

<header id="topbar" class="topbar" role="banner"></header>
<main id="app" class="app">
  <section class="view boot" aria-busy="true">
    <div class="container">
      <p class="topbar__wordmark" style="margin:24px 0 8px">Magic Beyond Himalaya</p>
      <div class="skel skel--text"></div>
      <div class="skel skel--row" style="margin-top:16px"></div>
      <div class="skel skel--row"></div>
    </div>
  </section>
</main>
<nav id="tabbar" class="tabbar" aria-label="Primary"></nav>
<div id="ctabar" class="ctabar" hidden></div>
<div id="sheet-root" class="sheet-root" hidden></div>
<div id="toast-root" class="toast-root" aria-live="polite"></div>
<noscript><div class="banner banner--info container">This page needs JavaScript. Reach Sandip on WhatsApp +977 9851353347 or magicbeyondhimalaya@gmail.com.</div></noscript>

<script src="data.js"></script>
<script src="maps.js"></script>
<script src="app.js"></script>
<script src="admin.js"></script>
```
Rules: relative paths only, no leading slash; no other external hosts; every image `loading="lazy" width="…" height="…"`. The `.boot` section is replaced by the first route render. Admin tabs render into `#tabbar` (replacing its children) on admin routes.

---

## 9. Seed data (written with ArtifactData after publish; `set` each to `departures/{id}`, batch)

```json
[
 {"id":"poon-hill-20261010","trekId":"poon-hill","start":"2026-10-10","days":4,"capacity":8,"manualPax":3,"spotsLeft":5,"price":165,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"mardi-himal-20261016","trekId":"mardi-himal","start":"2026-10-16","days":5,"capacity":8,"manualPax":6,"spotsLeft":2,"price":175,"status":"open","note":"Group meets in Pokhara the evening before the start.","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"abc-poon-20261024","trekId":"abc-poon","start":"2026-10-24","days":8,"capacity":8,"manualPax":2,"spotsLeft":6,"price":185,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"annapurna-tilicho-20261101","trekId":"annapurna-tilicho","start":"2026-11-01","days":11,"capacity":6,"manualPax":6,"spotsLeft":0,"price":250,"status":"full","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"ebc-gokyo-20261105","trekId":"ebc-gokyo","start":"2026-11-05","days":15,"capacity":6,"manualPax":2,"spotsLeft":4,"price":600,"status":"open","note":"Group meets in Kathmandu the evening before the start.","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"manaslu-circuit-20261114","trekId":"manaslu-circuit","start":"2026-11-14","days":12,"capacity":6,"manualPax":0,"spotsLeft":6,"price":420,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"langtang-20261128","trekId":"langtang","start":"2026-11-28","days":7,"capacity":8,"manualPax":1,"spotsLeft":7,"price":175,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"manaslu-tsum-20270306","trekId":"manaslu-tsum","start":"2027-03-06","days":18,"capacity":6,"manualPax":0,"spotsLeft":6,"price":450,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"mardi-himal-20270320","trekId":"mardi-himal","start":"2027-03-20","days":5,"capacity":8,"manualPax":0,"spotsLeft":8,"price":175,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000},
 {"id":"poon-hill-20270403","trekId":"poon-hill","start":"2027-04-03","days":4,"capacity":8,"manualPax":1,"spotsLeft":7,"price":165,"status":"open","note":"","createdAt":1790467200000,"updatedAt":1790467200000}
]
```
Prices are each trek's 8-pax tier (EBC: 7+ tier); `spotsLeft = capacity − manualPax` so the seed shows zero counter drift. Notes are operational placeholders Sandip can edit or clear.

`settings/site`:
```json
{"whatsapp":"9779851353347","email":"magicbeyondhimalaya@gmail.com","heroNote":"","heroNoteSetAt":null,"heroNoteUntil":null,"updatedAt":1790467200000}
```

---

## 10. Acceptance checklist

**Shell / theme (390 and 1440)**
- [ ] No horizontal scroll at 390px on any route; 16px gutters; `.topbar` sticky with `top:env(safe-area-inset-top,0px)`; `.tabbar`/`.ctabar`/`.admin-tabs` padding includes `env(safe-area-inset-bottom,0px)`; body bottom padding prevents content hiding behind the bar.
- [ ] Light palette on bare `:root`; dark under both guards with `color-scheme:dark`; `body{background:var(--bg)}`; theme toggle cycles system→light→dark, persists, applies before first paint.
- [ ] Fonts fail gracefully (block Google Fonts: layout unchanged with Georgia/system-ui).
- [ ] At 1440: no bottom bar; TopBar nav links; trek page two-column (sticky map left); agenda list + departure detail side by side is NOT required — agenda is a single 680px column, departure pages are their own route.
- [ ] Route change sets `document.title`, scrolls to top, focuses `.view__title`; unknown hash → `#home`; `#book-x` → back button returns to `#departure-x`.

**Public with db and user null (mock `claude.use` → null)**
- [ ] Every route renders fully within one frame of boot, before any capability resolves.
- [ ] `#home`, `#agenda`, `#trek-*`: skeleton rows disappear ≤4s and show the "Dates are set by Sandip and posted here…" empty state with a working `wa.me/9779851353347?text=` link; no spinner remains; no sample/placeholder dates ever appear.
- [ ] `#departure-x` shows "This date is no longer listed" (unless cached), with Ask button.
- [ ] `#book-x` form is usable; button reads "Send request on WhatsApp"; submitting opens wa.me with the fully serialised request; no field is disabled; draft survives reload.
- [ ] `#my-trips` shows the signed-out explanation, no error.
- [ ] `#admin` shows `.gate--unavailable` (never a blank or partial dashboard).

**Public with db, viewer with id and `can('data.write')===true`**
- [ ] Home shows ≤4 open departures as vertical rows with "Thu 16 Oct", days, "5 of 8 spots left", "$165 pp"; "See all dates" → `#agenda`. `heroNote` appears when set, fallback line otherwise.
- [ ] Agenda: month headers sticky; MonthStrip dots only on months with departures; tapping a chip scrolls to that month; trek chips filter; FitMyDates dims non-fitting rows and annotates spare days; `full` rows greyed with "Full"; `closed` rows never rendered; past starts never rendered.
- [ ] Departure page: DateStrip lists every day with its real date; static map markers read "D4 · 16 Oct"; capacity dots match `spotsLeft`; price shows "fixed for this group departure"; full → "Join waitlist on WhatsApp".
- [ ] Booking: pax > spotsLeft shows the amber note and still submits; label "Request a spot"; successful write appends to `bookings/{me.id}` (`set` on first, `update` after), ConfirmationCard shows ref + WhatsApp mirror; simulated write failure shows the fallback card with the WhatsApp button; label flip while user resolves is quiet and loses no input.
- [ ] `#my-trips` lists own items live; Withdraw uses InlineConfirm (no `confirm()`), sets `cancelled` only from `requested`; confirmed items show the message-Sandip path.
- [ ] Cache: after one live snapshot, reload with db → null renders cached rows with `.note--stale` and a relative "cached … ago" time.
- [ ] Trek page: ProfileHero silhouette differs across all eight treks; DayList row tap highlights the map marker and profile dot; marker tap opens and scrolls the row; Manaslu Circuit rows show no hours cell; rest days show "rest"; PriceTiers stepper 1–12 highlights the right tier for every trek (Poon Hill pax 3 → $225; EBC pax 5 → $650); Included/Not/Add-ons all present; "Departures for this trek" filtered correctly.
- [ ] Map: straight segments only; scale bar and N present; legend "Sketch map, not for navigation"; passes/peaks as triangles with heights; rest days merged with ×2 ring; Langtang/EBC repeated places offset, not overlapping; labels never overlap at 390px (omitted rather than colliding); draw-in runs once, none under reduced motion; navigating away then back leaks no listeners (`destroy()` called).
- [ ] Copy buttons for phone and email work (clipboard or fallback) and show "Copied" for 1.5s; no `mailto:`/`tel:` anywhere; all WhatsApp links `target=_blank rel=noopener`.
- [ ] No text promises a response time; primary actions all read "Request a spot"; no reviews, no invented itinerary facts; shared photos have generic alt text.

**Admin (viewer with `canEdit()===true`)**
- [ ] Gate passes through `.gate--checking` → `.gate--granted` → dashboard; view-only viewer sees `.gate--denied` with their name; no password field exists.
- [ ] Bookings subscription starts only after canEdit is true; Inbox badge equals requested count; Inbox sorted by departure start ascending with departure headers when ≥2 share; consequence lines correct including "Would overbook by n"; empty state "Nothing needs you." / "No requests visible".
- [ ] Confirm writes the booking item first (`status:'confirmed', confirmedPax, updatedAt`), then `departures/{id}` `{spotsLeft, status, updatedAt}`; spots reach 0 → status `full`; row shows "Confirming…" until the snapshot echoes; forced failure of the second write shows the Recount notice and queues the outbox; Recount repairs and clears it.
- [ ] Decline from requested writes only the booking doc; cancel from confirmed restores spots and flips `full` → `open`; Restore sets `requested`, never `confirmed`; buttons disabled while any write on the row's docs is in flight.
- [ ] New departure: id preview `mardi-himal-20261016`, collision → `-2`; saved with `spotsLeft = capacity − manualPax`, `status:'open'`; price prefilled from the capacity tier; edit mode has read-only start; capacity below confirmed+manual is refused inline; Duplicate prefills start +7 days; Delete disabled when non-cancelled bookings exist; Close hides it publicly; "Edited elsewhere — Reload" banner appears when another writer bumps `updatedAt`.
- [ ] Departure detail: party list, Copy WhatsApp invite and Copy trip sheet produce the specified text via clipboard/fallback (no `window.print`).
- [ ] Settings save creates `settings/site` when missing; heroNote preset fills the guiding-until text and shows on `#home` within one snapshot; past-`heroNoteUntil` nudge appears.
- [ ] Admin at 390px: rows stack, action buttons full width, editor is a sheet, admin tabs in the bottom slot; at 1440 tabs under the band; no images load on any admin route.
- [ ] All storage access survives a throwing `localStorage` (private mode): page renders and works with theme/cache/outbox/drafts disabled.
