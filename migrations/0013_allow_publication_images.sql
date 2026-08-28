DROP TABLE IF EXISTS project_documents_v2;

CREATE TABLE project_documents_v2 (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  original_filename TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp','image/gif')),
  size_bytes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  uploaded_by TEXT NOT NULL REFERENCES admin_users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO project_documents_v2
  (id,title,description,original_filename,object_key,mime_type,size_bytes,sort_order,is_active,uploaded_by,created_at,updated_at)
SELECT id,title,description,original_filename,object_key,mime_type,size_bytes,sort_order,is_active,uploaded_by,created_at,updated_at
FROM project_documents;

DROP TABLE project_documents;
ALTER TABLE project_documents_v2 RENAME TO project_documents;
CREATE INDEX IF NOT EXISTS project_documents_active_sort_idx ON project_documents(is_active, sort_order);
