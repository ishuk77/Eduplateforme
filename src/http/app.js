export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function parseJsonBody(req, maxBodyBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        const error = new Error('REQUEST_TOO_LARGE');
        error.statusCode = 413;
        req.destroy(error);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const error = new Error('INVALID_JSON');
        error.statusCode = 400;
        reject(error);
      }
    });

    req.on('error', (error) => {
      reject(error.statusCode ? error : Object.assign(new Error('REQUEST_READ_ERROR'), { statusCode: 400 }));
    });
  });
}

export function createAppHandler(service, options = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;

  return async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'POST' && req.url === '/organizations') {
      try {
        const body = await parseJsonBody(req, maxBodyBytes);
        const organization = service.registerOrganization({
          name: body.name,
          code: body.code,
          actorId: body.actorId ?? null
        });
        sendJson(res, 201, { organization });
      } catch (error) {
        const statusCode = error.statusCode ?? 400;
        sendJson(res, statusCode, { error: error.message });
      }
      return;
    }

    sendJson(res, 404, { error: 'NOT_FOUND' });
  };
}
