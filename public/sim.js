'use strict';
// Demo simulator: the whole cast working a feature through the phases, emitting the same events a real hook would.
(() => {
const pick = a => a[Math.floor(Math.random() * a.length)];
const ACTS = {
  'orchestrator': [['Task', 'Dispatching the next phase'], ['TodoWrite', 'Updating the royal plan'], ['Task', 'Reviewing the phase report']],
  'intake-auditor': [['Read', 'intake.md'], ['Grep', 'missing inputs']],
  'spec-author': [['Read', 'spec-template.md'], ['Write', 'spec.md'], ['Edit', 'spec.md']],
  'spec-reviewer': [['Read', 'spec.md'], ['Grep', 'untestable wording']],
  'feature-architect': [['Read', 'constitution.md'], ['Write', 'plan.md'], ['Edit', 'data-model.md']],
  'plan-reviewer': [['Read', 'plan.md'], ['Grep', 'plan vs spec']],
  'task-planner': [['Write', 'tasks.md'], ['TodoWrite', 'Ordering tasks test-first']],
  'coverage-reviewer': [['Read', 'tasks.md'], ['Grep', 'uncovered requirements']],
  'flutter-expert': [['Edit', 'lib/cart_cubit.dart'], ['Bash', 'flutter test'], ['Edit', 'lib/ui/cart_page.dart']],
  'kotlin-specialist': [['Edit', 'CartViewModel.kt'], ['Bash', './gradlew test']],
  'node-specialist': [['Edit', 'src/routes/cart.ts'], ['Bash', 'npm test']],
  'sql-pro': [['db_query', 'EXPLAIN ANALYZE orders'], ['Edit', 'migrations/012_cart.sql']],
  'code-reviewer': [['Read', 'git diff'], ['Bash', 'git diff --stat'], ['Grep', 'SQL injection']],
  'qa-verifier': [['Bash', 'flutter test --coverage'], ['Bash', 'npm run e2e'], ['Read', 'acceptance.md']],
  'test-scenario-designer': [['Write', 'test-scenarios.md'], ['Read', 'acceptance.md']],
  'debugger': [['Grep', 'NullPointerException'], ['Bash', 'dart run --observe'], ['Read', 'stack trace']],
  'performance-engineer': [['Bash', 'k6 run load.js'], ['db_query', 'pg_stat_statements']],
  'final-auditor': [['Read', 'qa-report.md'], ['Read', 'spec.md']],
};
let timers = [], on = false;
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const emit = e => window.Realm.emit(e);
function loop(role) {
  if (!on) return;
  const r = Math.random();
  if (r < .1) { emit({ agent: role, role, status: 'idle', text: 'Taking a break' }); return later(() => loop(role), 6000 + Math.random() * 6000); }
  if (r < .22 && role !== 'orchestrator') { emit({ agent: role, role, activity: 'report', status: 'idle', text: 'Reporting back to the Conductor' }); return later(() => loop(role), 9000 + Math.random() * 5000); }
  const [tool, text] = pick(ACTS[role]);
  emit({ agent: role, role, tool, text, status: 'start' });
  later(() => { emit({ agent: role, role, tool, text, status: Math.random() < .1 ? 'error' : 'done' }); later(() => loop(role), 1500 + Math.random() * 4500); }, 3500 + Math.random() * 3500);
}
window.RealmSim = {
  running: () => on,
  start() { on = true; Object.keys(ACTS).forEach((role, i) => later(() => loop(role), i * 1100 + Math.random() * 600)); },
  stop() { on = false; timers.forEach(clearTimeout); timers = []; },
};
})();
