CREATE TABLE IF NOT EXISTS device_return_history (
  id TEXT PRIMARY KEY,
  holder_type TEXT NOT NULL CHECK (holder_type IN ('TEACHER','STUDENT')),
  holder_id TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  holder_code TEXT,
  holder_context TEXT,
  serial_number TEXT,
  asset_number TEXT,
  device_identifier TEXT,
  accessories TEXT,
  assignment_note TEXT,
  returned_at TEXT NOT NULL,
  device_condition TEXT NOT NULL CHECK (device_condition IN ('GOOD','DAMAGED','INCOMPLETE','OTHER')),
  return_note TEXT,
  processed_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS device_return_history_returned_idx
  ON device_return_history(returned_at DESC);

CREATE INDEX IF NOT EXISTS device_return_history_holder_idx
  ON device_return_history(holder_type, holder_id);
