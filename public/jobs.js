'use strict';
// Job matching shared by the browser and the tests.
// A "job" (Craftsman, Swordsman...) owns a look, a home place and a list of name patterns.
// An agent's role id resolves: exact entry in roles -> a job's own name -> first job whose pattern matches -> nothing.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RealmJobs = factory();
})(this, function () {
  const slug = s => String(s || '').toLowerCase().trim().replace(/[\s_]+/g, '-');
  const rx = new Map();
  const test = (p, s) => { let r = rx.get(p); if (!r) { try { r = new RegExp(p, 'i'); } catch { r = /$^/; } rx.set(p, r); } return r.test(s); };

  function resolveRole(cfg, id) {
    cfg = cfg || {}; const roles = cfg.roles || {}, jobs = cfg.jobs || {}, key = slug(id);
    if (!key) return null;
    const pack = (jobName, role, how) => {
      const j = jobs[jobName] || {}, r = role || {};
      return { job: jobName || r.job || r.title || r.name || '', specialty: r.specialty !== undefined ? r.specialty : '', look: r.look || j.look || null, body: r.body || j.body, accent: r.accent || j.accent,
        home: r.home || j.home || null, tasks: r.tasks || j.tasks || [], how };
    };
    const exact = roles[id] || roles[key];
    if (exact) return pack(exact.job || null, exact, 'role');
    for (const jobName of Object.keys(jobs)) if (slug(jobName) === key) return pack(jobName, null, 'job');
    for (const [jobName, j] of Object.entries(jobs)) if ((j.match || []).some(p => test(p, key))) return pack(jobName, null, 'pattern');
    return null;
  }
  return { resolveRole, slug };
});
