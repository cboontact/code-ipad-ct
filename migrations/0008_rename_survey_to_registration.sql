UPDATE system_settings
SET value = 'ระบบลงทะเบียนรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง',
    updated_at = datetime('now')
WHERE key = 'system_name'
  AND value IN (
    'ระบบสำรวจความต้องการรับ iPad สำหรับครูโรงเรียนจอมทอง',
    'ระบบสำรวจความต้องการรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง'
  );
