CREATE INDEX IF NOT EXISTS idx_entity_state_communications_org ON entity_state(collection_key, organization_id) WHERE collection_key IN ('threads', 'messages');
