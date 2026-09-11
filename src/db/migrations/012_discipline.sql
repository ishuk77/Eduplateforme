CREATE INDEX IF NOT EXISTS idx_entity_state_discipline_org ON entity_state(collection_key, organization_id) WHERE collection_key = 'disciplineRecords';
