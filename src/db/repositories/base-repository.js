import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function normalizePaging({ limit = 25, offset = 0 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  const normalizedOffset = Math.max(0, Number(offset) || 0);
  return { limit: normalizedLimit, offset: normalizedOffset };
}

function normalizeStoredValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeStoredValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeStoredValue(nestedValue)])
    );
  }

  return value;
}

let encryptionKey = null;

function createEncryptionKey() {
  if (encryptionKey) {
    return encryptionKey;
  }

  if (process.env.DATA_ENCRYPTION_KEY) {
    encryptionKey = createHash('sha256').update(process.env.DATA_ENCRYPTION_KEY).digest();
    return encryptionKey;
  }

  encryptionKey = randomBytes(32);
  return encryptionKey;
}

function encodePayload(payload, sensitive) {
  const plainText = JSON.stringify(normalizeStoredValue(payload));
  if (!sensitive) {
    return plainText;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decodePayload(value, sensitive) {
  if (!sensitive || !String(value).startsWith('enc:')) {
    return JSON.parse(value);
  }

  const [, encoded] = value.split('enc:');
  const [ivValue, tagValue, payloadValue] = encoded.split('.');
  const decipher = createDecipheriv('aes-256-gcm', createEncryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const plainText = Buffer.concat([
    decipher.update(Buffer.from(payloadValue, 'base64url')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plainText);
}

export class BaseRepository {
  constructor({ connection, collectionKey, keyField = 'id', sensitive = false }) {
    this.connection = connection;
    this.collectionKey = collectionKey;
    this.keyField = keyField;
    this.sensitive = sensitive;
  }

  loadAll() {
    const rows = this.connection.all(
      `SELECT payload FROM entity_state WHERE collection_key = ? ORDER BY updated_at ASC`,
      [this.collectionKey]
    );
    if (rows instanceof Promise) {
      return rows.then((resolvedRows) => resolvedRows.map((row) => decodePayload(row.payload, this.sensitive)));
    }
    return rows.map((row) => decodePayload(row.payload, this.sensitive));
  }

  get(id) {
    const row = this.connection.get(
      'SELECT payload FROM entity_state WHERE collection_key = ? AND entity_id = ?',
      [this.collectionKey, id]
    );
    if (row instanceof Promise) {
      return row.then((resolvedRow) => resolvedRow ? decodePayload(resolvedRow.payload, this.sensitive) : null);
    }
    return row ? decodePayload(row.payload, this.sensitive) : null;
  }

  list({ organizationId, limit, offset, includeArchived = false } = {}) {
    const { limit: normalizedLimit, offset: normalizedOffset } = normalizePaging({ limit, offset });
    const conditions = ['collection_key = ?'];
    const params = [this.collectionKey];
    if (organizationId) {
      conditions.push('organization_id = ?');
      params.push(organizationId);
    }
    if (!includeArchived) {
      conditions.push("status <> 'archived'");
    }

    if (this.connection.isAsync) {
      return Promise.all([
        this.connection.get(
          `SELECT COUNT(*) AS total FROM entity_state WHERE ${conditions.join(' AND ')}`,
          params
        ),
        this.connection.all(
          `SELECT payload FROM entity_state WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
          [...params, normalizedLimit, normalizedOffset]
        )
      ]).then(([totalRow, rows]) => ({
        items: rows.map((row) => decodePayload(row.payload, this.sensitive)),
        page: {
          total: Number(totalRow?.total ?? 0),
          limit: normalizedLimit,
          offset: normalizedOffset
        }
      }));
    }

    const totalRow = this.connection.get(
      `SELECT COUNT(*) AS total FROM entity_state WHERE ${conditions.join(' AND ')}`,
      params
    );
    const rows = this.connection.all(
      `SELECT payload FROM entity_state WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [...params, normalizedLimit, normalizedOffset]
    );

    return {
      items: rows.map((row) => decodePayload(row.payload, this.sensitive)),
      page: {
        total: Number(totalRow?.total ?? 0),
        limit: normalizedLimit,
        offset: normalizedOffset
      }
    };
  }

  history(id, { limit, offset } = {}) {
    const { limit: normalizedLimit, offset: normalizedOffset } = normalizePaging({ limit: limit ?? 50, offset });
    if (this.connection.isAsync) {
      return Promise.all([
        this.connection.get(
          'SELECT COUNT(*) AS total FROM entity_state_versions WHERE collection_key = ? AND entity_id = ?',
          [this.collectionKey, id]
        ),
        this.connection.all(
          `SELECT version, action, actor_id, changed_at, payload
           FROM entity_state_versions
           WHERE collection_key = ? AND entity_id = ?
           ORDER BY version DESC
           LIMIT ? OFFSET ?`,
          [this.collectionKey, id, normalizedLimit, normalizedOffset]
        )
      ]).then(([totalRow, rows]) => this.formatHistory(totalRow, rows, normalizedLimit, normalizedOffset));
    }

    const totalRow = this.connection.get(
      'SELECT COUNT(*) AS total FROM entity_state_versions WHERE collection_key = ? AND entity_id = ?',
      [this.collectionKey, id]
    );
    const rows = this.connection.all(
      `SELECT version, action, actor_id, changed_at, payload
       FROM entity_state_versions
       WHERE collection_key = ? AND entity_id = ?
       ORDER BY version DESC
       LIMIT ? OFFSET ?`,
      [this.collectionKey, id, normalizedLimit, normalizedOffset]
    );

    return this.formatHistory(totalRow, rows, normalizedLimit, normalizedOffset);
  }

  formatHistory(totalRow, rows, normalizedLimit, normalizedOffset) {
    return {
      items: rows.map((row) => ({
        version: Number(row.version),
        action: row.action,
        actorId: row.actor_id,
        changedAt: row.changed_at,
        snapshot: decodePayload(row.payload, this.sensitive)
      })),
      page: {
        total: Number(totalRow?.total ?? 0),
        limit: normalizedLimit,
        offset: normalizedOffset
      }
    };
  }

  upsert(record, { actorId = null, action = 'upsert' } = {}) {
    const entityId = record[this.keyField];
    if (!entityId) {
      throw new Error(`Repository ${this.collectionKey} expected key field ${this.keyField}.`);
    }

    const createdAt = normalizeStoredValue(record.createdAt ?? new Date().toISOString());
    const updatedAt = normalizeStoredValue(record.updatedAt ?? new Date().toISOString());
    const payload = encodePayload(record, this.sensitive);

    if (this.connection.isAsync) {
      return this.connection.upsertEntity({
        collectionKey: this.collectionKey,
        entityId,
        organizationId: record.organizationId ?? null,
        status: record.status ?? 'active',
        payload,
        actorId,
        action,
        createdAt,
        updatedAt,
        deletedAt: normalizeStoredValue(record.archivedAt ?? null)
      }).then(() => record);
    }

    const current = this.connection.get(
      'SELECT version, created_at FROM entity_state WHERE collection_key = ? AND entity_id = ?',
      [this.collectionKey, entityId]
    );
    const version = Number(current?.version ?? 0) + 1;
    const effectiveCreatedAt = normalizeStoredValue(record.createdAt ?? current?.created_at ?? createdAt);

    this.connection.run(
      `INSERT INTO entity_state(collection_key, entity_id, organization_id, status, payload, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(collection_key, entity_id) DO UPDATE SET
         organization_id = excluded.organization_id,
         status = excluded.status,
         payload = excluded.payload,
         version = excluded.version,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at`,
      [
        this.collectionKey,
        entityId,
        record.organizationId ?? null,
        record.status ?? 'active',
        payload,
        version,
        effectiveCreatedAt,
        updatedAt,
        normalizeStoredValue(record.archivedAt ?? null)
      ]
    );

    this.connection.run(
      `INSERT INTO entity_state_versions(collection_key, entity_id, version, organization_id, action, actor_id, payload, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.collectionKey,
        entityId,
        version,
        record.organizationId ?? null,
        action,
        actorId,
        payload,
        updatedAt
      ]
    );

    return record;
  }
}

export function createCollectionRepository(connection, options) {
  return new BaseRepository({ connection, ...options });
}
