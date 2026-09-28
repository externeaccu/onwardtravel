# Addendum to FINAL-SPEC.md — overrides from the lead (these win over FINAL-SPEC where they conflict)

1. **Reviews come back, quietly.** FINAL-SPEC §1.1 says "no reviews, no stars". Override: keep the three real reviews, text only, no stars, no icons.
   - `MBH.SITE.reviews = [ {quote, name, meta} × 3 ]` in data.js, verbatim from V1 (`spec/v1-data-extract.js` does not contain them; use these exact strings):
     1. quote: "Sandip was great as a guide. Unfortunately the weather wasn't always on our side but I think Sandip constantly adapted and made safe decisions so we could continue to enjoy the trip. He was flexible with itinerary, and his knowledge of the area was fabulous." — name: "Nat" — meta: "Annapurna Circuit + ABC · Dec 2019 · Tripadvisor"
     2. quote: "The trekking itself was wonderful. Sandip is a young, fun guide who does his work very well. I hope to do another trekking with Sandip in the future." — name: "Frank" — meta: "Kano, Nigeria · Annapurna Base Camp · Sep 2019 · Tripadvisor"
     3. quote: "Sandip was the guide for our group and Kumar and Binod were our porters. The three young men were good natured, helpful, knowledgeable and genuinely kind. We now consider them friends." — name: "Rebecca F." — meta: "St. George, Utah · Ghorepani Poon Hill · May 2018 · Tripadvisor"
   - `MBH.SITE.reviewsLede = "Reviews left on Tripadvisor by travellers Sandip guided during his years with Himalaya Hub Adventure, before he founded Magic Beyond Himalaya."`
   - CSS contract additions: `.quotes` (ruled list) · `.quote` (blockquote, padding `--s-4` 0) · `.quote__text` (display font italic, `--fs-md`, `--lh-loose`) · `.quote__who` (13px `--text-2`, `.tnum`; "Nat · Annapurna Circuit + ABC · Dec 2019 · Tripadvisor") · `.quotes__lede` (13px `--text-2`, before the list).
   - Placement: `#about` gets a section "What trekkers say" (eyebrow) with `.quotes__lede` + all three, between the guide paragraph and the Included/Not columns. `#home` gets one section "From the trail" with the first two quotes and `.section__more` "All three" → `#about`. Nothing else changes.

2. **Portrait filename.** The file is `images/sandip.jpg` (not `.jpeg`). `MBH.SITE.images.sandip = 'images/sandip.jpg'`. All other photos are `.jpeg`.

3. **Photos stay where the spec puts them** (trek intro 4:5 crop, 72px trek-card thumbs, About/Home portrait). Do not add photo heroes; do not remove these.

4. **Difficulty filter fix is mandatory** (FINAL-SPEC §4 `difficultyBands`): "Challenging to Strenuous" treks must appear under both Challenging and Strenuous chips.

5. **Test harness, for whoever verifies:** from the `v2/` directory:
   - `node test/run.mjs --role owner|admin|interact|view|none --width 390|1440 --route '#agenda' --scenario test/scenarios/<file>.mjs [--seed test/seed.json] [--shots test/shots]`
   - Scenario modules export `default async (page, t) => {...}` with `t.expect(cond, msg)`, `t.shot(label)`, `t.log()`. The harness injects a faithful `window.claude` mock (`test/claude-mock.js`) honouring the BRIEF access rules; `--seed` pre-loads docs keyed by path (`"departures/x": {...}`). `window.__MBH_MOCK_STORE.dump()` in `page.evaluate` returns the whole store for assertions.
   - `node test/check-data.mjs` validates data.js (V1 port fidelity, waypoint geometry, helper behaviour). It must exit 0.
   - Builders may create new scenario files under `test/scenarios/`. Never publish anything under `test/`.
