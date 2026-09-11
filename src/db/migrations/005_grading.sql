CREATE INDEX IF NOT EXISTS idx_entity_state_grades_org ON entity_state(collection_key, organization_id) WHERE collection_key = 'grades';
