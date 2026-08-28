ALTER TABLE project_documents ADD COLUMN publication_group_id TEXT;
ALTER TABLE project_documents ADD COLUMN attachment_order INTEGER NOT NULL DEFAULT 0;

UPDATE project_documents
SET publication_group_id = id
WHERE publication_group_id IS NULL OR publication_group_id = '';

CREATE INDEX IF NOT EXISTS project_documents_group_idx
  ON project_documents(publication_group_id, attachment_order);
