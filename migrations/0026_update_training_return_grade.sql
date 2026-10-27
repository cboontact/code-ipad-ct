UPDATE guardian_training_questions
SET statement = 'iPad ในโครงการเป็นอุปกรณ์ยืมเรียน และนักเรียนต้องส่งคืนโรงเรียนเมื่อเรียนจบชั้น ม.3 หรือ ม.6',
    explanation = 'อุปกรณ์เป็นทรัพย์สินสำหรับยืมเรียนตลอดโครงการและต้องส่งคืนเมื่อจบชั้น ม.3 หรือ ม.6',
    updated_at = datetime('now')
WHERE id = 'gtq-01';
