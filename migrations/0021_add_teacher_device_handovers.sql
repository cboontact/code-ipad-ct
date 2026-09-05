CREATE TABLE IF NOT EXISTS teacher_device_handovers (
  teacher_id TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  assignment_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETURNED', 'CANCELLED')),
  handed_over_at TEXT,
  handed_over_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  returned_at TEXT,
  returned_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  return_history_id TEXT,
  serial_number TEXT,
  asset_number TEXT,
  note TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS teacher_device_handovers_status_idx
  ON teacher_device_handovers(status, handed_over_at DESC);

CREATE TABLE IF NOT EXISTS teacher_device_handover_events (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  assignment_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('HANDOVER', 'RETURN', 'CANCEL')),
  serial_number TEXT,
  asset_number TEXT,
  note TEXT,
  processed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS teacher_device_handover_events_created_idx
  ON teacher_device_handover_events(created_at DESC);

CREATE INDEX IF NOT EXISTS teacher_device_handover_events_teacher_idx
  ON teacher_device_handover_events(teacher_id, created_at DESC);
