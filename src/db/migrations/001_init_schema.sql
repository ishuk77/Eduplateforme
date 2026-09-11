CREATE TABLE IF NOT EXISTS entity_state (
  collection_key TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  organization_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (collection_key, entity_id)
);

CREATE TABLE IF NOT EXISTS entity_state_versions (
  collection_key TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  organization_id TEXT,
  action TEXT NOT NULL,
  actor_id TEXT,
  payload TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY (collection_key, entity_id, version)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
