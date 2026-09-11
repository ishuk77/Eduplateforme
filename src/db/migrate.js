import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase, resolveDatabasePath } from './connection.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

export function runMigrations(db) {
  const schemaPath = resolve(currentDir, 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

export function migrateDatabase(options = {}) {
  const filename = resolveDatabasePath(options.filename);
  const db = openDatabase({ filename });

  runMigrations(db);
  return { db, filename };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { db, filename } = migrateDatabase({ filename: process.env.DATABASE_PATH });
  db.close();
  console.log(`Database migrated: ${filename}`);
}
