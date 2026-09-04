CREATE TABLE IF NOT EXISTS student_document_receipts (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'AWAT03',
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'CANCELLED')),
  received_at TEXT,
  received_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, document_type)
);

CREATE INDEX IF NOT EXISTS student_document_receipts_status_idx
  ON student_document_receipts(document_type, status, received_at DESC);

CREATE TABLE IF NOT EXISTS student_document_receipt_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'AWAT03',
  action TEXT NOT NULL CHECK (action IN ('RECEIVE', 'CANCEL')),
  note TEXT,
  processed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS student_document_receipt_events_created_idx
  ON student_document_receipt_events(created_at DESC);

CREATE INDEX IF NOT EXISTS student_document_receipt_events_student_idx
  ON student_document_receipt_events(student_id, document_type, created_at DESC);
