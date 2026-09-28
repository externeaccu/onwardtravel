// Validates data.js against the V1 extract and the FINAL-SPEC §4 contract. Exit 0 = clean.
//   node test/check-data.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V2 = path.resolve(HERE, '..');
const problems = [];
const bad = (m) => problems.push(m);

function load(file) {
  const ctx = { window: {}, console };
  ctx.window.MBH = undefined;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx;
}
// V1 extract defines bare consts; wrap to expose them
const v1src = readFileSync(path.join(V2, 'spec/v1-data-extract.js'), 'utf8')
  .split("document.querySelectorAll('.filter-chip')")[0]
  .replace(/const grid = document\.getElementById\('trekGrid'\);[\s\S]*$/, '');
const v1ctx = { console };
vm.createContext(v1ctx);
vm.runInContext(v1src + '\nthis.__V1 = { TREKS, INCLUDED, NOT_INCLUDED, ADDONS, FAQS };', v1ctx);
const V1 = v1ctx.__V1;

let MBH;
try { MBH = load(path.join(V2, 'data.js')).window.MBH; } catch (e) { console.error('data.js failed to load:', e.message); process.exit(1); }
if (!MBH) { console.error('window.MBH not defined'); process.exit(1); }

// ---- V1 fidelity ----
const V1_FIELDS = ['id', 'name', 'region', 'days', 'difficulty', 'diffKey', 'altitude', 'fromPrice', 'season', 'image', 'overview', 'overview2', 'overview3', 'highlights', 'days_data', 'pricing'];
if (!Array.isArray(MBH.TREKS) || MBH.TREKS.length !== 8) bad(`TREKS should have 8 entries, has ${MBH.TREKS && MBH.TREKS.length}`);
V1.TREKS.forEach((v, i) => {
  const t = MBH.TREKS[i];
  if (!t) return bad(`missing trek at index ${i} (${v.id})`);
  if (t.id !== v.id) bad(`order: expected ${v.id} at ${i}, got ${t.id}`);
  for (const f of V1_FIELDS) {
    if (JSON.stringify(t[f]) !== JSON.stringify(v[f])) bad(`${v.id}.${f} differs from V1`);
  }
  // new fields
  if (typeof t.heroImage !== 'string') bad(`${v.id}.heroImage missing`);
  if (typeof t.imageAlt !== 'string' || !t.imageAlt) bad(`${v.id}.imageAlt missing`);
  if (typeof t.imageShared !== 'boolean') bad(`${v.id}.imageShared missing`);
  const expectShared = ['mardi-himal', 'manaslu-circuit'].includes(v.id);
  if (t.imageShared !== expectShared) bad(`${v.id}.imageShared should be ${expectShared}`);
  if (t.imageShared && /mardi|manaslu|circuit/i.test(t.imageAlt)) bad(`${v.id}.imageAlt must not name the trek for a shared photo`);
  const spark = v.days_data.map(d => d.alt);
  if (JSON.stringify(t.sparkline) !== JSON.stringify(spark)) bad(`${v.id}.sparkline must equal days_data.map(alt)`);
  if (!Array.isArray(t.route) || t.route.length < 4) return bad(`${v.id}.route missing or too short`);
  const passPeak = t.route.filter(w => w.kind === 'pass' || w.kind === 'peak').map(w => w.elev);
  const maxE = Math.max(...spark, ...passPeak);
  if (t.maxElev !== maxE) bad(`${v.id}.maxElev should be ${maxE}, is ${t.maxElev}`);
  // route geometry
  const kinds = new Set(['start', 'stop', 'pass', 'peak', 'via', 'end']);
  if (t.route[0].kind !== 'start') bad(`${v.id}.route[0] must be kind start`);
  if (t.route[t.route.length - 1].kind !== 'end') bad(`${v.id}.route last must be kind end`);
  let prevDay = 0;
  t.route.forEach((w, k) => {
    if (!kinds.has(w.kind)) bad(`${v.id}.route[${k}] bad kind ${w.kind}`);
    if (typeof w.lat !== 'number' || typeof w.lng !== 'number') return bad(`${v.id}.route[${k}] lat/lng not numbers`);
    if (w.lat < 26.3 || w.lat > 30.5 || w.lng < 80 || w.lng > 88.3) bad(`${v.id}.route[${k}] ${w.name} outside Nepal bbox (${w.lat},${w.lng})`);
    if (String(w.lat).split('.')[1]?.length > 3 || String(w.lng).split('.')[1]?.length > 3) bad(`${v.id}.route[${k}] ${w.name} more than 3 decimals`);
    if (!Number.isInteger(w.day) || w.day < 1 || w.day > v.days) bad(`${v.id}.route[${k}] ${w.name} day ${w.day} out of range`);
    if (w.day < prevDay) bad(`${v.id}.route[${k}] ${w.name} day goes backwards`);
    prevDay = w.day;
    if (typeof w.elev !== 'number') bad(`${v.id}.route[${k}] ${w.name} elev missing`);
    if (w.kind === 'stop') {
      const dd = v.days_data.find(d => d.day === w.day);
      if (!dd) bad(`${v.id}.route[${k}] stop day ${w.day} not in days_data`);
      else if (dd.alt !== w.elev) bad(`${v.id}.route[${k}] ${w.name} stop elev ${w.elev} != days_data alt ${dd.alt}`);
    }
    if (k > 0) {
      const p = t.route[k - 1];
      const mode = w.mode || 'walk';
      const R = 6371, toR = (x) => x * Math.PI / 180;
      const dLat = toR(w.lat - p.lat), dLng = toR(w.lng - p.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(p.lat)) * Math.cos(toR(w.lat)) * Math.sin(dLng / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(a));
      if (mode === 'walk' && km > 25) bad(`${v.id}: ${p.name} → ${w.name} is ${km.toFixed(1)} km on foot (>25)`);
      if (mode === 'walk' && km < 0.05 && !(w.kind === 'stop' && p.kind === 'stop')) bad(`${v.id}: ${p.name} → ${w.name} are the same point but not a rest-day merge`);
    }
  });
});

// ---- other constants ----
for (const k of ['INCLUDED', 'NOT_INCLUDED', 'ADDONS', 'FAQS']) {
  if (JSON.stringify(MBH[k]) !== JSON.stringify(V1[k])) bad(`${k} differs from V1`);
}
if (!MBH.ROUTES || Object.keys(MBH.ROUTES).length !== 8) bad('ROUTES alias missing');
const S = MBH.SITE || {};
for (const k of ['name', 'tagline', 'guide', 'whatsapp', 'whatsappDisplay', 'email', 'website', 'heroFallback', 'images', 'guideQuotes', 'howItWorks', 'prototypeLine', 'reviews', 'reviewsLede']) if (S[k] === undefined) bad(`SITE.${k} missing`);
if (S.whatsapp !== '9779851353347') bad('SITE.whatsapp must be digits 9779851353347');
if (S.images && S.images.sandip !== 'images/sandip.jpg') bad('SITE.images.sandip must be images/sandip.jpg');
if (!Array.isArray(S.reviews) || S.reviews.length !== 3) bad('SITE.reviews must have 3 entries');
if (Array.isArray(S.guideQuotes)) {
  const faqText = V1.FAQS.map(f => f[1]).join('\n');
  S.guideQuotes.forEach(q => { if (!faqText.includes(q)) bad(`guideQuote not found verbatim in FAQ answers: "${q.slice(0, 40)}…"`); });
}

// ---- helpers ----
const T = (id) => MBH.TREKS.find(t => t.id === id);
const band = (id) => MBH.difficultyBands(T(id));
if (!(band('annapurna-tilicho').has('challenging') && band('annapurna-tilicho').has('strenuous'))) bad('difficultyBands: Annapurna Circuit must span challenging+strenuous');
if (!(band('manaslu-tsum').has('challenging') && band('manaslu-tsum').has('strenuous'))) bad('difficultyBands: Manaslu+Tsum must span challenging+strenuous');
if (!(band('poon-hill').has('easy') && band('poon-hill').has('moderate'))) bad('difficultyBands: Poon Hill must span easy+moderate');
if (!(band('ebc-gokyo').has('strenuous') && band('ebc-gokyo').size === 1)) bad('difficultyBands: EBC is strenuous only');
if (MBH.lengthBand(T('mardi-himal')) !== 'short' || MBH.lengthBand(T('abc-poon')) !== 'medium' || MBH.lengthBand(T('annapurna-tilicho')) !== 'long') bad('lengthBand thresholds wrong');
const tf = (id, pax) => { const r = MBH.tierFor(T(id), pax); return r && r.price; };
if (tf('poon-hill', 3) !== 225) bad(`tierFor poon-hill 3 → expected 225, got ${tf('poon-hill', 3)}`);
if (tf('poon-hill', 1) !== 300) bad('tierFor poon-hill 1 → 300');
if (tf('poon-hill', 12) !== 150) bad('tierFor poon-hill 12 → 150');
if (tf('ebc-gokyo', 5) !== 650) bad(`tierFor ebc 5 → expected 650, got ${tf('ebc-gokyo', 5)}`);
if (tf('ebc-gokyo', 2) !== 800) bad('tierFor ebc 2 → 800');
if (tf('ebc-gokyo', 9) !== 600) bad('tierFor ebc 9 → 600');
if (JSON.stringify(MBH.parseTier('9+ pax')) !== JSON.stringify({ min: 9, max: Infinity }) && !(MBH.parseTier('9+ pax')?.min === 9 && MBH.parseTier('9+ pax')?.max === Infinity)) bad('parseTier 9+ pax');
if (!MBH.trekById('langtang')) bad('trekById');
if (!Array.isArray(MBH.SPARK_RANGE)) bad('SPARK_RANGE');

if (problems.length) { console.log('DATA CHECK: ' + problems.length + ' problem(s)'); problems.forEach(p => console.log('  - ' + p)); process.exit(1); }
console.log('DATA CHECK: clean (8 treks, ' + MBH.TREKS.reduce((n, t) => n + t.route.length, 0) + ' waypoints)');
