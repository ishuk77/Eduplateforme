CREATE TABLE IF NOT EXISTS secure_asset_blobs (
  asset_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_secure_asset_blobs_org
  ON secure_asset_blobs(organization_id, created_at DESC);
