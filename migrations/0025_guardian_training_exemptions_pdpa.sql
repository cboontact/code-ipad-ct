CREATE TABLE IF NOT EXISTS guardian_training_exemptions (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  reason TEXT,
  exempted_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  exempted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS guardian_training_exemptions_date_idx
  ON guardian_training_exemptions(exempted_at DESC);

ALTER TABLE guardian_training_assignments ADD COLUMN consent_version TEXT;
ALTER TABLE guardian_training_assignments ADD COLUMN consent_user_agent TEXT;
