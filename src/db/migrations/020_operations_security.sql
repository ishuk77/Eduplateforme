CREATE TABLE IF NOT EXISTS mfa_settings (
  account_id TEXT PRIMARY KEY,
  encrypted_secret TEXT NOT NULL,
  recovery_hashes TEXT NOT NULL,
  pending_encrypted_secret TEXT,
  pending_recovery_hashes TEXT,
  state TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  confirmed_at TEXT,
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS offline_mutations (
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  entity_id TEXT,
  result_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS operation_metrics (
  metric_key TEXT PRIMARY KEY,
  metric_value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
