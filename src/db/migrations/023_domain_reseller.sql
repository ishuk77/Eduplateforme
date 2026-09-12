CREATE INDEX IF NOT EXISTS idx_entity_state_domain_reseller_org
  ON entity_state(collection_key, organization_id)
  WHERE collection_key IN ('domainQuotes', 'domainOrders');

CREATE INDEX IF NOT EXISTS idx_entity_state_domain_catalog
  ON entity_state(collection_key, entity_id)
  WHERE collection_key = 'domainTldCatalog';
