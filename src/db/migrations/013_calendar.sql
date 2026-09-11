CREATE INDEX IF NOT EXISTS idx_entity_state_calendar_org ON entity_state(collection_key, organization_id) WHERE collection_key = 'calendarEvents';
