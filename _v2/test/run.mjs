// CLI: node test/run.mjs --role owner --width 390 --route '#agenda' --scenario test/scenarios/smoke.mjs [--shots dir] [--seed file.json]
import { runScenario } from './harness.mjs';
import { readFileSync, mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));

const mock = {};
if (args.seed) mock.seed = JSON.parse(readFileSync(args.seed, 'utf8'));
if (args.dbAvailable === 'false') mock.dbAvailable = false;
if (args.shots) mkdirSync(args.shots, { recursive: true });

const r = await runScenario({
  role: args.role || 'owner',
  width: Number(args.width || 390),
  route: args.route || '',
  scenario: args.scenario,
  mock,
  shotsDir: args.shots,
  name: args.name || `${args.role || 'owner'}-${args.width || 390}`,
});
for (const l of r.logs) console.log('  ' + l);
if (r.result) console.log('RESULT ' + JSON.stringify(r.result));
if (r.thrown) console.log('THREW ' + r.thrown);
console.log(r.errors.length ? 'ERRORS:\n  ' + r.errors.join('\n  ') : 'ERRORS: none');
process.exit(r.errors.length || r.thrown ? 1 : 0);
