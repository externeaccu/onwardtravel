# V2 draft spec (author's first cut — to be challenged)

## Information architecture

Public (hash routes):
- `#home` — hero (photo, tagline), "next departures" strip (3 soonest open), trek grid teaser, about Sandip, reviews, FAQ, contact.
- `#treks` — full grid with the V1 difficulty/length filter (fixed: a trek matches every band its label spans).
- `#trek-<id>` — trek page: hero photo, stats row (days, max alt, difficulty, from-price), **RouteMap** (SVG map + elevation profile, tap a day), day-by-day (synced with map), pricing table + add-ons, included/not, **departures for this trek** with "Reserve a spot", "Ask about other dates" (WhatsApp).
- `#agenda` — month calendar (departure dots on days) + list below; filter chips by trek; tap → departure sheet → booking form.
- `#about`, `#contact` — as V1 content.
- Bottom tab bar on mobile: Home · Treks · Agenda · Contact. Desktop: top nav.

Admin (`#admin`):
- Gate: if `user.canEdit()` → dashboard; else gate screen: "This area is for Magic Beyond Himalaya staff. Sign in to claude.ai with an editor account, then reopen." + "Check again" button. Never a password.
- Dashboard tabs: **Departures** (list, add, edit, close; capacity/spots; per-trek), **Bookings** (inbox: newest first, status chips, confirm/cancel, spots update automatically, copy WhatsApp number), **Settings** (WhatsApp, email, hero note).
- Mobile: single column, sticky segmented tabs, forms as bottom sheets.

## Booking flow

1. From a departure (trek page or agenda) → sheet with departure summary (trek, dates, spots left, price/person).
2. Form: name, email, WhatsApp number (with country code), pax (1–12 stepper), note. Validation inline.
3. If db writable & user id present → write to `bookings/{id}` (append to items) → success state "Request sent — Sandip confirms within 24h" + WhatsApp button with prefilled summary.
4. If not writable → same form, but submit builds a WhatsApp message and opens `wa.me` link; success copy says "Opens WhatsApp with your request".
5. Local draft in localStorage (try/catch).

## Map component (maps.js)

- Input: trek.route = [{day, name, lat, lng, elev}] (waypoint per overnight + notable pass/peak).
- SVG: equirectangular projection with lat-cos correction, padded viewBox, route as smooth path (catmull-rom), day markers with numbers, pass/peak markers, start/end flags, faint contour rings (procedural, deterministic from index — no randomness) + compass + scale bar (km computed from haversine). Elevation profile below: area chart, day ticks, max-altitude label. Hover/tap marker ↔ highlights itinerary day; `highlightDay(n)` API. Animate route draw on first view (respect reduced motion).
- Theme-aware via CSS variables (currentColor + tokens).

## Visual direction

Keep the brand system, raise the craft: topographic contour motif (SVG pattern) in hero and section backgrounds; big DM Serif Display headings with `text-wrap: balance`; amber only as accent; cards with photo + elevation sparkline; status chips (open / few left / full / closed); generous whitespace; micro-motion on route draw and sheet slide. Dark theme: deep green-black surfaces, cream text, amber-300 accents.

## Open questions for the panel

- Is a month calendar right on mobile, or a scrolling list grouped by month with a compact month strip?
- How should "spots left" degrade when viewer can't read bookings (public) — show only departure.spotsLeft (admin-maintained). Fine?
- Should admin bookings inbox group by departure or be flat newest-first?
- What's the single boldest design move that makes this feel like this company and not a template?
