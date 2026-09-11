CREATE INDEX IF NOT EXISTS idx_entity_state_assignments_org ON entity_state(collection_key, organization_id) WHERE collection_key IN ('assignments', 'assignmentSubmissions');
