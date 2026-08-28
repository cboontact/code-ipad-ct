import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const learningAreas = sqliteTable("learning_areas", {
  id: text("id").primaryKey(), code: text("code").notNull().unique(), name: text("name").notNull(),
  icon: text("icon").notNull().default("book-open"), sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), ...timestamps,
});

export const teachers = sqliteTable("teachers", {
  id: text("id").primaryKey(), teacherCode: text("teacher_code").unique(), prefix: text("prefix").notNull(),
  firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  learningAreaId: text("learning_area_id").notNull().references(() => learningAreas.id), position: text("position"),
  academicRank: text("academic_rank"), email: text("email"), ndlpEmail: text("ndlp_email"), phone: text("phone"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), sortOrder: integer("sort_order").notNull().default(0), ...timestamps,
}, (table) => [index("teachers_learning_area_idx").on(table.learningAreaId)]);

export const surveyResponses = sqliteTable("survey_responses", {
  id: text("id").primaryKey(), teacherId: text("teacher_id").notNull().references(() => teachers.id),
  decision: text("decision", { enum: ["ACCEPT", "DECLINE"] }).notNull(), piiCiphertext: text("pii_ciphertext"),
  piiIv: text("pii_iv"), publicLocked: integer("public_locked", { mode: "boolean" }).notNull().default(true),
  privacyAcknowledgedAt: text("privacy_acknowledged_at"), submittedAt: text("submitted_at").notNull(),
  updatedAt: text("updated_at").notNull(), updatedByAdminId: text("updated_by_admin_id"), adminNote: text("admin_note"),
}, (table) => [uniqueIndex("survey_responses_teacher_idx").on(table.teacherId), index("survey_responses_decision_idx").on(table.decision)]);

export const deviceAssignments = sqliteTable("device_assignments", {
  id: text("id").primaryKey(), teacherId: text("teacher_id").notNull().unique().references(() => teachers.id),
  assetNumber: text("asset_number"), serialNumber: text("serial_number"), deviceIdentifier: text("device_identifier"),
  accessories: text("accessories"), note: text("note"), assignedAt: text("assigned_at"), ...timestamps,
});

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(), username: text("username").notNull().unique(), passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(), role: text("role", { enum: ["superadmin", "admin"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), lastLoginAt: text("last_login_at"), ...timestamps,
});

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(), adminId: text("admin_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  sessionTokenHash: text("session_token_hash").notNull().unique(), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull(),
});

export const projectDocuments = sqliteTable("project_documents", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description"), originalFilename: text("original_filename").notNull(),
  objectKey: text("object_key").notNull().unique(), mimeType: text("mime_type").notNull(), sizeBytes: integer("size_bytes").notNull(),
  sortOrder: integer("sort_order").notNull().default(0), isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  uploadedBy: text("uploaded_by").notNull().references(() => adminUsers.id), ...timestamps,
}, (table) => [index("project_documents_active_sort_idx").on(table.isActive, table.sortOrder)]);

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(), value: text("value").notNull(), updatedAt: text("updated_at").notNull(), updatedBy: text("updated_by"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), adminId: text("admin_id").references(() => adminUsers.id), action: text("action").notNull(),
  entityType: text("entity_type").notNull(), entityId: text("entity_id"), description: text("description").notNull(),
  beforeData: text("before_data"), afterData: text("after_data"), createdAt: text("created_at").notNull(),
}, (table) => [index("audit_logs_created_idx").on(table.createdAt)]);
