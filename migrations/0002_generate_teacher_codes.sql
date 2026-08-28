UPDATE teachers
SET teacher_code = 'CT-' || upper(hex(randomblob(5))),
    updated_at = datetime('now')
WHERE teacher_code IS NULL OR trim(teacher_code) = '';
