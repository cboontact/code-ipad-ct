ALTER TABLE student_document_receipt_events RENAME TO student_document_receipt_events_old;

CREATE TABLE student_document_receipt_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'AWAT03',
  action TEXT NOT NULL CHECK (action IN ('RECEIVE', 'CANCEL', 'WITHDRAW')),
  note TEXT,
  processed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

INSERT INTO student_document_receipt_events
  (id,student_id,document_type,action,note,processed_by,created_at)
SELECT id,student_id,document_type,action,note,processed_by,created_at
FROM student_document_receipt_events_old;

DROP TABLE student_document_receipt_events_old;

CREATE INDEX student_document_receipt_events_created_idx
  ON student_document_receipt_events(created_at DESC);

CREATE INDEX student_document_receipt_events_student_idx
  ON student_document_receipt_events(student_id, document_type, created_at DESC);
