export function createApp() {
  return (req, res) => {
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ service: 'eduplateforme', status: 'ready' }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'NOT_FOUND' }));
  };
}
