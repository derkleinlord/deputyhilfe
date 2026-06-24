import { query } from "../db.js";
import type { ModuleRow } from "./templateService.js";

export async function getModulesByTemplateId(templateId: number): Promise<ModuleRow[]> {
  return query<ModuleRow[]>(
    "SELECT * FROM template_modules WHERE template_id = ? ORDER BY position",
    [templateId]
  );
}

export async function createModule(
  templateId: number,
  data: {
    label: string;
    field_type: string;
    placeholder?: string;
    bullet_prefix?: string | null;
    show_heading?: boolean;
    rows_json?: string | null;
  }
): Promise<ModuleRow> {
  const modules = await getModulesByTemplateId(templateId);
  const position = modules.length;

  const result = await query<{ insertId: number }>(
    `INSERT INTO template_modules (template_id, label, field_type, placeholder, bullet_prefix, show_heading, rows_json, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      templateId,
      data.label,
      data.field_type,
      data.placeholder || null,
      data.bullet_prefix || null,
      data.show_heading !== false ? 1 : 0,
      data.rows_json || null,
      position,
    ]
  );

  const rows = await query<ModuleRow[]>(
    "SELECT * FROM template_modules WHERE id = ?",
    [result.insertId]
  );
  return rows[0];
}

export async function updateModule(
  moduleId: number,
  updates: Partial<{
    label: string;
    field_type: string;
    placeholder: string;
    bullet_prefix: string | null;
    show_heading: boolean;
    rows_json: string | null;
  }>
): Promise<ModuleRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.label !== undefined) { sets.push("label = ?"); params.push(updates.label); }
  if (updates.field_type !== undefined) { sets.push("field_type = ?"); params.push(updates.field_type); }
  if (updates.placeholder !== undefined) { sets.push("placeholder = ?"); params.push(updates.placeholder); }
  if (updates.bullet_prefix !== undefined) { sets.push("bullet_prefix = ?"); params.push(updates.bullet_prefix); }
  if (updates.show_heading !== undefined) { sets.push("show_heading = ?"); params.push(updates.show_heading ? 1 : 0); }
  if (updates.rows_json !== undefined) { sets.push("rows_json = ?"); params.push(updates.rows_json); }

  if (sets.length > 0) {
    params.push(moduleId);
    await query(`UPDATE template_modules SET ${sets.join(", ")} WHERE id = ?`, params);
  }

  const rows = await query<ModuleRow[]>(
    "SELECT * FROM template_modules WHERE id = ?",
    [moduleId]
  );
  return rows[0] || null;
}

export async function deleteModule(moduleId: number): Promise<void> {
  await query("DELETE FROM template_modules WHERE id = ?", [moduleId]);
}

export async function reorderModules(
  templateId: number,
  moduleIds: number[]
): Promise<void> {
  for (let i = 0; i < moduleIds.length; i++) {
    await query(
      "UPDATE template_modules SET position = ? WHERE id = ? AND template_id = ?",
      [i, moduleIds[i], templateId]
    );
  }
}
