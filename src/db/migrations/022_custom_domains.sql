CREATE INDEX IF NOT EXISTS idx_entity_state_custom_domains_org
  ON entity_state(collection_key, organization_id)
  WHERE collection_key = 'customDomains';

CREATE TABLE IF NOT EXISTS custom_domain_claims (
  domain TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
