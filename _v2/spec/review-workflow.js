export const meta = {
  name: 'v2-review',
  description: 'Adversarial review of the built V2 artifact across six lenses, verify each finding with two skeptics, fix the confirmed ones, re-run the full harness',
  phases: [
    { title: 'Find', detail: 'six independent reviewers, each a different lens' },
    { title: 'Verify', detail: 'two skeptics per lens try to refute each finding' },
    { title: 'Fix', detail: 'one fixer applies confirmed findings and re-runs the harness' },
    { title: 'Critic', detail: 'completeness critic looks for what everyone missed' },
  ],
}

const V2 = '/tmp/claude-0/-home-user-onwardtravel/1042fc63-b308-572b-9adf-8bb91fff0dab/scratchpad/v2'
const CTX = `The project is at ${V2}: index.html, styles.css, data.js, maps.js, app.js, admin.js, images/. Specs: ${V2}/spec/BRIEF.md (hard runtime constraints), ${V2}/spec/FINAL-SPEC.md, ${V2}/spec/ADDENDUM.md (overrides FINAL-SPEC). Test harness: \`cd ${V2} && node test/run.mjs --role owner|admin|interact|view|none --width 390|1440 --route '#…' [--seed test/seed.json] [--scenario test/scenarios/x.mjs] [--shots test/shots/review]\`; scenarios under test/scenarios/ (public-null, booking, admin, admin-edge, admin-gate, admin-inbox, admin-layout, admin-manage, trek-map, integration-extras, mock-selftest); \`node test/matrix.mjs [--shots dir] [--only home,admin] [--widths 390,1440]\` sweeps every route x role x width and audits JS classes missing from CSS; \`node test/hostile-strings.mjs\` checks injection/overflow with hostile db strings. The window.claude mock in test/claude-mock.js honours the access rules. Do not modify anything under test/ except adding new scenario files.`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'short kebab id' },
          file: { type: 'string' },
          where: { type: 'string', description: 'function/selector/line' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          claim: { type: 'string', description: 'what is wrong, one or two sentences' },
          evidence: { type: 'string', description: 'how you observed it: harness output, screenshot path, code excerpt' },
          fix: { type: 'string', description: 'concrete proposed fix' },
        },
        required: ['id', 'file', 'where', 'severity', 'claim', 'evidence', 'fix'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'],
}

const LENSES = [
  { key: 'security', prompt: 'Security and data access. Every db or user-supplied string interpolated into HTML must be escaped (look for innerHTML/insertAdjacentHTML/template literals fed by store data, booking fields, settings.heroNote, names from profiles). No window.claude.db/room member reads; claude.use only. Booking writes only to bookings/{own id}; admin writes only when canEdit. Check that a contributor cannot move their own booking to confirmed. Check wa.me links are built with encodeURIComponent. Try hostile values through the harness (seed a booking with name "<img src=x onerror=alert(1)>" and a heroNote with markup) and confirm nothing executes.' },
  { key: 'integrity', prompt: 'Booking and capacity integrity. Trace Confirm/Decline/Cancel/Restore/Withdraw and syncDeparture against FINAL-SPEC §7.6–7.7 and §6.7. Look for: double-counting confirmedPax, spotsLeft computed from stale store, status not flipping full/open, writeQueue not serialising per path, mergeItems losing items, withdraw overwriting an admin decision, new-departure id collisions, edit mode allowing capacity below confirmed. Exercise them with the harness (owner + seed) and read the store with window.__MBH_MOCK_STORE.dump().' },
  { key: 'mobile', prompt: 'Mobile UX at 390x844, both light and dark theme (set localStorage mbh.theme via page.evaluate then reload, or click the theme toggle). Screenshot every route: #home #treks #trek-poon-hill #trek-annapurna-tilicho #trek-ebc-gokyo #agenda #departure-mardi-himal-20261016 #book-mardi-himal-20261016 #my-trips #about #admin #admin-departures #admin-departure-mardi-himal-20261016 #admin-bookings #admin-settings (owner + seed). LOOK at each screenshot. Report overlaps, clipped text, unstyled elements, tap targets under 44px, content hidden behind the bottom bar, sticky header covering headings, map labels colliding, anything that looks broken or cheap. Also full-page screenshots where useful.' },
  { key: 'desktop', prompt: 'Desktop UX at 1440x900 and tablet 820x1180, light and dark. Screenshot the same routes as a phone reviewer would (home, treks, a trek page, agenda, departure, book sheet as right panel, my-trips, about, admin inbox/departures/bookings/settings with owner + seed). LOOK at each. Report layout breakage, wasted space, two-column trek page problems (sticky map), sheet panel issues, theme contrast problems (text unreadable in dark), anything that looks unfinished next to a premium travel site.' },
  { key: 'contract', prompt: 'Artifact runtime contract compliance (BRIEF.md and the artifact rules): index.html has no doctype/html/head/body tags and starts with <title>; only Google Fonts and relative files are loaded (grep for http(s):// in all files; only fonts.googleapis/gstatic, wa.me and magicbeyondhimalaya.com links allowed); no mailto:/tel:/sms: links; no alert/confirm/prompt/window.print; hash routes only bare tokens; complete light tokens on bare :root and dark in both the media-guarded and [data-theme=dark] blocks with color-scheme dark; body has an explicit background; sticky header uses env(safe-area-inset-top); fixed bottom bars add safe-area-inset-bottom; localStorage access wrapped in try/catch (test by making localStorage throw via addInitScript and loading every route); no horizontal overflow at 390 on every route.' },
  { key: 'honesty', prompt: 'Content honesty and spec conformance. Every price, itinerary line, altitude and review on screen must come from data.js (V1 data + ADDENDUM reviews) — nothing invented. No copy promises a response time ("within 24 hours" etc.). Primary action wording is "Request a spot". Shared photos (Mardi Himal, Manaslu Circuit) never captioned as that trek. The difficulty filter: Challenging and Strenuous chips both include "Challenging to Strenuous" treks. The 4,000 m guide only on treks above 4,000 m. With role none (no capabilities) every route renders fully, dates show the honest empty state, booking falls back to WhatsApp with the full request serialised, admin shows the unavailable gate. Report every deviation with evidence.' },
]

phase('Find')
const found = await pipeline(
  LENSES,
  (l) => agent(`${CTX}\n\nYou are an independent reviewer. Lens: ${l.prompt}\n\nBe concrete and evidence-based: run the harness, take screenshots under test/shots/review-${l.key}/, read the code. Report only real problems you observed or can point to in code. Do NOT fix anything. Return at most 12 findings, most severe first.`,
    { label: 'find:' + l.key, phase: 'Find', schema: FINDINGS, effort: 'high' }),
  (res, l) => (res && res.findings ? res.findings : []).map(f => ({ ...f, id: l.key + '-' + f.id, lens: l.key })),
)
const all = found.filter(Boolean).flat()
// dedupe by file+where+first words of claim
const seen = new Set(), uniq = []
for (const f of all) { const k = (f.file + '|' + f.where + '|' + f.claim.slice(0, 50)).toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(f) } }
log(`${all.length} findings, ${uniq.length} after dedupe`)

phase('Verify')
const BATCH_VERDICT = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, refuted: { type: 'boolean' }, reason: { type: 'string' } }, required: ['id', 'refuted', 'reason'] } } },
  required: ['verdicts'],
}
const byLens = {}
for (const f of uniq) (byLens[f.lens] = byLens[f.lens] || []).push(f)
const lensBatches = Object.entries(byLens)
const votesById = {}
await parallel(lensBatches.flatMap(([lens, fs]) => [0, 1].map(i => () => agent(
  `${CTX}\n\nReviewers claim the problems below. Your job is to REFUTE each one if you can. Check the code and, where it helps, reproduce with the harness. Set refuted=false only if you confirm the problem is real and would be visible to a user or would break data. ${i === 1 ? 'Take the user-impact angle: would a trekker or Sandip actually hit this?' : 'Take the correctness angle: is the claim technically accurate?'} Return one verdict per finding id.\n\nFindings:\n${JSON.stringify(fs, null, 1)}`,
  { label: `verify:${lens}:${i}`, phase: 'Verify', schema: BATCH_VERDICT, effort: 'medium' })
  .then(r => { for (const v of (r && r.verdicts) || []) (votesById[v.id] = votesById[v.id] || []).push(v) }))))
const verified = uniq.map(f => { const vs = votesById[f.id] || []; const up = vs.filter(v => !v.refuted).length; return { f, votes: vs, real: vs.length === 0 ? f.severity !== 'minor' : (f.severity === 'minor' ? up >= 2 : up >= 1) } })
const confirmed = verified.filter(v => v.real).map(v => ({ ...v.f, verifierNotes: v.votes.map(x => x.reason) }))
const dropped = verified.filter(v => !v.real).map(v => v.f.id)
log(`${confirmed.length} confirmed, ${dropped.length} refuted: ${dropped.join(', ')}`)

phase('Fix')
const fixReport = await agent(`${CTX}\n\nApply these confirmed review findings, most severe first. For each, fix it in the owning file faithfully to the spec (never simplify a feature away). After all fixes: run \`node test/check-data.mjs\`, \`node --check\` on every js file, every scenario in test/scenarios/ at 390 AND 1440, node test/hostile-strings.mjs,, and the no-scenario route matrix (roles none/interact/owner x widths 390/1440 x routes #home #treks #trek-mardi-himal #trek-ebc-gokyo #agenda #departure-mardi-himal-20261016 #book-mardi-himal-20261016 #my-trips #about #admin #admin-departures #admin-bookings #admin-settings; seed for interact/owner). Everything must be clean. Take final screenshots at 390 and 1440 of #home, #trek-annapurna-tilicho, #agenda, #book-mardi-himal-20261016, #admin (owner+seed) into test/shots/final/ in light theme, and #home + #trek-annapurna-tilicho in dark.\n\nConfirmed findings:\n${JSON.stringify(confirmed, null, 1)}`,
  { label: 'fix', phase: 'Fix', effort: 'xhigh', schema: {
    type: 'object',
    properties: {
      applied: { type: 'array', items: { type: 'string' } },
      notApplied: { type: 'array', items: { type: 'string' }, description: 'id + reason' },
      allGreen: { type: 'boolean' },
      residual: { type: 'array', items: { type: 'string' } },
      finalShots: { type: 'array', items: { type: 'string' } },
    },
    required: ['applied', 'notApplied', 'allGreen', 'residual', 'finalShots'],
  } })

phase('Critic')
const critic = await agent(`${CTX}\n\nYou are the completeness critic, arriving after a review-and-fix round. Findings already addressed: ${JSON.stringify((fixReport && fixReport.applied) || [])}. Look for what everyone missed: a route or state no one exercised (my-trips after withdraw, admin detail for a missing departure, settings preset when guiding today, cached-dates path after db goes null, FitMyDates, theme toggle cycling, keyboard focus and Escape in sheets, reduced motion), a class emitted by JS with no CSS, CSS for components that JS never renders, dead code paths. Verify each by running the harness. Fix anything real directly (small, faithful fixes), re-run the affected scenarios, and report.`,
  { label: 'critic', phase: 'Critic', effort: 'high', schema: {
    type: 'object',
    properties: { fixed: { type: 'array', items: { type: 'string' } }, open: { type: 'array', items: { type: 'string' } }, green: { type: 'boolean' } },
    required: ['fixed', 'open', 'green'],
  } })

return { found: all.length, unique: uniq.length, confirmed: confirmed.map(c => `${c.severity} ${c.id}: ${c.claim}`), dropped, fix: fixReport, critic }
