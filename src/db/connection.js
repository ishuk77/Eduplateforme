import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const currentDirectoryPath = dirname(fileURLToPath(import.meta.url));
const migrationsDirectoryPath = join(currentDirectoryPath, 'migrations');
const DEFAULT_DATABASE_URL = process.env.DB_URL ?? 'sqlite:/tmp/eduplateforme/eduplateforme.sqlite';

function resolveSqliteFilename(databaseUrl) {
  if (databaseUrl === 'sqlite::memory:') {
    return ':memory:';
  }

  if (databaseUrl.startsWith('sqlite:')) {
    return databaseUrl.slice('sqlite:'.length);
  }

  return databaseUrl;
}

function createSqliteConnection(databaseUrl) {
  const filename = resolveSqliteFilename(databaseUrl);
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON;');
  try {
    database.exec('PRAGMA journal_mode = WAL;');
  } catch {
    // ignore when SQLite refuses WAL (for example in-memory databases)
  }

  const connection = {
    dialect: 'sqlite',
    url: databaseUrl,
    database,
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
      database.exec('BEGIN');
      try {
        const result = callback(connection);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
  };

  migrateDatabase(connection);
  return connection;
}

export async function createPostgresConnection(databaseUrl = DEFAULT_DATABASE_URL) {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  const connection = {
    dialect: 'postgres',
    url: databaseUrl,
    pool,
    async exec(sql) {
      await pool.query(sql);
    },
    async get(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows[0] ?? null;
    },
    async all(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    async run(sql, params = []) {
      return pool.query(sql, params);
    }
  };

  const migrationFiles = readdirSync(migrationsDirectoryPath)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();
  await connection.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for (const fileName of migrationFiles) {
    const alreadyApplied = await connection.get('SELECT version FROM schema_migrations WHERE version = $1', [fileName]);
    if (alreadyApplied) {
      continue;
    }

    const sql = readFileSync(join(migrationsDirectoryPath, fileName), 'utf8');
    await connection.exec(sql);
    await connection.run('INSERT INTO schema_migrations(version) VALUES ($1)', [fileName]);
  }

  return connection;
}

export function createDatabaseConnection({ url = DEFAULT_DATABASE_URL } = {}) {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    throw new Error('PostgreSQL connections must be initialized with createPostgresConnection().');
  }

  return createSqliteConnection(url);
}

export function migrateDatabase(connection) {
  const migrationFiles = readdirSync(migrationsDirectoryPath)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  connection.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');

  for (const fileName of migrationFiles) {
    const alreadyApplied = connection.get('SELECT version FROM schema_migrations WHERE version = ?', [fileName]);
    if (alreadyApplied) {
      continue;
    }

    const sql = readFileSync(join(migrationsDirectoryPath, fileName), 'utf8');
    connection.exec(sql);
    connection.run('INSERT INTO schema_migrations(version) VALUES (?)', [fileName]);
  }
}

export { DEFAULT_DATABASE_URL };
