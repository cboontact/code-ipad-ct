CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  room TEXT NOT NULL,
  class_number TEXT,
  birth_date TEXT NOT NULL,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_survey_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id),
  decision TEXT NOT NULL CHECK (decision IN ('ACCEPT','DECLINE')),
  pii_ciphertext TEXT,
  pii_iv TEXT,
  public_locked INTEGER NOT NULL DEFAULT 1 CHECK (public_locked IN (0,1)),
  privacy_acknowledged_at TEXT,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by_admin_id TEXT,
  admin_note TEXT
);

CREATE TABLE IF NOT EXISTS student_device_assignments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id),
  asset_number TEXT,
  serial_number TEXT,
  device_identifier TEXT,
  accessories TEXT,
  note TEXT,
  assigned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS students_class_idx ON students(grade_level, room);
CREATE INDEX IF NOT EXISTS student_responses_student_idx ON student_survey_responses(student_id);
CREATE INDEX IF NOT EXISTS student_responses_decision_idx ON student_survey_responses(decision);

UPDATE system_settings
SET value = 'ระบบลงทะเบียนรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง'
WHERE key = 'system_name'
  AND value = 'ระบบสำรวจความต้องการรับ iPad สำหรับครูโรงเรียนจอมทอง';

UPDATE system_settings
SET value = 'โปรดเลือกประเภทผู้ใช้งานเพื่อบันทึกความประสงค์รับ iPad'
WHERE key = 'announcement'
  AND value = 'โปรดเลือกกลุ่มสาระการเรียนรู้และชื่อของท่านเพื่อบันทึกความประสงค์';
