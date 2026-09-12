import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';

import { PlatformRecord } from '../domain/learning-systems/learning-systems.js';
import { ValidationError, createPermanentId } from '../shared/entity.js';

export const ASSET_LIMITS = Object.freeze({
  logo: 1024 * 1024,
  avatar: 2 * 1024 * 1024,
  signature: 1024 * 1024,
  evidence: 8 * 1024 * 1024
});

const EVIDENCE_TYPES = new Set(['receipt', 'report-card', 'certificate', 'attestation', 'diploma']);
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg']);
const EVIDENCE_MIMES = new Set([...IMAGE_MIMES, 'application/pdf']);

function normalizeFileName(fileName, fallbackExtension = '') {
  const leaf = basename(String(fileName ?? 'file')).normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return leaf || `file${fallbackExtension}`;
}

function detectMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

function imageDimensions(buffer, mimeType) {
  if (mimeType === 'image/png' && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (length < 2) break;
      offset += length + 2;
    }
  }
  throw new ValidationError('Image dimensions cannot be verified.');
}

export function validateAsset(input, kind) {
  const declaredMime = String(input.mimeType ?? '').toLowerCase();
  const limit = ASSET_LIMITS[kind];
  if (!limit) throw new ValidationError(`Unsupported asset kind: ${kind}.`);
  const encoded = String(input.contentBase64 ?? '');
  if (encoded.length > Math.ceil(limit * 4 / 3) + 8) {
    throw new ValidationError(`${kind} file exceeds ${limit} bytes.`);
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length === 0) throw new ValidationError('Uploaded file is empty.');
  if (buffer.length > limit) throw new ValidationError(`${kind} file exceeds ${limit} bytes.`);
  const detectedMime = detectMime(buffer);
  const allowed = kind === 'evidence' ? EVIDENCE_MIMES : IMAGE_MIMES;
  if (!detectedMime || declaredMime !== detectedMime || !allowed.has(detectedMime)) {
    throw new ValidationError(`File content does not match an allowed ${kind} MIME type.`);
  }
  if (detectedMime === 'image/png' && (!buffer.includes(Buffer.from('IHDR')) || !buffer.includes(Buffer.from('IEND')))) {
    throw new ValidationError('PNG structure is incomplete.');
  }
  if (detectedMime === 'image/jpeg' && (buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9)) {
    throw new ValidationError('JPEG structure is incomplete.');
  }
  if (detectedMime === 'application/pdf') {
    const sample = buffer.toString('latin1');
    if (!sample.includes('%%EOF')) throw new ValidationError('PDF structure is incomplete.');
    if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/i.test(sample)) {
      throw new ValidationError('Active or embedded PDF content is not accepted.');
    }
  }
  let dimensions = null;
  if (IMAGE_MIMES.has(detectedMime)) {
    dimensions = imageDimensions(buffer, detectedMime);
    if (dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 4096 || dimensions.height > 4096) {
      throw new ValidationError('Image dimensions must be between 1×1 and 4096×4096 pixels.');
    }
  }
  return {
    buffer,
    mimeType: detectedMime,
    byteLength: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    fileName: normalizeFileName(input.fileName, detectedMime === 'application/pdf' ? '.pdf' : '.png'),
    dimensions
  };
}

export function assertEvidenceType(type) {
  const normalized = String(type ?? '').trim().toLowerCase();
  if (!EVIDENCE_TYPES.has(normalized) && !/^custom:[a-z0-9][a-z0-9-]{1,39}$/.test(normalized)) {
    throw new ValidationError('Evidence type must be receipt, report-card, certificate, attestation, diploma, or custom:<type>.');
  }
  return normalized;
}

export function saveBlob(service, { assetId = createPermanentId(), organizationId, asset, actorId }) {
  const persistence = service.connection.run(
    `INSERT INTO secure_asset_blobs(asset_id, organization_id, mime_type, byte_length, sha256, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET
       organization_id = excluded.organization_id,
       mime_type = excluded.mime_type,
       byte_length = excluded.byte_length,
       sha256 = excluded.sha256,
       content = excluded.content,
       created_at = excluded.created_at`,
    [assetId, organizationId, asset.mimeType, asset.byteLength, asset.sha256, asset.buffer.toString('base64'), new Date().toISOString()]
  );
  const audit = service.writeAuditEntry({
    actorId,
    organizationId,
    entityType: 'SecureAsset',
    entityId: assetId,
    action: 'secure-asset.store',
    after: { mimeType: asset.mimeType, byteLength: asset.byteLength, sha256: asset.sha256 }
  });
  if (persistence instanceof Promise || audit instanceof Promise) {
    return Promise.all([persistence, audit]).then(() => assetId);
  }
  return assetId;
}

export async function readBlob(service, assetId, organizationId) {
  const row = await service.connection.get(
    'SELECT asset_id, organization_id, mime_type, byte_length, sha256, content FROM secure_asset_blobs WHERE asset_id = ? AND organization_id = ?',
    [assetId, organizationId]
  );
  if (!row) throw new ValidationError('Asset not found in the active organization.');
  return {
    id: row.asset_id,
    organizationId: row.organization_id,
    mimeType: row.mime_type,
    byteLength: Number(row.byte_length),
    sha256: row.sha256,
    content: Buffer.from(String(row.content), 'base64')
  };
}

export function deleteBlob(service, assetId, organizationId) {
  return service.connection.run(
    'DELETE FROM secure_asset_blobs WHERE asset_id = ? AND organization_id = ?',
    [assetId, organizationId]
  );
}

export function createAssetRecord(input) {
  return new PlatformRecord(input);
}
