// Agent Realm server: serves the town, accepts agent events, streams them to browsers (SSE).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

// roles.json lookup order: --roles, REALM_ROLES, ./agent-realm.roles.json, bundled roles.json
function findRoles(opt) {
  const ok = f => { try { JSON.parse(fs.readFileSync(f, 'utf8')); return true; } catch { return false; } };
  return [opt, process.env.REALM_ROLES, path.join(process.cwd(), 'agent-realm.roles.json'), path.join(__dirname, 'roles.json')]
    .filter(Boolean).map(f => path.resolve(f)).find(ok);
}

function start({ port = 4747, host = '127.0.0.1', quiet = false, roles } = {}) {
  const clients = new Set();
  const rolesFile = findRoles(roles);
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, name: 'agent-realm', viewers: clients.size }));
      return;
    }
    if (req.method === 'GET' && url === '/roles.json') {
      fs.readFile(rolesFile, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': 'application/json' }).end(data); });
      return;
    }
    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(':ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST' && url === '/event') {
      // Require JSON content-type: forces a CORS preflight, so random websites can't inject events.
      if (!/^application\/json/.test(req.headers['content-type'] || '')) { res.writeHead(415).end(); return; }
      let body = '';
      req.on('data', d => { body += d; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        try {
          const line = 'data: ' + JSON.stringify(JSON.parse(body)) + '\n\n';
          for (const c of clients) c.write(line);
          res.writeHead(204).end();
        } catch { res.writeHead(400).end(); }
      });
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const file = path.join(PUB, url === '/' ? 'index.html' : url);
    if (!file.startsWith(PUB + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  const ping = setInterval(() => { for (const c of clients) c.write(':ping\n\n'); }, 25000);
  ping.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      if (!quiet) console.log(`Agent Realm running at http://localhost:${port}`);
      server.rolesFile = rolesFile;
      resolve(server);
    });
  });
}

module.exports = { start, findRoles };
if (require.main === module) start({ port: +process.env.PORT || 4747 });
