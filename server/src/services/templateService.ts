import { query } from "../db.js";

export interface TemplateRow {
  id: number;
  name: string;
  title_template: string;
  header_text: string | null;
  document_heading: string | null;
  separator_line: string | null;
  output_title_by_default: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ModuleRow {
  id: number;
  template_id: number;
  label: string;
  field_type: string;
  placeholder: string | null;
  bullet_prefix: string | null;
  show_heading: number;
  rows_json: string | null;
  position: number;
}

export interface TemplateWithModules extends TemplateRow {
  modules: ModuleRow[];
}

export async function getAllTemplates(): Promise<TemplateWithModules[]> {
  const templates = await query<TemplateRow[]>(
    "SELECT * FROM templates ORDER BY name"
  );
  const result: TemplateWithModules[] = [];

  for (const t of templates) {
    const modules = await query<ModuleRow[]>(
      "SELECT * FROM template_modules WHERE template_id = ? ORDER BY position",
      [t.id]
    );
    result.push({ ...t, modules });
  }

  return result;
}

export async function getTemplateById(id: number): Promise<TemplateWithModules | null> {
  const templates = await query<TemplateRow[]>(
    "SELECT * FROM templates WHERE id = ?",
    [id]
  );
  if (!templates[0]) return null;

  const modules = await query<ModuleRow[]>(
    "SELECT * FROM template_modules WHERE template_id = ? ORDER BY position",
    [id]
  );

  return { ...templates[0], modules };
}

export async function createTemplate(
  data: {
    name: string;
    title_template?: string;
    header_text?: string | null;
    document_heading?: string | null;
    separator_line?: string | null;
    output_title_by_default?: boolean;
    created_by?: number | null;
    modules?: {
      label: string;
      field_type: string;
      placeholder?: string;
      bullet_prefix?: string | null;
      show_heading?: boolean;
      rows_json?: string | null;
    }[];
  }
): Promise<TemplateWithModules> {
  const result = await query<{ insertId: number }>(
    `INSERT INTO templates (name, title_template, header_text, document_heading, separator_line, output_title_by_default, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.title_template || "Titel:",
      data.header_text || null,
      data.document_heading || null,
      data.separator_line || null,
      data.output_title_by_default ? 1 : 0,
      data.created_by || null,
    ]
  );

  const templateId = result.insertId;

  if (data.modules && data.modules.length > 0) {
    for (let i = 0; i < data.modules.length; i++) {
      const m = data.modules[i];
      await query(
        `INSERT INTO template_modules (template_id, label, field_type, placeholder, bullet_prefix, show_heading, rows_json, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          templateId,
          m.label,
          m.field_type,
          m.placeholder || null,
          m.bullet_prefix || null,
          m.show_heading !== false ? 1 : 0,
          m.rows_json || null,
          i,
        ]
      );
    }
  }

  return (await getTemplateById(templateId))!;
}

export async function updateTemplate(
  id: number,
  updates: Partial<{
    name: string;
    title_template: string;
    header_text: string;
    document_heading: string;
    separator_line: string;
    output_title_by_default: boolean;
  }>
): Promise<TemplateWithModules | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) { sets.push("name = ?"); params.push(updates.name); }
  if (updates.title_template !== undefined) { sets.push("title_template = ?"); params.push(updates.title_template); }
  if (updates.header_text !== undefined) { sets.push("header_text = ?"); params.push(updates.header_text); }
  if (updates.document_heading !== undefined) { sets.push("document_heading = ?"); params.push(updates.document_heading); }
  if (updates.separator_line !== undefined) { sets.push("separator_line = ?"); params.push(updates.separator_line); }
  if (updates.output_title_by_default !== undefined) { sets.push("output_title_by_default = ?"); params.push(updates.output_title_by_default ? 1 : 0); }

  if (sets.length > 0) {
    params.push(id);
    await query(`UPDATE templates SET ${sets.join(", ")} WHERE id = ?`, params);
  }

  return getTemplateById(id);
}

export async function deleteTemplate(id: number): Promise<void> {
  await query("DELETE FROM template_modules WHERE template_id = ?", [id]);
  await query("DELETE FROM templates WHERE id = ?", [id]);
}

export async function duplicateTemplate(
  id: number,
  newName?: string,
  createdBy?: number | null
): Promise<TemplateWithModules | null> {
  const source = await getTemplateById(id);
  if (!source) return null;

  return createTemplate({
    name: newName || `${source.name} Kopie`,
    title_template: source.title_template,
    header_text: source.header_text,
    document_heading: source.document_heading,
    separator_line: source.separator_line,
    output_title_by_default: !!source.output_title_by_default,
    created_by: createdBy || source.created_by,
    modules: source.modules.map((m) => ({
      label: m.label,
      field_type: m.field_type,
      placeholder: m.placeholder ?? undefined,
      bullet_prefix: m.bullet_prefix ?? undefined,
      show_heading: !!m.show_heading,
      rows_json: m.rows_json ?? undefined,
    })),
  });
}
