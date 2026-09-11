CREATE INDEX IF NOT EXISTS idx_entity_state_finance_org ON entity_state(collection_key, organization_id) WHERE collection_key IN ('fees', 'invoices', 'payments');
