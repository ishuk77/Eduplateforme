CREATE TABLE IF NOT EXISTS audit_trail (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_payload TEXT,
  after_payload TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_org_created ON audit_trail(organization_id, created_at DESC);
