import { query } from "../db.js";

export interface DraftRow {
  id: number;
  user_id: number;
  template_id: number;
  title: string;
  form_data_json: string;
  created_at: string;
  updated_at: string;
}

export interface DraftWithTemplate extends DraftRow {
  template_name?: string;
}

export async function getDraftsByUser(userId: number): Promise<DraftWithTemplate[]> {
  return query<DraftWithTemplate[]>(
    `SELECT d.*, t.name as template_name
     FROM drafts d
     LEFT JOIN templates t ON t.id = d.template_id
     WHERE d.user_id = ?
     ORDER BY d.updated_at DESC`,
    [userId]
  );
}

export async function getAllDrafts(): Promise<DraftWithTemplate[]> {
  return query<DraftWithTemplate[]>(
    `SELECT d.*, t.name as template_name
     FROM drafts d
     LEFT JOIN templates t ON t.id = d.template_id
     ORDER BY d.updated_at DESC`
  );
}

export async function getDraftById(id: number): Promise<DraftWithTemplate | null> {
  const drafts = await query<DraftWithTemplate[]>(
    `SELECT d.*, t.name as template_name
     FROM drafts d
     LEFT JOIN templates t ON t.id = d.template_id
     WHERE d.id = ?`,
    [id]
  );
  return drafts[0] || null;
}

export async function createDraft(
  userId: number,
  templateId: number,
  title: string,
  formDataJson: string
): Promise<DraftRow> {
  const result = await query<{ insertId: number }>(
    "INSERT INTO drafts (user_id, template_id, title, form_data_json) VALUES (?, ?, ?, ?)",
    [userId, templateId, title, formDataJson]
  );
  const drafts = await query<DraftRow[]>(
    "SELECT * FROM drafts WHERE id = ?",
    [result.insertId]
  );
  return drafts[0];
}

export async function updateDraft(
  id: number,
  title: string,
  formDataJson: string
): Promise<DraftRow | null> {
  await query(
    "UPDATE drafts SET title = ?, form_data_json = ? WHERE id = ?",
    [title, formDataJson, id]
  );
  const drafts = await query<DraftRow[]>(
    "SELECT * FROM drafts WHERE id = ?",
    [id]
  );
  return drafts[0] || null;
}

export async function deleteDraft(id: number): Promise<void> {
  await query("DELETE FROM drafts WHERE id = ?", [id]);
}
