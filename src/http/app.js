export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function parseJsonBody(req, maxBodyBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let exceeded = false;
    let settled = false;
    const ignoreData = () => {};

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('data', ignoreData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const succeed = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(payload);
    };

    const onData = (chunk) => {
      if (exceeded) {
        return;
      }

      size += chunk.length;
      if (size > maxBodyBytes) {
        exceeded = true;
        req.removeListener('data', onData);
        req.on('data', ignoreData);
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      if (exceeded) {
        const error = new Error('REQUEST_TOO_LARGE');
        error.statusCode = 413;
        fail(error);
        return;
      }

      if (chunks.length === 0) {
        succeed({});
        return;
      }

      try {
        succeed(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const error = new Error('INVALID_JSON');
        error.statusCode = 400;
        fail(error);
      }
    };

    const onError = (error) => {
      fail(error.statusCode ? error : Object.assign(new Error('REQUEST_READ_ERROR'), { statusCode: 400 }));
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

function mapHttpError(error) {
  if (error?.message === 'REQUEST_TOO_LARGE') {
    return { statusCode: 413, code: 'REQUEST_TOO_LARGE' };
  }

  if (error?.message === 'INVALID_JSON') {
    return { statusCode: 400, code: 'INVALID_JSON' };
  }

  if (error?.message === 'REQUEST_READ_ERROR') {
    return { statusCode: 400, code: 'REQUEST_READ_ERROR' };
  }

  if (error?.message?.includes('missing required field')) {
    return { statusCode: 400, code: 'VALIDATION_ERROR' };
  }

  if (typeof error.code === 'string' && error.code.startsWith('SQLITE_CONSTRAINT')) {
    return { statusCode: 409, code: 'CONFLICT' };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR' };
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
        const mapped = mapHttpError(error);
        if (mapped.code === 'INTERNAL_ERROR') {
          console.error(`Unhandled error on ${req.method} ${req.url}: ${error.name}`);
        }
        sendJson(res, mapped.statusCode, { error: mapped.code });
      }
      return;
    }

    sendJson(res, 404, { error: 'NOT_FOUND' });
  };
}
