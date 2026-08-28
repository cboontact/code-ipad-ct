INSERT OR IGNORE INTO system_settings (key,value,updated_at)
VALUES (
  'teacher_survey_status',
  COALESCE((SELECT value FROM system_settings WHERE key='survey_status'),'OPEN'),
  datetime('now')
);

INSERT OR IGNORE INTO system_settings (key,value,updated_at)
VALUES (
  'student_survey_status',
  COALESCE((SELECT value FROM system_settings WHERE key='survey_status'),'OPEN'),
  datetime('now')
);
