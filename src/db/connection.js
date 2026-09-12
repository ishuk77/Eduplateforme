import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const currentDirectoryPath = dirname(fileURLToPath(import.meta.url));
const migrationsDirectoryPath = join(currentDirectoryPath, 'migrations');
const LOCAL_DATABASE_URL = 'sqlite:./data/eduplateforme.sqlite';

export function resolveDatabaseUrl(env = process.env) {
  const databaseUrl = env.DATABASE_URL ?? env.DB_URL;
  if (databaseUrl) {
    return databaseUrl;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production.');
  }
  return LOCAL_DATABASE_URL;
}

function resolveSqliteFilename(databaseUrl) {
  if (databaseUrl === 'sqlite::memory:') {
    return ':memory:';
  }
  const filename = databaseUrl.slice('sqlite:'.length);
  return resolve(filename);
}

function createSqliteConnection(databaseUrl) {
  const filename = resolveSqliteFilename(databaseUrl);
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const database = new DatabaseSync(filename);
  let transactionDepth = 0;
  database.exec('PRAGMA foreign_keys = ON;');
  try {
    database.exec('PRAGMA journal_mode = WAL;');
  } catch {
    // In-memory databases do not support WAL.
  }

  const connection = {
    dialect: 'sqlite',
    url: databaseUrl,
    isAsync: false,
    exec(sql) {
      database.exec(sql);
    },
    get(sql, params = []) {
      return database.prepare(sql).get(...params) ?? null;
    },
    all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    run(sql, params = []) {
      return database.prepare(sql).run(...params);
    },
    transaction(callback) {
      if (transactionDepth > 0) {
        return callback();
      }
      database.exec('BEGIN');
      transactionDepth += 1;
      try {
        const result = callback();
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
    ping() {
      database.prepare('SELECT 1').get();
      return true;
    },
    close() {
      database.close();
    }
  };

  migrateSqliteDatabase(connection);
  return connection;
}

function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function migratePostgresDatabase(pool) {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
  );
  const migrationFiles = readdirSync(migrationsDirectoryPath)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  for (const fileName of migrationFiles) {
    const alreadyApplied = await pool.query('SELECT version FROM schema_migrations WHERE version = $1', [fileName]);
    if (alreadyApplied.rowCount > 0) {
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(readFileSync(join(migrationsDirectoryPath, fileName), 'utf8'));
      await client.query(
        'INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT(version) DO NOTHING',
        [fileName]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`PostgreSQL migration ${fileName} failed: ${error.message}`, { cause: error });
    } finally {
      client.release();
    }
  }
}

export async function createPostgresConnection(databaseUrl, options = {}) {
  const Pool = options.Pool ?? (await import('pg')).Pool;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number.parseInt(process.env.PG_POOL_MAX ?? '10', 10),
    connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECT_TIMEOUT_MS ?? '10000', 10)
  });
  await pool.query('SELECT 1');
  await migratePostgresDatabase(pool);

  const transactionStorage = new AsyncLocalStorage();
  const query = (sql, params = [], client = transactionStorage.getStore()?.client ?? pool) =>
    client.query(convertPlaceholders(sql), params);
  const schedule = (operation) => {
    const transaction = transactionStorage.getStore();
    if (!transaction) {
      return operation(pool);
    }
    transaction.pending = transaction.pending.then(() => operation(transaction.client));
    return transaction.pending;
  };

  const connection = {
    dialect: 'postgres',
    url: databaseUrl,
    isAsync: true,
    async exec(sql) {
      await query(sql);
    },
    async get(sql, params = []) {
      const result = await query(sql, params);
      return result.rows[0] ?? null;
    },
    async all(sql, params = []) {
      const result = await query(sql, params);
      return result.rows;
    },
    async run(sql, params = []) {
      return schedule((client) => client.query(convertPlaceholders(sql), params));
    },
    async transaction(callback) {
      if (transactionStorage.getStore()) {
        return callback();
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const transaction = { client, pending: Promise.resolve() };
        const result = await transactionStorage.run(transaction, callback);
        await transaction.pending;
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    upsertEntity({
      collectionKey,
      entityId,
      organizationId,
      status,
      payload,
      actorId,
      action,
      createdAt,
      updatedAt,
      deletedAt
    }) {
      return schedule(async (client) => {
        const current = await client.query(
          'SELECT version, created_at FROM entity_state WHERE collection_key = $1 AND entity_id = $2',
          [collectionKey, entityId]
        );
        const version = Number(current.rows[0]?.version ?? 0) + 1;
        const effectiveCreatedAt = createdAt ?? current.rows[0]?.created_at ?? updatedAt;
        await client.query(
          `INSERT INTO entity_state(
             collection_key, entity_id, organization_id, status, payload, version, created_at, updated_at, deleted_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT(collection_key, entity_id) DO UPDATE SET
             organization_id = EXCLUDED.organization_id,
             status = EXCLUDED.status,
             payload = EXCLUDED.payload,
             version = EXCLUDED.version,
             created_at = EXCLUDED.created_at,
             updated_at = EXCLUDED.updated_at,
             deleted_at = EXCLUDED.deleted_at`,
          [
            collectionKey,
            entityId,
            organizationId,
            status,
            payload,
            version,
            effectiveCreatedAt,
            updatedAt,
            deletedAt
          ]
        );
        await client.query(
          `INSERT INTO entity_state_versions(
             collection_key, entity_id, version, organization_id, action, actor_id, payload, changed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [collectionKey, entityId, version, organizationId, action, actorId, payload, updatedAt]
        );
      });
    },
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
    async close() {
      await pool.end();
    }
  };

  return connection;
}

export async function openDatabaseConnection({ url = resolveDatabaseUrl() } = {}) {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return createPostgresConnection(url);
  }
  if (!url.startsWith('sqlite:')) {
    throw new Error('DATABASE_URL must use the postgres:, postgresql:, or sqlite: scheme.');
  }
  return createSqliteConnection(url);
}

export function createDatabaseConnection({ url = resolveDatabaseUrl() } = {}) {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    throw new Error('PostgreSQL requires asynchronous initialization with openDatabaseConnection().');
  }
  if (!url.startsWith('sqlite:')) {
    throw new Error('DB_URL must use the sqlite: scheme for synchronous local initialization.');
  }
  return createSqliteConnection(url);
}

export function migrateSqliteDatabase(connection) {
  const migrationFiles = readdirSync(migrationsDirectoryPath)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  connection.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  );
  for (const fileName of migrationFiles) {
    const alreadyApplied = connection.get('SELECT version FROM schema_migrations WHERE version = ?', [fileName]);
    if (alreadyApplied) {
      continue;
    }
    connection.exec(readFileSync(join(migrationsDirectoryPath, fileName), 'utf8'));
    connection.run('INSERT INTO schema_migrations(version) VALUES (?)', [fileName]);
  }
}

export { LOCAL_DATABASE_URL };
