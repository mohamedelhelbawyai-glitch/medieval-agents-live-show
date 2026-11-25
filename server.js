// Agent Realm server: serves the town, accepts agent events, streams them to browsers (SSE).
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function start({ port = 4747, host = '127.0.0.1', quiet = false } = {}) {
  const clients = new Set();
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, name: 'agent-realm', viewers: clients.size }));
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
      resolve(server);
    });
  });
}

module.exports = { start };
if (require.main === module) start({ port: +process.env.PORT || 4747 });
