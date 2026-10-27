UPDATE guardian_training_questions
SET statement='ชุดอุปกรณ์ประกอบด้วย iPad ชิป A16 ความจุ 128GB แบบ Wi-Fi + Cellular พร้อมสายและอะแดปเตอร์ ปากกา และเคสคีย์บอร์ด',
    explanation='เอกสารระบุ iPad 11 นิ้ว ชิป A16 ความจุ 128GB แบบ Wi-Fi + Cellular พร้อมอุปกรณ์ที่กำหนด',
    updated_at=datetime('now')
WHERE id='gtq-02';

UPDATE guardian_training_questions
SET statement='หากเครื่องเสียหายจากการใช้งานผิดปกติหรืออุปกรณ์สูญหาย นักเรียนไม่ต้องรับผิดชอบค่าใช้จ่าย และสามารถนำเครื่องไปซ่อมเองได้',
    explanation='ความเสียหายผิดปกติหรืออุปกรณ์สูญหายอาจมีค่าใช้จ่ายตามรายการ และห้ามแกะ ดัดแปลง หรือซ่อมเอง',
    updated_at=datetime('now')
WHERE id='gtq-07';
