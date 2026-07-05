-- Waldrick Medical Records — initial schema
-- Generic, member-scoped health records. "Immunizations" are simply records whose
-- record_type.key = 'immunization'; any other type (medications, allergies, labs, …)
-- works the same way, so new categories need no schema change.

CREATE TABLE family_members (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  date_of_birth  TEXT,               -- ISO date (YYYY-MM-DD)
  sex            TEXT,
  blood_type     TEXT,
  relationship   TEXT,               -- self, spouse, child, ...
  notes          TEXT,
  photo_r2_key   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- Extensible categories of records. Seeded in 0002; users can add more.
CREATE TABLE record_types (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,  -- machine key, e.g. 'immunization'
  label        TEXT NOT NULL,         -- display, e.g. 'Immunization'
  icon         TEXT,                  -- Material icon name
  schema_json  TEXT,                  -- optional JSON array of extra field descriptors
  is_system    INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- A single health event/record for a family member.
CREATE TABLE records (
  id                TEXT PRIMARY KEY,
  family_member_id  TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  record_type_id    TEXT NOT NULL REFERENCES record_types(id),
  title             TEXT NOT NULL,     -- e.g. vaccine/med name ("MMR")
  event_date        TEXT,              -- date received / date of event
  provider          TEXT,              -- doctor / clinic
  location          TEXT,              -- where administered
  status            TEXT,              -- optional free status
  data_json         TEXT,              -- type-specific fields (dose #, lot #, ...)
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Things that are due / need doing (the "immunization schedule", checkups, refills, ...).
CREATE TABLE schedule_items (
  id                  TEXT PRIMARY KEY,
  family_member_id    TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  record_type_id      TEXT REFERENCES record_types(id),
  title               TEXT NOT NULL,
  due_date            TEXT,            -- ISO date
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | done | skipped
  recurrence          TEXT,            -- free text/ISO-8601 duration, optional
  completed_record_id TEXT REFERENCES records(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- Uploaded documents. Bytes live in R2; this table holds metadata + the R2 key.
CREATE TABLE documents (
  id                TEXT PRIMARY KEY,
  family_member_id  TEXT REFERENCES family_members(id) ON DELETE CASCADE,
  record_id         TEXT REFERENCES records(id) ON DELETE SET NULL,
  r2_key            TEXT NOT NULL UNIQUE,
  filename          TEXT NOT NULL,
  content_type      TEXT,
  size_bytes        INTEGER,
  uploaded_by       TEXT,              -- email from the Access identity
  uploaded_at       TEXT NOT NULL
);

-- Manually-created alerts. Schedule-derived alerts are computed at read time
-- (see worker/routes/alerts.ts) and are not stored here.
CREATE TABLE alerts (
  id                TEXT PRIMARY KEY,
  family_member_id  TEXT REFERENCES family_members(id) ON DELETE CASCADE,
  severity          TEXT NOT NULL DEFAULT 'info',   -- info | warning | urgent
  title             TEXT NOT NULL,
  message           TEXT,
  due_date          TEXT,
  source            TEXT NOT NULL DEFAULT 'manual',  -- manual
  status            TEXT NOT NULL DEFAULT 'active',  -- active | dismissed | resolved
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX idx_records_member       ON records(family_member_id);
CREATE INDEX idx_records_type         ON records(record_type_id);
CREATE INDEX idx_schedule_member      ON schedule_items(family_member_id);
CREATE INDEX idx_schedule_status_due  ON schedule_items(status, due_date);
CREATE INDEX idx_documents_member     ON documents(family_member_id);
CREATE INDEX idx_documents_record     ON documents(record_id);
CREATE INDEX idx_alerts_member        ON alerts(family_member_id);
CREATE INDEX idx_alerts_status        ON alerts(status);
