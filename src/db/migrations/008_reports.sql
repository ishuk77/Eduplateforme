CREATE INDEX IF NOT EXISTS idx_entity_state_reports_org ON entity_state(collection_key, organization_id) WHERE collection_key = 'reportCards';
