'use strict';
// `agent-realm update`: compare with the latest commit on GitHub and reinstall from it.
// Contacts api.github.com only when you run this command.
const fs = require('fs'), os = require('os'), path = require('path'), https = require('https'), cp = require('child_process');
const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');

const repoSlug = () => { const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec((pkg.repository && pkg.repository.url) || ''); return m ? m[1] : null; };
const stateFile = () => path.join(os.homedir(), '.agent-realm', 'installed.json');
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } }
function writeState(s) { fs.mkdirSync(path.dirname(stateFile()), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2) + '\n'); }

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const r = https.get(url, { headers: { 'User-Agent': 'agent-realm-cli', Accept: 'application/vnd.github+json' }, timeout: 6000 }, res => {
      let b = ''; res.on('data', c => (b += c));
      res.on('end', () => res.statusCode === 200 ? (() => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } })() : reject(new Error(`GitHub answered ${res.statusCode}`)));
    });
    r.on('error', reject); r.on('timeout', () => r.destroy(new Error('timed out reaching github.com')));
  });
}
async function latest(slug) {
  const c = await getJSON(`https://api.github.com/repos/${slug}/commits/main`);
  let version = null;
  try { version = (await getJSON(`https://raw.githubusercontent.com/${slug}/${c.sha}/package.json`).catch(() => null) || {}).version || null; } catch {}
  return { sha: c.sha, short: c.sha.slice(0, 7), message: String(c.commit && c.commit.message || '').split('\n')[0], date: c.commit && c.commit.committer && c.commit.committer.date, version };
}
// Where is this copy running from? Only a global npm install can be updated by reinstalling.
function installKind() {
  if (fs.existsSync(path.join(ROOT, '.git'))) return 'clone';
  if (ROOT.includes(`${path.sep}_npx${path.sep}`)) return 'npx';
  return 'global';
}

module.exports = { repoSlug, readState, writeState, latest, installKind, pkg };
