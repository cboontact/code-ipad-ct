-- Keep initialization and indexing out of request-time cold starts. This
-- migration is safe for existing databases and also supplies defaults for a
-- newly-created database before the first visitor arrives.

CREATE INDEX IF NOT EXISTS survey_registration_capacity_idx
  ON survey_responses(decision, public_locked, teacher_id);

CREATE INDEX IF NOT EXISTS student_registration_capacity_idx
  ON student_survey_responses(decision, public_locked, approval_status, student_id);

CREATE INDEX IF NOT EXISTS teachers_public_area_idx
  ON teachers(learning_area_id, is_active, sort_order, first_name, last_name);

CREATE INDEX IF NOT EXISTS students_roster_grade_idx
  ON students(is_active, grade_level);

CREATE INDEX IF NOT EXISTS project_documents_public_idx
  ON project_documents(is_active, sort_order, created_at DESC);

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

UPDATE student_survey_responses
SET approval_status = 'NOT_REQUIRED'
WHERE decision = 'DECLINE'
  AND public_locked = 1
  AND approval_status = 'PENDING';
