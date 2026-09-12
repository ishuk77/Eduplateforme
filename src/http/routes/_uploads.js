import { ApiError } from '../../shared/errors.js';
import { parseJson } from '../middleware/validation.js';

export async function parseAssetRequest(request, maxBytes) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  const multipart = (request.headers.get('content-type') ?? '').startsWith('multipart/form-data');
  const transportLimit = multipart ? maxBytes + 256 * 1024 : Math.ceil(maxBytes * 4 / 3) + 256 * 1024;
  if (contentLength > transportLimit) {
    throw new ApiError('PAYLOAD_TOO_LARGE', `Upload exceeds ${maxBytes} bytes.`, 413);
  }
  const contentType = request.headers.get('content-type') ?? '';
  if (multipart) {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new ApiError('INVALID_INPUT', 'Multipart field "file" is required.', 400);
    }
    if (file.size > maxBytes) throw new ApiError('PAYLOAD_TOO_LARGE', `Upload exceeds ${maxBytes} bytes.`, 413);
    const values = {};
    for (const [key, value] of form.entries()) {
      if (key !== 'file' && typeof value === 'string') values[key] = value;
    }
    return {
      ...values,
      fileName: file.name,
      mimeType: file.type,
      contentBase64: Buffer.from(await file.arrayBuffer()).toString('base64')
    };
  }
  return parseJson(request);
}

export function binaryResponse(asset, { disposition = 'inline', fileName = 'file' } = {}) {
  const safeName = String(fileName).replace(/["\r\n]/g, '_');
  return new Response(asset.content, {
    headers: {
      'content-type': asset.mimeType,
      'content-length': String(asset.byteLength),
      'content-disposition': `${disposition}; filename="${safeName}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox"
    }
  });
}
