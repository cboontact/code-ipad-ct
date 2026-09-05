CREATE TABLE IF NOT EXISTS student_device_handovers (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  assignment_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETURNED', 'CANCELLED')),
  recipient_type TEXT CHECK (recipient_type IN ('STUDENT', 'GUARDIAN', 'OTHER')),
  recipient_name TEXT,
  serial_number TEXT,
  asset_number TEXT,
  handed_over_at TEXT,
  handed_over_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  returned_at TEXT,
  returned_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  return_history_id TEXT,
  note TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS student_device_handovers_status_idx
  ON student_device_handovers(status, handed_over_at DESC);

CREATE TABLE IF NOT EXISTS student_device_handover_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assignment_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('HANDOVER', 'RETURN', 'CANCEL')),
  recipient_type TEXT CHECK (recipient_type IN ('STUDENT', 'GUARDIAN', 'OTHER')),
  recipient_name TEXT,
  serial_number TEXT,
  asset_number TEXT,
  note TEXT,
  processed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS student_device_handover_events_created_idx
  ON student_device_handover_events(created_at DESC);

CREATE INDEX IF NOT EXISTS student_device_handover_events_student_idx
  ON student_device_handover_events(student_id, created_at DESC);
