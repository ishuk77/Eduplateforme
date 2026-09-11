# ERD

```mermaid
erDiagram
  ORGANIZATION ||--o{ PERSON : rattache
  PERSON ||--o| ACCOUNT : authentifie
  ACCOUNT ||--o{ SESSION : ouvre
  ACCOUNT ||--o| MFA_SETTING : protege
  ORGANIZATION ||--o{ ROLE_ASSIGNMENT : limite
  PERSON ||--o{ ROLE_ASSIGNMENT : recoit
  ROLE ||--o{ ROLE_ASSIGNMENT : attribue
  ORGANIZATION ||--o{ PROGRAM : propose
  PROGRAM ||--o{ CLASS : structure
  PERSON ||--o| LEARNER : devient
  LEARNER ||--o{ ENROLLMENT : possede
  CLASS ||--o{ ENROLLMENT : accueille
  LEARNER ||--o{ GRADE : obtient
  LEARNER ||--o{ ATTENDANCE : produit
  ORGANIZATION ||--o{ SUPPORT_TICKET : gere
  SAAS_PLAN ||--o{ TENANT_SUBSCRIPTION : configure
  ORGANIZATION ||--o{ BACKUP_OPERATION : journalise
  ORGANIZATION ||--o{ AI_ASSISTANCE_REQUEST : audite
```

La persistance portable utilise `entity_state` et `entity_state_versions`; les tables spécialisées sont réservées aux credentials techniques (sessions, MFA, idempotence).
