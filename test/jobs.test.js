'use strict';
const test = require('node:test'), assert = require('node:assert');
const { resolveRole } = require('../public/jobs');
const cfg = require('../roles.json');
const job = id => { const r = resolveRole(cfg, id); return r && r.job; };

test('pinned roles map to the requested jobs', () => {
  assert.strictEqual(job('orchestrator'), 'Royal Steward');
  assert.strictEqual(job('flutter-expert'), 'Craftsman');
  assert.strictEqual(job('code-reviewer'), 'Master Craftsmen');
  assert.strictEqual(job('qa-verifier'), 'Guild Inspector');
  assert.strictEqual(job('intake-auditor'), 'Chancellor');
  assert.strictEqual(job('debugger'), 'Swordsman');
  assert.strictEqual(job('release-engineer'), 'Keeper of the Arsenal');
  assert.strictEqual(job('reporter'), 'Royal Scribe');
  assert.strictEqual(job('context-engineer'), 'Keeper of Records');
});
test('any role matching a job by name takes that job', () => {
  for (const [id, want] of [
    ['mobile-developer', 'Craftsman'], ['go-engineer', 'Craftsman'], ['react-frontend-engineer', 'Craftsman'], ['golang-specialist', 'Craftsman'],
    ['security-code-reviewer', 'Master Craftsmen'], ['design-reviewer', 'Master Craftsmen'],
    ['e2e-tester', 'Guild Inspector'], ['quality-checker', 'Guild Inspector'],
    ['business-analyst', 'Chancellor'], ['requirements-gatherer', 'Chancellor'], ['clarifier', 'Chancellor'], ['product-owner', 'Chancellor'],
    ['bug-hunter', 'Swordsman'], ['incident-responder', 'Swordsman'], ['hotfix-agent', 'Swordsman'],
    ['deploy-bot', 'Keeper of the Arsenal'], ['ci-runner', 'Keeper of the Arsenal'], ['release-manager', 'Keeper of the Arsenal'],
    ['status-reporter', 'Royal Scribe'], ['summarizer', 'Royal Scribe'],
    ['context-keeper', 'Keeper of Records'], ['docs-writer', 'Keeper of Records'], ['memory-agent', 'Keeper of Records'],
    ['team-lead', 'Royal Steward'], ['coordinator', 'Royal Steward'],
  ]) assert.strictEqual(job(id), want, id);
});
test('patterns do not fire on look-alike words', () => {
  assert.strictEqual(job('database-specialist'), 'Craftsman');   // "ba" must not make this a Chancellor, "ci" must not make "specialist" a deployer
  assert.strictEqual(job('specialist'), 'Craftsman');
  assert.notStrictEqual(job('fixture-maker'), 'Swordsman');
});
test('a job can be named directly, and unknown roles resolve to nothing', () => {
  assert.strictEqual(job('Guild Inspector'), 'Guild Inspector');
  assert.strictEqual(job('Keeper of the Arsenal'), 'Keeper of the Arsenal');
  assert.strictEqual(resolveRole(cfg, 'zzz-unknown'), null);
  assert.strictEqual(resolveRole(cfg, ''), null);
});
test('a resolved role carries look, home and specialty', () => {
  const r = resolveRole(cfg, 'flutter-expert');
  assert.deepStrictEqual([r.look, r.home, r.specialty], ['worker', 'forge', 'Flutter']);
  assert.strictEqual(resolveRole(cfg, 'bug-hunter').look, 'swordsman');
});
test('older role files (named characters) still resolve', () => {
  const old = { roles: { 'code-reviewer': { name: 'Sir Cedric', title: 'the Just', look: 'knight', home: 'library' } } };
  const r = resolveRole(old, 'code-reviewer'); assert.deepStrictEqual([r.job, r.look], ['the Just', 'knight']);
});
test('the README documents every pinned role and job', () => {
  const readme = require('fs').readFileSync(require('path').join(__dirname, '..', 'README.md'), 'utf8');
  for (const id of Object.keys(cfg.roles)) assert.ok(readme.includes('`' + id + '`'), 'README is missing role ' + id);
  for (const j of Object.keys(cfg.jobs)) assert.ok(readme.includes('**' + j + '**'), 'README is missing job ' + j);
});
