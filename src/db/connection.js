import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export function resolveDatabasePath(providedPath) {
  return providedPath ?? resolve(process.cwd(), 'data', 'eduplateforme.sqlite');
}

export function openDatabase(options = {}) {
  const filename = resolveDatabasePath(options.filename);
  mkdirSync(dirname(filename), { recursive: true });

  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  return db;
}
