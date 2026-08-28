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

INSERT INTO class_advisors_v2 (
  id, grade_level, room, advisor_order, teacher_id, created_at, updated_at
)
SELECT id, grade_level, room, 1, teacher_id, created_at, updated_at
FROM class_advisors;

DROP TABLE class_advisors;
ALTER TABLE class_advisors_v2 RENAME TO class_advisors;

CREATE INDEX IF NOT EXISTS class_advisors_teacher_idx
ON class_advisors(teacher_id);
