import { resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';

import { ValidationError } from '../shared/errors.js';

export function normalizeCustomDomain(value, platformHost = null) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) throw new ValidationError('domain is required.');
  let hostname;
  try {
    const candidate = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    if (candidate.username || candidate.password || candidate.port || candidate.pathname !== '/' || candidate.search || candidate.hash) {
      throw new Error('components');
    }
    hostname = candidate.hostname.replace(/\.$/, '').toLowerCase();
  } catch {
    throw new ValidationError('domain must be a hostname without a path, query, credentials, or port.');
  }
  if (!hostname.includes('.') || hostname === 'localhost' || isIP(hostname)) {
    throw new ValidationError('domain must be a public DNS hostname.');
  }
  if (platformHost && hostname === String(platformHost).split(':')[0].toLowerCase()) {
    throw new ValidationError('The shared platform hostname cannot be registered as a tenant domain.');
  }
  return hostname;
}

export function domainVerificationInstructions(domain, token) {
  return {
    recordType: 'TXT',
    name: `_eduplateforme.${domain}`,
    value: `eduplateforme-verification=${token}`,
    routing: {
      recordType: 'CNAME',
      name: domain,
      target: process.env.RENDER_EXTERNAL_HOSTNAME ?? 'eduplateforme-yrgs.onrender.com'
    },
    note: 'DNS and the Render custom-domain/TLS configuration remain external infrastructure steps. Verification does not move or duplicate tenant data.'
  };
}

export async function verifyDomainTxt(domain, token) {
  const records = await resolveTxt(`_eduplateforme.${domain}`);
  const expected = `eduplateforme-verification=${token}`;
  return records.some((parts) => parts.join('') === expected);
}
