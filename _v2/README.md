# Magic Beyond Himalaya, version 2

The second version of the site, built as a claude.ai artifact with a live database.
GitHub Pages does not serve this folder: Jekyll skips folders whose names start with `_`.
The live site at magicbeyondhimalaya.com is still the version-1 `index.html` in the repo root.

Published artifact: https://claude.ai/artifact/SB5ejRpHT7tm13YFKpnUuT

## What it does

- **Treks.** Eight treks with the version-1 prices, itineraries and photos. Each trek page has an elevation profile, an interactive route map linked to the day-by-day list, a group-size price calculator, and what's included.
- **Home map.** The home page opens with all eight routes drawn across Nepal. Hover or focus a route to see its name, length and price, and tap it to open the trek.
- **Dates.** An agenda of group departures by month, with a "fit my dates" filter and a spots-left count on each date.
- **Request a spot.** A signed-in contributor sends a request that is saved to the database. Everyone else gets a WhatsApp message with the full request filled in. "My trips" shows a visitor's own requests and lets them withdraw one.
- **Sandip's desk.** This is the admin area at `#admin`, open to people with Editor access to the artifact. It has an inbox of requests with Confirm and Decline, departure management (new, edit, close, duplicate, delete), a bookings list, and site settings, including a one-line note on the home page.

There is no password screen. The artifact runs inside claude.ai, so the desk uses the viewer's claude.ai sign-in and share level. A page cannot keep a password secret.

## Files

| Path | What it is |
|---|---|
| `index.html` | Page shell. It has no doctype, html, head or body tags, because the artifact publisher wraps the page. |
| `styles.css` | Design tokens for light and dark themes, plus every component. |
| `data.js` | Treks, route waypoints and site copy, ported from version 1. |
| `maps.js` | Route maps, elevation profiles and sparklines, drawn in SVG. |
| `overview.js` | The home-page map of all eight routes. |
| `app.js` | Public routes, the booking sheet and "My trips". |
| `admin.js` | Sandip's desk. |
| `images` | A symlink to the repo's `images/`. The photos are the same files. |
| `spec/` | The brief, the final spec with its addendum, and the review workflow. |
| `test/` | A Playwright harness with a `window.claude` mock that enforces the access rules. It also holds the scenarios, the route matrix and the hostile-string checks. |
| `seed/production-seed.json` | The example departures and site settings written after publishing. |

## Database

| Path | Who reads | Who writes |
|---|---|---|
| root | everyone | contributors |
| `departures/{id}` | everyone | editors |
| `settings/site` | everyone | editors |
| `bookings/*` | editors | editors |
| `bookings/{own id}` | that contributor | that contributor |

Confirmed places are counted from `departures/{id}.ledger`, which only editors can write. They are never counted from a booker's own document, so a booker cannot mark themselves as confirmed.

The ten departures in the seed are examples. Each one carries the note "Example date for this preview". Sandip replaces them from the desk.

## Testing

```
cd _v2
npm install playwright-core@1.63.0
node test/check-data.mjs
node test/matrix.mjs --widths 390,1440
node test/hostile-strings.mjs
bash test/suite.sh "$PWD"
node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/admin.mjs
```

The harness launches Chromium from `/opt/pw-browsers/chromium`. Change `executablePath` in `test/harness.mjs` if your Chromium is elsewhere.

Two scenarios are tied to one width by design. `admin-layout.mjs` checks the desktop layout at 1440, and `admin-inbox.mjs` checks the phone tabs at 390.

## Republishing

Publish `index.html` with these supporting files: `styles.css`, `data.js`, `maps.js`, `overview.js`, `app.js`, `admin.js`, and `images/*`. Publish to the same artifact URL so the link and database stay the same. Never publish `test/` or `spec/`.
