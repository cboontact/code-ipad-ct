-- Source: migrations/0000_initial.sql
PRAGMA foreign_keys = ON;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS learning_areas (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'book-open', sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS teachers (id TEXT PRIMARY KEY, teacher_code TEXT UNIQUE, prefix TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, learning_area_id TEXT NOT NULL REFERENCES learning_areas(id), position TEXT, academic_rank TEXT, email TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS survey_responses (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL UNIQUE REFERENCES teachers(id), decision TEXT NOT NULL CHECK (decision IN ('ACCEPT','DECLINE')), pii_ciphertext TEXT, pii_iv TEXT, public_locked INTEGER NOT NULL DEFAULT 1 CHECK (public_locked IN (0,1)), privacy_acknowledged_at TEXT, submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by_admin_id TEXT, admin_note TEXT);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS device_assignments (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL UNIQUE REFERENCES teachers(id), asset_number TEXT, serial_number TEXT, device_identifier TEXT, accessories TEXT, note TEXT, assigned_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('superadmin','admin')), is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, session_token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS project_documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, original_filename TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp','image/gif')), size_bytes INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), uploaded_by TEXT NOT NULL REFERENCES admin_users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, admin_id TEXT REFERENCES admin_users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, description TEXT NOT NULL, before_data TEXT, after_data TEXT, created_at TEXT NOT NULL);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started_at INTEGER NOT NULL);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS teachers_learning_area_idx ON teachers(learning_area_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS survey_responses_teacher_idx ON survey_responses(teacher_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS survey_responses_decision_idx ON survey_responses(decision);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS project_documents_active_sort_idx ON project_documents(is_active, sort_order);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

--> statement-breakpoint

-- Source: migrations/0001_add_management_area.sql
INSERT OR IGNORE INTO learning_areas (
  id,
  code,
  name,
  icon,
  sort_order,
  is_active,
  created_at,
  updated_at
) VALUES (
  'management',
  'MANAGEMENT',
  'ฝ่ายบริหาร',
  'user-tie',
  10,
  1,
  datetime('now'),
  datetime('now')
);

--> statement-breakpoint

-- Source: migrations/0002_generate_teacher_codes.sql
UPDATE teachers
SET teacher_code = 'CT-' || upper(hex(randomblob(5))),
    updated_at = datetime('now')
WHERE teacher_code IS NULL OR trim(teacher_code) = '';

--> statement-breakpoint

-- Source: migrations/0003_add_teacher_ndlp_email.sql
ALTER TABLE teachers ADD COLUMN ndlp_email TEXT;

--> statement-breakpoint

-- Source: migrations/0004_add_teacher_phone.sql
ALTER TABLE teachers ADD COLUMN phone TEXT;

--> statement-breakpoint

-- Source: migrations/0005_add_students.sql
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

--> statement-breakpoint

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

--> statement-breakpoint

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

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS students_class_idx ON students(grade_level, room);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_responses_student_idx ON student_survey_responses(student_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_responses_decision_idx ON student_survey_responses(decision);

--> statement-breakpoint

UPDATE system_settings
SET value = 'ระบบลงทะเบียนรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง'
WHERE key = 'system_name'
  AND value = 'ระบบสำรวจความต้องการรับ iPad สำหรับครูโรงเรียนจอมทอง';

--> statement-breakpoint

UPDATE system_settings
SET value = 'โปรดเลือกประเภทผู้ใช้งานเพื่อบันทึกความประสงค์รับ iPad'
WHERE key = 'announcement'
  AND value = 'โปรดเลือกกลุ่มสาระการเรียนรู้และชื่อของท่านเพื่อบันทึกความประสงค์';

--> statement-breakpoint

-- Source: migrations/0006_add_student_emails.sql
ALTER TABLE students ADD COLUMN school_email TEXT;

--> statement-breakpoint

ALTER TABLE students ADD COLUMN ndlp_email TEXT;

--> statement-breakpoint

-- Source: migrations/0007_add_device_return_history.sql
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

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS device_return_history_returned_idx
  ON device_return_history(returned_at DESC);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS device_return_history_holder_idx
  ON device_return_history(holder_type, holder_id);

--> statement-breakpoint

-- Source: migrations/0008_rename_survey_to_registration.sql
UPDATE system_settings
SET value = 'ระบบลงทะเบียนรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง',
    updated_at = datetime('now')
WHERE key = 'system_name'
  AND value IN (
    'ระบบสำรวจความต้องการรับ iPad สำหรับครูโรงเรียนจอมทอง',
    'ระบบสำรวจความต้องการรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง'
  );

--> statement-breakpoint

-- Source: migrations/0009_add_student_approval.sql
ALTER TABLE student_survey_responses ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'PENDING';

--> statement-breakpoint

ALTER TABLE student_survey_responses ADD COLUMN approved_at TEXT;

--> statement-breakpoint

ALTER TABLE student_survey_responses ADD COLUMN approved_by TEXT;

--> statement-breakpoint

ALTER TABLE student_survey_responses ADD COLUMN approval_note TEXT;

--> statement-breakpoint

UPDATE student_survey_responses
SET approval_status = CASE WHEN decision = 'DECLINE' THEN 'NOT_REQUIRED' ELSE 'PENDING' END;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_responses_approval_idx
ON student_survey_responses(approval_status);

--> statement-breakpoint

-- Source: migrations/0010_add_class_advisors.sql
CREATE TABLE IF NOT EXISTS class_advisors (
  id TEXT PRIMARY KEY,
  grade_level TEXT NOT NULL,
  room TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(grade_level, room)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS class_advisors_teacher_idx
ON class_advisors(teacher_id);

--> statement-breakpoint

-- Source: migrations/0011_allow_two_class_advisors.sql
CREATE TABLE class_advisors_v2 (
  id TEXT PRIMARY KEY,
  grade_level TEXT NOT NULL,
  room TEXT NOT NULL,
  advisor_order INTEGER NOT NULL CHECK (advisor_order IN (1, 2)),
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (grade_level, room, advisor_order),
  UNIQUE (grade_level, room, teacher_id)
);

--> statement-breakpoint

INSERT INTO class_advisors_v2 (
  id, grade_level, room, advisor_order, teacher_id, created_at, updated_at
)
SELECT id, grade_level, room, 1, teacher_id, created_at, updated_at
FROM class_advisors;

--> statement-breakpoint

DROP TABLE class_advisors;

--> statement-breakpoint

ALTER TABLE class_advisors_v2 RENAME TO class_advisors;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS class_advisors_teacher_idx
ON class_advisors(teacher_id);

--> statement-breakpoint

-- Source: migrations/0012_split_registration_status.sql
INSERT OR IGNORE INTO system_settings (key,value,updated_at)
VALUES (
  'teacher_survey_status',
  COALESCE((SELECT value FROM system_settings WHERE key='survey_status'),'OPEN'),
  datetime('now')
);

--> statement-breakpoint

INSERT OR IGNORE INTO system_settings (key,value,updated_at)
VALUES (
  'student_survey_status',
  COALESCE((SELECT value FROM system_settings WHERE key='survey_status'),'OPEN'),
  datetime('now')
);

--> statement-breakpoint

-- Source: migrations/0013_allow_publication_images.sql
DROP TABLE IF EXISTS project_documents_v2;

--> statement-breakpoint

CREATE TABLE project_documents_v2 (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  original_filename TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp','image/gif')),
  size_bytes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  uploaded_by TEXT NOT NULL REFERENCES admin_users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

INSERT INTO project_documents_v2
  (id,title,description,original_filename,object_key,mime_type,size_bytes,sort_order,is_active,uploaded_by,created_at,updated_at)
SELECT id,title,description,original_filename,object_key,mime_type,size_bytes,sort_order,is_active,uploaded_by,created_at,updated_at
FROM project_documents;

--> statement-breakpoint

DROP TABLE project_documents;

--> statement-breakpoint

ALTER TABLE project_documents_v2 RENAME TO project_documents;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS project_documents_active_sort_idx ON project_documents(is_active, sort_order);

--> statement-breakpoint

-- Source: migrations/0014_scale_concurrency.sql
-- Keep initialization and indexing out of request-time cold starts. This
-- migration is safe for existing databases and also supplies defaults for a
-- newly-created database before the first visitor arrives.

CREATE INDEX IF NOT EXISTS survey_registration_capacity_idx
  ON survey_responses(decision, public_locked, teacher_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_registration_capacity_idx
  ON student_survey_responses(decision, public_locked, approval_status, student_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS teachers_public_area_idx
  ON teachers(learning_area_id, is_active, sort_order, first_name, last_name);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS students_roster_grade_idx
  ON students(is_active, grade_level);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS project_documents_public_idx
  ON project_documents(is_active, sort_order, created_at DESC);

--> statement-breakpoint

INSERT OR IGNORE INTO learning_areas
  (id, code, name, icon, sort_order, is_active, created_at, updated_at)
VALUES
  ('thai','THAI','ภาษาไทย','book-open',1,1,datetime('now'),datetime('now')),
  ('math','MATH','คณิตศาสตร์','calculator',2,1,datetime('now'),datetime('now')),
  ('science','SCI','วิทยาศาสตร์และเทคโนโลยี','flask',3,1,datetime('now'),datetime('now')),
  ('social','SOC','สังคมศึกษา ศาสนา และวัฒนธรรม','landmark',4,1,datetime('now'),datetime('now')),
  ('health','HEALTH','สุขศึกษาและพลศึกษา','heart-pulse',5,1,datetime('now'),datetime('now')),
  ('arts','ART','ศิลปะ','palette',6,1,datetime('now'),datetime('now')),
  ('career','CAREER','การงานอาชีพ','briefcase',7,1,datetime('now'),datetime('now')),
  ('languages','LANG','ภาษาต่างประเทศ','language',8,1,datetime('now'),datetime('now')),
  ('guidance','GUIDANCE','กิจกรรมพัฒนาผู้เรียน','people-group',9,1,datetime('now'),datetime('now')),
  ('management','MANAGEMENT','ฝ่ายบริหาร','user-tie',10,1,datetime('now'),datetime('now'));

--> statement-breakpoint

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES
  ('system_name','ระบบลงทะเบียนรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง',datetime('now')),
  ('project_name','โครงการส่งเสริมการเรียนรู้ขั้นพื้นฐานทุกที่ ทุกเวลา (Anywhere Anytime) สำหรับโรงเรียน',datetime('now')),
  ('school_name','โรงเรียนจอมทอง',datetime('now')),
  ('subdistrict','ข่วงเปา',datetime('now')),
  ('district','จอมทอง',datetime('now')),
  ('province','เชียงใหม่',datetime('now')),
  ('organization','สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเชียงใหม่',datetime('now')),
  ('device_brand','Apple',datetime('now')),
  ('device_model','iPad A16 WiFi+Cellular 128GB',datetime('now')),
  ('teacher_ipad_quota','127',datetime('now')),
  ('student_ipad_quota','1763',datetime('now')),
  ('approver_name','นางสาววัลภมาภรค์ อาจนาเสียว',datetime('now')),
  ('survey_status','OPEN',datetime('now')),
  ('teacher_survey_status','OPEN',datetime('now')),
  ('student_survey_status','OPEN',datetime('now')),
  ('teacher_registration_opens_at','',datetime('now')),
  ('teacher_registration_closes_at','',datetime('now')),
  ('student_registration_opens_at','',datetime('now')),
  ('student_registration_closes_at','',datetime('now')),
  ('student_lower_registration_opens_at','',datetime('now')),
  ('student_lower_registration_closes_at','',datetime('now')),
  ('student_upper_registration_opens_at','',datetime('now')),
  ('student_upper_registration_closes_at','',datetime('now')),
  ('announcement','โปรดเลือกประเภทผู้ใช้งานเพื่อบันทึกความประสงค์รับ iPad',datetime('now')),
  ('survey_end_date','',datetime('now'));

--> statement-breakpoint

UPDATE student_survey_responses
SET approval_status = 'NOT_REQUIRED'
WHERE decision = 'DECLINE'
  AND public_locked = 1
  AND approval_status = 'PENDING';

--> statement-breakpoint

-- Source: migrations/0015_add_home_hero_settings.sql
INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES
  ('hero_eyebrow', 'Anywhere Anytime', datetime('now')),
  ('hero_title', 'ลงทะเบียนรับ', datetime('now')),
  ('hero_product_name', 'iPad', datetime('now')),
  ('hero_product_suffix', 'ยืมเรียน', datetime('now')),
  ('hero_free_label', 'ฟรี!!!', datetime('now')),
  ('hero_audience', 'สำหรับครูและนักเรียนโรงเรียนจอมทอง', datetime('now'));

--> statement-breakpoint

-- Source: migrations/0016_split_approver_settings.sql
INSERT OR IGNORE INTO system_settings (key, value, updated_at)
SELECT
  'teacher_approver_name',
  COALESCE(
    (SELECT value FROM system_settings WHERE key = 'approver_name'),
    'นางสาววัลภมาภรค์ อาจนาเสียว'
  ),
  datetime('now');

--> statement-breakpoint

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
SELECT
  'student_approver_name',
  COALESCE(
    (SELECT value FROM system_settings WHERE key = 'approver_name'),
    'นางสาววัลภมาภรค์ อาจนาเสียว'
  ),
  datetime('now');

--> statement-breakpoint

-- Source: migrations/0017_group_publication_images.sql
ALTER TABLE project_documents ADD COLUMN publication_group_id TEXT;

--> statement-breakpoint

ALTER TABLE project_documents ADD COLUMN attachment_order INTEGER NOT NULL DEFAULT 0;

--> statement-breakpoint

UPDATE project_documents
SET publication_group_id = id
WHERE publication_group_id IS NULL OR publication_group_id = '';

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS project_documents_group_idx
  ON project_documents(publication_group_id, attachment_order);

--> statement-breakpoint

-- Source: migrations/0018_update_device_model.sql
UPDATE system_settings
SET value = 'iPad A16 WiFi+Cellular 128GB',
    updated_at = datetime('now')
WHERE key = 'device_model'
  AND value = 'iPad A16';

--> statement-breakpoint

-- Source: migrations/0019_add_student_document_checkin.sql
CREATE TABLE IF NOT EXISTS student_document_receipts (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'AWAT03',
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'CANCELLED')),
  received_at TEXT,
  received_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, document_type)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_document_receipts_status_idx
  ON student_document_receipts(document_type, status, received_at DESC);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS student_document_receipt_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'AWAT03',
  action TEXT NOT NULL CHECK (action IN ('RECEIVE', 'CANCEL')),
  note TEXT,
  processed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_document_receipt_events_created_idx
  ON student_document_receipt_events(created_at DESC);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS student_document_receipt_events_student_idx
  ON student_document_receipt_events(student_id, document_type, created_at DESC);
