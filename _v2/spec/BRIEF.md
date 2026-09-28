# Magic Beyond Himalaya — V2 brief and hard constraints

## Who and what

Magic Beyond Himalaya is a small guided-trekking company in Nepal run by Sandip Sodari, a local guide. Eight treks (Poon Hill 4d, Mardi Himal 5d, Langtang 7d, Annapurna Base Camp 8d, Annapurna Circuit + Tilicho 11d, Manaslu Circuit 12d, Everest Base Camp + Gokyo 15d, Manaslu + Tsum Valley 18d), priced $150–$900 per person by group size. Clients are backpackers and mid-budget adventurers, mostly browsing on a phone from abroad. Tagline: "Every step tells a story." Contact: WhatsApp +977 9851353347, magicbeyondhimalaya@gmail.com.

V1 is a live single-page static site (magicbeyondhimalaya.com). V2 is a richer prototype published as a claude.ai Artifact, with:

1. **Agenda / departures** — a calendar of scheduled departures (trek + start date + capacity) people can browse and sign up for.
2. **Booking** — sign up for a departure (name, email, WhatsApp number, group size, notes). Saved to the artifact's shared database when the viewer may write; always also offer the WhatsApp fallback with a prefilled message.
3. **Admin side** — create/edit/close departures, see bookings, confirm or cancel them, track spots left. Reached at `#admin`, behind a login gate.
4. **Login for admin** — identity-based: the artifact's `user` capability reports whether the viewer is an editor/owner. Not a password. The gate screen explains this.
5. **Interactive route maps** — per trek, drawn from real waypoint coordinates: route line, day markers, elevation profile, tap/hover a day to see it. NO map tiles (blocked by CSP).
6. **Mobile-first, both public and admin.** Desktop is a wider layout of the same components.
7. **Super stylish** but on-brand and honest. Both light and dark themes.

## Existing design system (respect it; extend it)

Tokens (V1): deep green #1f3d3a / #14302d, amber accent #c8842b (light amber #efc079 for dark surfaces), cream #faf6ef / #f3ece0, ink #1a1714, line #d9cfbe. Fonts: DM Serif Display (headings), DM Sans (body), both from Google Fonts. Tone: warm, personal, guide-led. Not luxury, not corporate.

V1 data (treks, itineraries, pricing tables, included/not-included, add-ons, FAQ) is in `spec/v1-data-extract.js`. Port it faithfully. Do not invent itinerary facts, prices or reviews.

## Hard technical constraints (artifact runtime)

- Published as a multi-file artifact: `index.html` + supporting `.css/.js` + `images/`. Relative paths only, no leading slash. Everything else must be inline. External scripts only from cdnjs/jsdelivr (pinned UMD); external CSS only Google Fonts. No other hosts: no tiles, no iframes, no fetch to other sites.
- `index.html` must NOT contain `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` — the platform wraps it. Put `<title>` and `<link>`/`<style>` at the very top.
- Hash routing only with bare tokens: `#treks`, `#trek-mardi-himal`, `#agenda`, `#admin`, `#about`. Never `#key=value`.
- `alert/confirm/prompt` do nothing. Build confirmations into the page. `window.print` does nothing. `mailto:`/`tel:` unreliable: show numbers as text with copy buttons; WhatsApp `https://wa.me/...` links are fine (open new tab).
- Theme: complete light palette on bare `:root`; dark under `@media (prefers-color-scheme: dark)` guarded `:root:not([data-theme="light"])` AND `:root[data-theme="dark"]`, both with `color-scheme: dark`. `body` sets an explicit token background.
- Page must work at 390px with ≥16px side gutters and no horizontal scroll. Sticky header uses `top: env(safe-area-inset-top, 0px)`; a fixed bottom bar adds `env(safe-area-inset-bottom, 0px)` to its padding.
- Capabilities: `window.claude.use("db")` and `window.claude.use("user")` resolve LATER (never synchronously) and may resolve `null`. Render the whole page without them; light up features when they resolve. Never read `window.claude.db` directly.
- `db` API (Firestore-like): `db.doc("departures/x")`, `db.collection("departures")`, `.get()`, `.set(obj)`, `.update(obj)` (doc must exist), `.delete()`, `.add(obj)`, `.where(f,op,v)`, `.orderBy(f,dir)`, `.limit(n)`, `.onSnapshot(next, error)`. Subscribe once, never in render. One write at a time per doc. Doc bodies are plain objects ≤256KiB. Reads of documents the viewer may not see return `exists:false` / are omitted from queries — never an error.
- `user` API: `await user.isOwner()`, `await user.canEdit()` (admin level), `await user.can("data.write")` (true/false/null), `await user.me()` → `{id, name, avatarUrl, color, isOwner, canEdit}`; `await user.profiles(ids)` → map id→`{name, avatarUrl}`. Store only ids, resolve names at render.
- Data model and access rules (fixed at publish):
  - `departures/{id}`: `{trekId, start:"YYYY-MM-DD", days, capacity, spotsLeft, price (per person, may override trek), status:"open"|"full"|"closed", note, createdAt}` — read `view`, write `admin`.
  - `bookings/{viewerId}`: ONE document per viewer: `{items:[{id, departureId, trekId, name, email, whatsapp, pax, note, status:"requested"|"confirmed"|"cancelled", createdAt, updatedAt}]}` — prefix rule `bookings` read+write `admin`; `bookings/{self}` write `interact`. Admin lists the `bookings` collection to see everyone's; a booker sees only their own document. A viewer with no id (or below interact) cannot save: show the WhatsApp path instead, never a broken form.
  - `settings/site`: `{whatsapp, email, heroNote}` — read `view`, write `admin`.
- Admin confirms a booking → updates that viewer's bookings doc item status AND decrements `spotsLeft` on the departure (sets status `full` at 0). Cancel restores. Admin only.
- Local testing uses a `window.claude` mock injected by the test harness (in-memory store, configurable viewer). The published page never ships the mock.

## Deliverable shape (files)

```
v2/
  index.html      shell, <title>, fonts link, <link rel=stylesheet href="styles.css">, app markup roots, <script src> tags in order: data.js, maps.js, app.js, admin.js
  styles.css      tokens, both themes, components
  data.js         window.MBH = { TREKS, INCLUDED, NOT_INCLUDED, ADDONS, FAQS, ROUTES, SITE }
  maps.js         window.MBH.RouteMap(container, trek, opts) → {highlightDay(n), destroy()}
  app.js          public app: router, views, booking, capability wiring
  admin.js        admin gate + dashboard, mounted by app.js when route is #admin
  images/*.jpeg   existing photos (sunrise-peak, manaslu-village, forest-ridge, prayer-flags, trail-village, summit-pose, sandip)
```
