ALTER TABLE student_survey_responses ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE student_survey_responses ADD COLUMN approved_at TEXT;
ALTER TABLE student_survey_responses ADD COLUMN approved_by TEXT;
ALTER TABLE student_survey_responses ADD COLUMN approval_note TEXT;

UPDATE student_survey_responses
SET approval_status = CASE WHEN decision = 'DECLINE' THEN 'NOT_REQUIRED' ELSE 'PENDING' END;

CREATE INDEX IF NOT EXISTS student_responses_approval_idx
ON student_survey_responses(approval_status);
