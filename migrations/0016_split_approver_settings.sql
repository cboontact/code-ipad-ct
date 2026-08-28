INSERT OR IGNORE INTO system_settings (key, value, updated_at)
SELECT
  'teacher_approver_name',
  COALESCE(
    (SELECT value FROM system_settings WHERE key = 'approver_name'),
    'นางสาววัลภมาภรค์ อาจนาเสียว'
  ),
  datetime('now');

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
SELECT
  'student_approver_name',
  COALESCE(
    (SELECT value FROM system_settings WHERE key = 'approver_name'),
    'นางสาววัลภมาภรค์ อาจนาเสียว'
  ),
  datetime('now');
