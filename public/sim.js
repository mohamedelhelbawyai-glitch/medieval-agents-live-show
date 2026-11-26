'use strict';
// Demo simulator: the cast working a feature, emitting the same events a real hook would.
// The two Swordsmen run a bug hunt: outriders (the bugs) ride in, and the fix either succeeds or fails.
(() => {
const pick = a => a[Math.floor(Math.random() * a.length)];
const ACTS = {
  'orchestrator': [['Task', 'Dispatching the next phase'], ['TodoWrite', 'Updating the royal plan'], ['Task', 'Reviewing the phase report']],
  'business-analyst': [['Read', 'requirements.md'], ['Grep', 'unclear requirements'], ['WebSearch', '"checkout flow best practice"']],
  'spec-author': [['Read', 'spec-template.md'], ['Write', 'spec.md'], ['Edit', 'spec.md']],
  'feature-architect': [['Read', 'constitution.md'], ['Write', 'plan.md'], ['Edit', 'data-model.md']],
  'task-planner': [['Write', 'tasks.md'], ['TodoWrite', 'Ordering tasks test-first']],
  'flutter-expert': [['Edit', 'lib/cart_cubit.dart'], ['Bash', 'flutter test'], ['Edit', 'lib/ui/cart_page.dart']],
  'node-specialist': [['Edit', 'src/routes/cart.ts'], ['Bash', 'npm test']],
  'sql-pro': [['db_query', 'EXPLAIN ANALYZE orders'], ['Edit', 'migrations/012_cart.sql']],
  'code-reviewer': [['Read', 'git diff'], ['Bash', 'git diff --stat'], ['Grep', 'SQL injection']],
  'qa-verifier': [['Bash', 'flutter test --coverage'], ['Bash', 'npm run e2e'], ['Read', 'acceptance.md']],
  'final-auditor': [['Read', 'qa-report.md'], ['Read', 'spec.md']],
  'release-engineer': [['Bash', 'docker push registry/app:1.4.0'], ['mcp__github__create_release', 'v1.4.0'], ['Bash', 'kubectl rollout status deploy/app']],
  'reporter': [['Read', 'qa-report.md'], ['Read', 'changelog']],
  'context-engineer': [['memory_write', 'Saving context'], ['Write', 'CONTEXT.md'], ['Read', 'notes.md']],
};
const SWORDSMEN = ['debugger', 'bug-fixer'];
let timers = [], on = false;
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const emit = e => window.Realm.emit(e);
function loop(role) {
  if (!on) return;
  const r = Math.random();
  if (r < .1) { emit({ agent: role, role, status: 'idle', text: 'Taking a break' }); return later(() => loop(role), 6000 + Math.random() * 6000); }
  if (r < .25 && role !== 'orchestrator') { emit({ agent: role, role, activity: 'report', status: 'idle', text: 'Reporting back to the Steward' }); return later(() => loop(role), 9000 + Math.random() * 5000); }
  const [tool, text] = pick(ACTS[role]);
  emit({ agent: role, role, tool, text, status: 'start' });
  later(() => { emit({ agent: role, role, tool, text, status: 'done' }); later(() => loop(role), 1500 + Math.random() * 4500); }, 3500 + Math.random() * 3500);
}
// A bug hunt: enemies appear on the first event, a failing test may wound him, then he wins (70%) or falls (30%).
function hunt(role) {
  if (!on) return;
  emit({ agent: role, role, tool: 'Grep', text: 'NullPointerException', status: 'start', hold: true, enemies: 2 + Math.floor(Math.random() * 2) });
  later(() => emit({ agent: role, role, tool: 'Read', text: 'stack trace', status: 'start' }), 3500);
  later(() => emit({ agent: role, role, tool: 'Edit', text: 'null check in cart_cubit', status: 'start' }), 7000);
  if (Math.random() < 0.35) later(() => emit({ agent: role, role, tool: 'Bash', text: 'npm test', status: 'error' }), 9500);
  later(() => {
    if (Math.random() < 0.7) emit({ agent: role, role, activity: 'report', status: 'idle', hold: false, outcome: 'fixed', text: 'Bug fixed, tests pass' });
    else emit({ agent: role, role, status: 'error', hold: false, outcome: 'failed', text: 'Could not fix it' });
    later(() => hunt(role), 18000 + Math.random() * 6000);
  }, 13500);
}
window.RealmSim = {
  running: () => on,
  start() {
    on = true;
    Object.keys(ACTS).forEach((role, i) => later(() => loop(role), i * 900 + Math.random() * 500));
    SWORDSMEN.forEach((role, i) => later(() => hunt(role), 2500 + i * 9000));
  },
  stop() { on = false; timers.forEach(clearTimeout); timers = []; },
};
})();
