import type { AppData, Template, Module, KeyValueRow, FormData, ModuleValue, ModuleType, Draft } from "./types";
import { moduleTypeMap } from "./types";

export const STORAGE_KEY = "aktenschreiben.web.data.v1";
export const CURRENT_SCHEMA_VERSION = 3;

// --- Storage ---

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persist(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- Normalization ---

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export function normalizeAppData(data: AppData | null | undefined): AppData {
  const normalized: AppData = {
    SchemaVersion: CURRENT_SCHEMA_VERSION,
    Templates: Array.isArray(data?.Templates)
      ? data!.Templates.map((t) => normalizeTemplate(asRecord(t)))
      : [createTatakteTemplate(), createAnzeigenTemplate(), createMahnungTemplate(), createGeschaeftspruefungTemplate(), createWochenberichtTemplate(), createAuslagenpruefungTemplate()],
    ActiveTemplateId: data?.ActiveTemplateId || "",
    Autosaves: data?.Autosaves && typeof data.Autosaves === "object" ? data.Autosaves as Record<string, FormData> : {},
    Drafts: Array.isArray(data?.Drafts) ? data.Drafts as Draft[] : []
  };

  const defaultIds = ["tatakte", "anzeige", "mahnung", "geschaeftspruefung", "wochenbericht", "auslagenpruefung"];
  const existingIds = new Set(normalized.Templates.map((t) => t.Id));
  const defaultCreators: Record<string, () => Template> = {
    tatakte: createTatakteTemplate,
    anzeige: createAnzeigenTemplate,
    mahnung: createMahnungTemplate,
    geschaeftspruefung: createGeschaeftspruefungTemplate,
    wochenbericht: createWochenberichtTemplate,
    auslagenpruefung: createAuslagenpruefungTemplate
  };
  for (const id of defaultIds) {
    if (!existingIds.has(id)) {
      normalized.Templates.push(defaultCreators[id]());
    }
  }

  if (
    !normalized.ActiveTemplateId ||
    !normalized.Templates.some((t) => t.Id === normalized.ActiveTemplateId)
  ) {
    normalized.ActiveTemplateId = normalized.Templates[0].Id;
  }

  normalized.Templates.forEach((template) => {
    const existing = normalized.Autosaves[template.Id];
    normalized.Autosaves[template.Id] = normalizeFormData(
      template,
      existing ?? createBlankFormData(template)
    );
  });

  normalized.Drafts = normalized.Drafts.map((draft) => ({
    Id: draft.Id || createId("draft"),
    Name: draft.Name || "Unbenannter Entwurf",
    TemplateId: draft.TemplateId || normalized.ActiveTemplateId,
    TemplateName: draft.TemplateName || "Vorlage",
    Data: draft.Data || createBlankFormData(normalized.Templates[0]),
    UpdatedAt: draft.UpdatedAt || new Date().toISOString()
  }));

  return normalized;
}

export function normalizeTemplate(template: Record<string, unknown>): Template {
  const normalized: Template = {
    Id: (template.Id ?? template.id ?? createId("template")) as string,
    Name: String(template.Name ?? template.name ?? "Unbenannte Vorlage").trim() || "Unbenannte Vorlage",
    TitleTemplate: String(template.TitleTemplate ?? template.titleTemplate ?? "Titel:"),
    Header: String(template.Header ?? template.header ?? ""),
    Heading: String(template.Heading ?? template.heading ?? ""),
    Separator: String(template.Separator ?? template.separator ?? "------------------------------------------------"),
    IncludeTitleByDefault: Boolean(template.IncludeTitleByDefault ?? template.includeTitleByDefault),
    Modules: Array.isArray(template.Modules ?? template.modules)
      ? (template.Modules as unknown[] ?? template.modules as unknown[]).map((m: unknown) => normalizeModule(m as Record<string, unknown>))
      : []
  };

  if (normalized.Modules.length === 0) {
    normalized.Modules.push(normalizeModule({ Label: "Inhalt", Type: "multiline" }));
  }

  return normalized;
}

export function normalizeModule(module: Record<string, unknown>): Module {
  const modType = module.Type as string | undefined;
  const modTypeAlt = module.type as string | undefined;
  const effectiveType = (modType ?? modTypeAlt ?? "multiline") as string;
  const type = (Object.prototype.hasOwnProperty.call(moduleTypeMap, effectiveType) ? effectiveType : "multiline") as ModuleType;
  const legacyUnits: Record<string, string> = (module.RowUnits ?? module.rowUnits ?? {}) as Record<string, string>;
  const rowsRaw = (module.Rows ?? module.rows) as unknown[];
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((row: unknown) => normalizeRow(row as Record<string, unknown>, legacyUnits)).filter((r: KeyValueRow) => r.Label)
    : [];

  return {
    Id: (module.Id ?? module.id ?? createId("module")) as string,
    Label: String(module.Label ?? module.label ?? "Unbenanntes Modul").trim() || "Unbenanntes Modul",
    Type: type,
    Placeholder: String(module.Placeholder ?? module.placeholder ?? ""),
    Rows: type === "keyValues" ? (rows.length ? rows : [{ Label: "Eintrag", Unit: "" }]) : [],
    RenderHeading: (module.RenderHeading ?? module.renderHeading ?? true) as boolean,
    BulletPrefix: (module.BulletPrefix ?? module.bulletPrefix ?? null) as string | null
  };
}

export function normalizeRow(row: Record<string, unknown> | string, legacyUnits: Record<string, string> = {}): KeyValueRow {
  if (typeof row === "string") {
    return { Label: row.trim(), Unit: legacyUnits[row.trim()] ?? "" };
  }
  const label = String(row?.Label ?? row?.label ?? "").trim();
  return {
    Label: label,
    Unit: String(row?.Unit ?? row?.unit ?? legacyUnits[label] ?? "")
  };
}

export function normalizeFormData(template: Template, data: unknown = {}): FormData {
  const d = (data ?? {}) as Record<string, unknown>;
  const normalized: FormData = {
    Title: String(d.Title ?? d.title ?? template.TitleTemplate),
    IncludeTitle: Boolean(d.IncludeTitle ?? d.includeTitle ?? template.IncludeTitleByDefault),
    Values: {}
  };
  const values = (d.Values ?? d.values ?? {}) as Record<string, Record<string, unknown>>;

  template.Modules.forEach((module) => {
    const incoming = values[module.Id] ?? {};
    const moduleValue: ModuleValue = {
      Text: String(incoming.Text ?? incoming.text ?? ""),
      Rows: {}
    };

    if (module.Type === "keyValues") {
      const incomingRows = (incoming.Rows ?? incoming.rows ?? {}) as Record<string, string>;
      module.Rows.forEach((row) => {
        moduleValue.Rows[row.Label] = incomingRows[row.Label] ?? "";
      });
    }

    normalized.Values[module.Id] = moduleValue;
  });

  return normalized;
}

export function createBlankFormData(template: Template): FormData {
  return normalizeFormData(template, {
    Title: template.TitleTemplate,
    IncludeTitle: template.IncludeTitleByDefault,
    Values: {}
  });
}

// --- Template Creation ---

export function createTatakteTemplate(): Template {
  return normalizeTemplate({
    Id: "tatakte",
    Name: "Tatakten Vorlage",
    TitleTemplate: "[T] Straftat | Vor- Nachname (Täter) | TG:",
    Header: "Sheriff-Department der Vereinigten Staaten von Amerika",
    Heading: "Tatbestand",
    Separator: "------------------------------------------------",
    IncludeTitleByDefault: false,
    Modules: [
      textModule("tatzeitpunkt", "Tatzeitpunkt", "text", "TT.MM.1899 ca. HH:MM"),
      textModule("tatort", "Tatort", "text", "z.B. Blackwater"),
      textModule("geschaedigte", "Geschädigte", "multiline", "Vorname Nachname | TG"),
      textModule("zeugen", "Zeugen", "multiline", "Vorname Nachname | TG"),
      textModule("entwendete_gegenstaende", "Mutmaßlich entwendete Gegenstände", "multiline", "z.B. Waffe(n) [SN-0000]"),
      textModule("tathergang", "Tathergang", "multiline", "Detaillierte und verständliche Beschreibung der ausgeführten Handlungen."),
      keyValueModule("taeterbeschreibung", "Täterbeschreibung", [
        "Mitglied einer Gruppierung",
        "Kleidung (inkl. Details/Akzente)",
        "Körperbau und Frisur",
        "Akzent in der Stimme",
        "Tatwaffe",
        "Reittier"
      ]),
      { ...textModule("weitere_straftaten", "Weitere Straftaten", "bullets", "z.B. §1.1 Schwere Körperverletzung\nz.B. §9. Bedrohung") },
      keyValueModule("sanktion", "Sanktion", [
        { Label: "Bußgeld", Unit: "$" },
        { Label: "Hafteinheiten", Unit: "HE" },
        { Label: "Platzverweis", Unit: "" }
      ], ""),
      textModule("beschlagnahmungen", "Beschlagnahmungen", "multiline", "z.B. Waffe(n) [SN-0000]\nz.B. illegaler Gegenstand x 00"),
      { ...keyValueModule("abnahme", "Abnahme und Abgabe", ["Abgenommen von", "Abgenommen am", "Abgegeben an", "Abgegeben am"], ""), RenderHeading: false },
      textModule("notiz", "Notiz/Ergänzung", "multiline", "Zusätzliche Informationen"),
      textModule("originalverfasser", "Originalverfasser", "text", "Vorname Nachname | TG")
    ]
  } as unknown as Record<string, unknown>);
}

export function createAnzeigenTemplate(): Template {
  return normalizeTemplate({
    Id: "anzeige",
    Name: "Anzeigen Vorlage",
    TitleTemplate: "[A] Straftat | Vor- Nachname (Täter) | TG:",
    Header: "Sheriff-Department der Vereinigten Staaten von Amerika",
    Heading: "Tatbestand",
    Separator: "------------------------------------------------",
    IncludeTitleByDefault: false,
    Modules: [
      textModule("tatzeitpunkt", "Tatzeitpunkt", "text", "TT.MM.JJJJ"),
      textModule("tatort", "Tatort", "text", "z.B. Blackwater"),
      textModule("geschaedigte", "Geschädigte", "multiline", "Vorname Nachname | TG"),
      textModule("zeugen", "Zeugen", "multiline", "Vorname Nachname | TG\noder\nKeine (relevanten) Zeugen bekannt."),
      textModule("entwendete_gegenstaende", "Mutmaßlich entwendete Gegenstände", "multiline", "z.B. Navy Revolver [SN-0000]"),
      textModule("tathergang", "Tathergang", "multiline", "Detaillierte und verständliche Beschreibung der ausgeführten Handlungen. In einem zusammenhängenden Fließtext zu verfassen."),
      keyValueModule("taeterbeschreibung", "Täterbeschreibung", [
        "Mitglied einer Gruppierung",
        "Kleidung (inkl. Details/Akzente)",
        "Körperbau und Frisur",
        "Akzent in der Stimme",
        "Tatwaffe bekannt",
        "Reittier"
      ]),
      { ...textModule("weitere_straftaten", "Weitere Straftaten", "bullets", "Sollte aus dem Tathergang ersichtlich werden.\nz.B. §1.1 Schwere Körperverletzung\nz.B. §9. Bedrohung") },
      textModule("notiz", "Notiz/Ergänzung", "multiline", "Zusätzliche Informationen zu dem verbundenen Fall, besondere Erläuterungen, Erklärung, etc."),
      textModule("originalverfasser", "Originalverfasser", "text", "Vorname Nachname | TG")
    ]
  } as unknown as Record<string, unknown>);
}

export function createMahnungTemplate(): Template {
  return normalizeTemplate({
    Id: "mahnung",
    Name: "Mahnung Vorlage",
    TitleTemplate: "[M] Tat | Vor- Nachname (Täter) | TG:",
    Header: "Sheriff-Department der vereinigten Staaten von Amerika",
    Heading: "Tatbestand",
    Separator: "------------------------------------------------",
    IncludeTitleByDefault: false,
    Modules: [
      textModule("tatzeitpunkt", "Tatzeitpunkt", "text", "TT.MM.JJJJ"),
      textModule("tatort", "Tatort", "text", "z.B. Blackwater"),
      textModule("tathergang", "Tathergang", "multiline", "Stichpunktartige Beschreibung des Tathergangs ist für Mahnungen ausreichend."),
      textModule("sanktion", "Sanktion", "multiline", "Mündliche Verwarnung (sollte es auf ein Bußgeld hinauslaufen, dann ist eine Tatakte anzulegen)."),
      textModule("notiz", "Notiz/Ergänzung", "multiline", "Zusätzliche Information zu verbundenem Fall, besondere Erläuterungen, Erklärung, etc."),
      textModule("originalverfasser", "Originalverfasser", "text", "Vorname Nachname | TG")
    ]
  } as unknown as Record<string, unknown>);
}

export function createGeschaeftspruefungTemplate(): Template {
  return normalizeTemplate({
    Id: "geschaeftspruefung",
    Name: "Geschäftsprüfung Vorlage",
    TitleTemplate: "[GP] Unternehmen | Datum",
    Header: "Sheriff-Department der Vereinigten Staaten von Amerika",
    Heading: "Geschäftsprüfung",
    Separator: "------------------------------------------------",
    IncludeTitleByDefault: false,
    Modules: [
      textModule("unternehmen", "Unternehmen", "text", "bsp. Zum Golden Tropfen"),
      textModule("pruefungsdatum", "Prüfungsdatum", "text", "TT.MM.JJJJ"),
      textModule("genehmigt_von", "Genehmigt von", "text", "VORNAME NACHNAME RANG TG"),
      textModule("anwesende_deputys", "Anwesende Deputys", "multiline", "VORNAME NACHNAME RANG TG"),
      textModule("grund_pruefung", "Grund der Prüfung", "multiline", ""),
      textModule("pruefender_deputy", "Prüfender Deputy", "text", "VORNAME NACHNAME RANG TG"),
      textModule("dauer_pruefung", "Dauer der Prüfung", "text", ""),
      textModule("lizenzen", "Lizenzen", "multiline", ""),
      textModule("anwesende_mitarbeiter", "Anwesende Mitarbeiter", "multiline", "VORNAME NACHNAME"),
      textModule("auffaelligkeiten", "Auffälligkeiten", "multiline", ""),
      textModule("notiz", "Notiz/Ergänzung", "multiline", "Zusätzliche Information, besondere Erläuterungen, Erklärung, etc."),
      textModule("originalverfasser", "Originalverfasser", "text", "Vorname Nachname TGNUMMER")
    ]
  } as unknown as Record<string, unknown>);
}

export function createWochenberichtTemplate(): Template {
  return normalizeTemplate({
    Id: "wochenbericht",
    Name: "Wochenbericht Vorlage",
    TitleTemplate: "[WB] Wochenbericht X | Bande",
    Header: "Sheriff-Department der Vereinigten Staaten von Amerika\nDetective Unit",
    Heading: "Wochenbericht",
    Separator: "------------------------------------------------",
    IncludeTitleByDefault: false,
    Modules: [
      textModule("zeitraum", "Zeitraum", "text", "KW X - TT.MM.JJJJ bis TT.MM.JJJJ"),
      textModule("bande", "Bande", "text", "z.B. Dust Devils"),
      textModule("zusammenfassung", "Zusammenfassung der aktuellen Woche", "multiline", "Kurze Zusammenfassung der Geschehnisse bzw. des Auftretens der Bande innerhalb des Zeitraumes."),
      textModule("aktenvermerke", "Aktenvermerke", "multiline", "Vermerk zu ALLEN im Zeitraum geschriebenen Akten."),
      { ...textModule("bedrohungslage", "Einschätzung der Bedrohungslage", "bullets", "- Sicherheitslage für die Bürger?\n- Sicherheitslage für die Beamten?") },
      { ...textModule("berichte_aussenstehende", "Berichte von Außenstehenden", "bullets", "- Informationen / Aussagen von Unternehmen, Bürgermeistern etc. (alle außerhalb des Departments)") },
      textModule("massnahmen", "Weitere einzuleitende Maßnahmen", "multiline", "Verstärkte Observierung? Verstärkte Kontrollen? Härteres durchgreifen?"),
      textModule("sonstiges", "Sonstiges", "multiline", "Raum für Notizen."),
      textModule("originalverfasser", "Originalverfasser & Ansprechpartner", "text", "Vorname Nachname | TG")
    ]
  } as unknown as Record<string, unknown>);
}

export function createAuslagenpruefungTemplate(): Template {
  return normalizeTemplate({
    Id: "auslagenpruefung",
    Name: "Auslagenprüfung Vorlage",
    TitleTemplate: "[AP] Name des Unternehmen",
    Header: "Sheriff-Department der Vereinigten Staaten von Amerika,",
    Heading: "Auslagenprüfung",
    Separator: "------------------------------------------------",
    IncludeTitleByDefault: false,
    Modules: [
      textModule("bereich", "Bereich", "text", "Bsp. New Austin"),
      textModule("pruefungsdatum", "Prüfungsdatum", "text", "TT.MM.JJJJ"),
      textModule("anwesende_deputys", "Anwesende Deputys", "multiline", "Vorname, Nachname, Rang, TG"),
      textModule("unternehmen", "Überprüftes Unternehmen", "text", "Vollständiger Name des Unternehmen"),
      textModule("lizenzen", "Lizenzen", "multiline", "Informationen zu den vorhandenen Lizenzen"),
      textModule("auslage", "Auslage", "multiline", "Information zum Inhalt der Auslage"),
      textModule("auffaelligkeiten", "Auffälligkeiten", "multiline", "Information zu Auffälligkeiten"),
      textModule("notiz", "Notiz/Ergänzung", "multiline", "Zusätzliche Information, besondere Erläuterungen, Erklärung, etc."),
      textModule("originalverfasser", "Originalverfasser", "text", "Vorname, Nachname TG")
    ]
  } as unknown as Record<string, unknown>);
}

function textModule(id: string, label: string, type: string, placeholder: string): Record<string, unknown> {
  return {
    Id: id,
    Label: label,
    Type: type,
    Placeholder: placeholder,
    Rows: [],
    RenderHeading: true,
    BulletPrefix: null
  };
}

function keyValueModule(id: string, label: string, rows: (string | { Label: string; Unit: string })[], prefix = "-"): Record<string, unknown> {
  return {
    Id: id,
    Label: label,
    Type: "keyValues",
    Placeholder: "",
    Rows: rows.map((row) => typeof row === "string" ? { Label: row, Unit: "" } : row),
    RenderHeading: true,
    BulletPrefix: prefix
  };
}

// --- Case Building ---

export function buildCase(template: Template, rawData: FormData): string {
  const data = normalizeFormData(template, rawData as unknown as Record<string, unknown>);
  const lines: string[] = [];

  if (data.IncludeTitle) {
    lines.push(`Titel: ${data.Title?.trim() || template.TitleTemplate}`);
    lines.push("");
  }

  addIfPresent(lines, template.Header);
  addIfPresent(lines, template.Separator);
  addIfPresent(lines, centerText(template.Heading));
  addIfPresent(lines, template.Separator);
  lines.push("");

  template.Modules.forEach((module, index) => {
    const rendered = renderModule(module, data.Values[module.Id]);
    if (rendered.length === 0) {
      return;
    }
    if (index > 0) {
      lines.push("");
    }
    lines.push(...rendered);
  });

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function renderModule(module: Module, value: ModuleValue): string[] {
  const lines: string[] = [];

  if (module.RenderHeading) {
    lines.push(`__**${module.Label}**__`);
  }

  if (module.Type === "keyValues") {
    const prefix = module.BulletPrefix ?? "-";
    module.Rows.forEach((row) => {
      const rowValue = appendUnit(value.Rows[row.Label] ?? "", row.Unit);
      const spacer = prefix ? " " : "";
      lines.push(`${prefix}${spacer}${row.Label}: ${rowValue}`.trimEnd());
    });
    return lines;
  }

  if (module.Type === "bullets") {
    const prefix = module.BulletPrefix?.trim() ? module.BulletPrefix : "-";
    const entries = splitLines(value.Text);
    if (entries.length === 0) {
      lines.push("");
      return lines;
    }
    entries.forEach((entry) => lines.push(`${prefix} ${entry}`.trim()));
    return lines;
  }

  if (!value.Text?.trim()) {
    lines.push("");
    return lines;
  }

  lines.push(...value.Text.replace(/\r\n/g, "\n").split("\n"));
  return lines;
}

function addIfPresent(lines: string[], value: string): void {
  if (value) {
    lines.push(value);
  }
}

function centerText(value: string): string {
  const text = value?.trim() ?? "";
  if (!text) {
    return "";
  }
  return `${" ".repeat(Math.max(0, Math.floor((51 - text.length) / 2)))}${text}`;
}

function splitLines(value: string): string[] {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function appendUnit(value: string, unit: string): string {
  if (!value?.trim() || !unit?.trim()) {
    return value ?? "";
  }
  const trimmedUnit = unit.trim();
  return /^[A-Za-z0-9ÄÖÜäöüß]/.test(trimmedUnit) ? `${value} ${trimmedUnit}` : `${value}${trimmedUnit}`;
}

// --- Import/Export ---

export function normalizeImportedJson(value: unknown): AppData {
  const obj = value as Record<string, unknown>;

  if (Array.isArray(value)) {
    return {
      SchemaVersion: CURRENT_SCHEMA_VERSION,
      Templates: value.map((item) => normalizeTemplate(item as Record<string, unknown>)),
      ActiveTemplateId: (value[0] as Record<string, unknown>)?.Id as string ?? "",
      Autosaves: {},
      Drafts: []
    };
  }

  if (obj?.Templates || obj?.templates) {
    return {
      SchemaVersion: (obj.SchemaVersion ?? obj.schemaVersion ?? CURRENT_SCHEMA_VERSION) as number,
      Templates: ((obj.Templates ?? obj.templates) as Record<string, unknown>[]).map(
        (t: Record<string, unknown>) => normalizeTemplate(t)
      ),
      ActiveTemplateId: (obj.ActiveTemplateId ?? obj.activeTemplateId ?? "") as string,
      Autosaves: (obj.Autosaves ?? obj.autosaves ?? {}) as Record<string, FormData>,
      Drafts: (obj.Drafts ?? obj.drafts ?? []) as Draft[]
    };
  }

  if (obj?.Modules || obj?.modules) {
    const template = normalizeTemplate(obj as Record<string, unknown>);
    return {
      SchemaVersion: CURRENT_SCHEMA_VERSION,
      Templates: [template],
      ActiveTemplateId: template.Id,
      Autosaves: {},
      Drafts: []
    };
  }

  throw new Error("Unbekanntes JSON-Format.");
}

// --- Utilities ---

export function createId(prefix: string): string {
  if (crypto?.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "akte";
}

export function downloadText(filename: string, text: string, type = "text/plain"): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// --- Helper functions exposed for React components ---

export function ensureAutosave(template: Template, autosaves: Record<string, FormData>): FormData {
  autosaves[template.Id] = normalizeFormData(template, autosaves[template.Id] ?? createBlankFormData(template));
  return autosaves[template.Id];
}

export function getActiveTemplate(data: AppData): Template {
  return data.Templates.find((t) => t.Id === data.ActiveTemplateId) ?? data.Templates[0];
}

export function getSelectedTemplate(data: AppData, selectedTemplateId: string): Template {
  return data.Templates.find((t) => t.Id === selectedTemplateId) ?? getActiveTemplate(data);
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}
