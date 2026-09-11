CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, email),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, username),
  UNIQUE (person_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  FOREIGN KEY (person_id, organization_id) REFERENCES people(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  role_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, role_key),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  user_account_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (role_id, user_account_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  FOREIGN KEY (role_id, organization_id) REFERENCES roles(id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_account_id, organization_id) REFERENCES user_accounts(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, name),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, code),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  program_id TEXT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, code),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  FOREIGN KEY (academic_year_id, organization_id) REFERENCES academic_years(id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (program_id, organization_id) REFERENCES programs(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  status TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  withdrawn_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, class_id, person_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  FOREIGN KEY (class_id, organization_id) REFERENCES classes(id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (person_id, organization_id) REFERENCES people(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  person_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  uri TEXT NOT NULL,
  issued_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, organization_id, person_id),
  UNIQUE (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  FOREIGN KEY (person_id, organization_id) REFERENCES people(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  document_id TEXT,
  kind TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  FOREIGN KEY (person_id, organization_id) REFERENCES people(id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (document_id, organization_id, person_id) REFERENCES documents(id, organization_id, person_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_people_org ON people (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON user_accounts (organization_id);
CREATE INDEX IF NOT EXISTS idx_classes_org ON classes (organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_org ON enrollments (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id);
