CREATE TABLE IF NOT EXISTS guardian_training_assignments (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN (
    'ASSIGNED','IN_PROGRESS','VIDEO_COMPLETED','QUIZ_PASSED','QUIZ_FAILED',
    'REVIEW_PENDING','APPROVED','REJECTED'
  )),
  cycle INTEGER NOT NULL DEFAULT 1,
  watched_seconds REAL NOT NULL DEFAULT 0,
  video_duration REAL NOT NULL DEFAULT 0,
  last_progress_at TEXT,
  quiz_score INTEGER,
  quiz_attempts INTEGER NOT NULL DEFAULT 0,
  guardian_name TEXT,
  guardian_relationship TEXT,
  guardian_phone TEXT,
  selfie_object_key TEXT,
  consent_at TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  review_note TEXT,
  assigned_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS guardian_training_status_idx
  ON guardian_training_assignments(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS guardian_training_questions (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  correct_answer INTEGER NOT NULL CHECK (correct_answer IN (0,1)),
  explanation TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guardian_training_answers (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL,
  question_id TEXT NOT NULL REFERENCES guardian_training_questions(id),
  answer INTEGER NOT NULL CHECK (answer IN (0,1)),
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  created_at TEXT NOT NULL,
  UNIQUE(student_id, cycle, question_id)
);

CREATE INDEX IF NOT EXISTS guardian_training_answers_student_idx
  ON guardian_training_answers(student_id, cycle);

CREATE TABLE IF NOT EXISTS guardian_training_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  processed_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS guardian_training_events_created_idx
  ON guardian_training_events(created_at DESC);

INSERT OR IGNORE INTO system_settings (key,value,updated_at) VALUES
  ('guardian_training_video_url','https://youtu.be/y02h6XYY-3w',datetime('now')),
  ('guardian_training_material_key','training/materials/parent-meeting-ipad-2569.pdf',datetime('now')),
  ('guardian_training_status','OPEN',datetime('now'));

INSERT OR IGNORE INTO guardian_training_questions
  (id,statement,correct_answer,explanation,sort_order,is_active,created_at,updated_at)
VALUES
  ('gtq-01','iPad ในโครงการเป็นอุปกรณ์ยืมเรียน และนักเรียนต้องส่งคืนโรงเรียนเมื่อเรียนจบชั้น ม.6',1,'อุปกรณ์เป็นทรัพย์สินสำหรับยืมเรียนตลอดโครงการและต้องส่งคืนเมื่อจบชั้น ม.6',1,1,datetime('now'),datetime('now')),
  ('gtq-02','ชุดอุปกรณ์ประกอบด้วย iPad ชิป A16 ความจุ 128GB แบบ Wi-Fi + Cellular พร้อมสายและอะแดปเตอร์ ปากกา และเคสคีย์บอร์ด',1,'เอกสารระบุ iPad 11 นิ้ว ชิป A16 ความจุ 128GB แบบ Wi-Fi + Cellular พร้อมอุปกรณ์ที่กำหนด',2,1,datetime('now'),datetime('now')),
  ('gtq-03','แพ็กเกจอินเทอร์เน็ตมีข้อมูล 30GB ต่อเดือน และเมื่อใช้ครบจะลดความเร็วเหลือไม่น้อยกว่า 384 Kbps',1,'แพ็กเกจให้ข้อมูล 30GB ต่อเดือน หลังใช้ครบลดความเร็ว และไม่รวมโทรศัพท์ SMS หรือ MMS',3,1,datetime('now'),datetime('now')),
  ('gtq-04','นักเรียนเป็นผู้ค้ำประกันอุปกรณ์และสามารถลงนามในแบบฟอร์ม AWAT-03 แทนผู้ปกครองได้',0,'ผู้ปกครองเป็นผู้ค้ำประกันและต้องลงลายมือชื่อในแบบฟอร์ม AWAT-03',4,1,datetime('now'),datetime('now')),
  ('gtq-05','นักเรียนสามารถให้บุคคลภายนอกยืมเครื่องได้ หากนำกลับมาคืนภายในวันเดียวกัน',0,'ห้ามให้บุคคลภายนอกยืมหรือใช้เครื่องโดยเด็ดขาด',5,1,datetime('now'),datetime('now')),
  ('gtq-06','ห้ามใช้เครื่องละเมิดลิขสิทธิ์ เข้าเว็บไซต์ไม่เหมาะสม หรือติดตั้งโปรแกรมที่ไม่เกี่ยวกับการเรียน',1,'เครื่องต้องใช้เพื่อการเรียนและต้องปฏิบัติตามข้อห้ามด้านกฎหมาย ความปลอดภัย และความเหมาะสม',6,1,datetime('now'),datetime('now')),
  ('gtq-07','หากเครื่องเสียหายจากการใช้งานผิดปกติหรืออุปกรณ์สูญหาย นักเรียนไม่ต้องรับผิดชอบค่าใช้จ่าย และสามารถนำเครื่องไปซ่อมเองได้',0,'ความเสียหายผิดปกติหรืออุปกรณ์สูญหายอาจมีค่าใช้จ่ายตามรายการ และห้ามแกะ ดัดแปลง หรือซ่อมเอง',7,1,datetime('now'),datetime('now')),
  ('gtq-08','หาก iPad สูญหายหรือถูกขโมย ต้องรีบแจ้งอาจารย์หรือ Admin ระบุรายละเอียดเหตุการณ์ และดำเนินการแจ้งความ',1,'ต้องแจ้งผู้ดูแลโดยเร็ว พร้อมข้อมูลเครื่อง ผู้ครอบครอง สถานที่ เวลา และเอกสารแจ้งความ',8,1,datetime('now'),datetime('now')),
  ('gtq-09','ก่อนรับเครื่อง นักเรียนต้องตรวจสภาพ เปิดเครื่อง เข้าสู่ระบบด้วยอีเมล NDLP ลงทะเบียนผู้ถือครอง และทดสอบตามเอกสาร',1,'ขั้นตอนรับเครื่องประกอบด้วยการตรวจสภาพ เปิดเครื่อง ตั้งค่า ลงทะเบียน และทดสอบการใช้งาน',9,1,datetime('now'),datetime('now')),
  ('gtq-10','ก่อนคืน iPad ต้องออกจาก Apple ID ลบรหัสหน้าจอ ออกจากบัญชีส่วนตัว และส่งเครื่องพร้อมแบบฟอร์ม AWAT-05 ให้เจ้าหน้าที่ตรวจสอบ',1,'ต้องนำบัญชีและข้อมูลส่วนตัวออกจากเครื่องก่อนคืน พร้อมดำเนินการตามแบบฟอร์ม AWAT-05',10,1,datetime('now'),datetime('now'));
