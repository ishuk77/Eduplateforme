import { randomUUID } from 'node:crypto';

export class SqlRepository {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  create(payload) {
    const now = new Date().toISOString();
    const record = {
      id: payload.id ?? randomUUID(),
      created_at: now,
      updated_at: now,
      ...payload
    };

    if (this.config.required) {
      for (const key of this.config.required) {
        if (record[key] === undefined || record[key] === null) {
          throw new Error(`${this.config.table}: missing required field ${key}`);
        }
      }
    }

    const columns = this.config.columns;
    const placeholders = columns.map((column) => `@${column}`).join(', ');
    const statement = this.db.prepare(
      `INSERT INTO ${this.config.table} (${columns.join(', ')}) VALUES (${placeholders})`
    );

    statement.run(record);
    return this.findById(record.id);
  }

  findById(id) {
    return this.db.prepare(`SELECT * FROM ${this.config.table} WHERE id = ?`).get(id) ?? null;
  }

  list() {
    return this.db.prepare(`SELECT * FROM ${this.config.table}`).all();
  }
}
