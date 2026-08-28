CREATE TABLE IF NOT EXISTS class_advisors (
  id TEXT PRIMARY KEY,
  grade_level TEXT NOT NULL,
  room TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(grade_level, room)
);

CREATE INDEX IF NOT EXISTS class_advisors_teacher_idx
ON class_advisors(teacher_id);
