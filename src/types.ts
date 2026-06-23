export interface AppData {
  SchemaVersion: number;
  Templates: Template[];
  ActiveTemplateId: string;
  Autosaves: Record<string, FormData>;
  Drafts: Draft[];
}

export interface Template {
  Id: string;
  Name: string;
  TitleTemplate: string;
  Header: string;
  Heading: string;
  Separator: string;
  IncludeTitleByDefault: boolean;
  Modules: Module[];
}

export interface Module {
  Id: string;
  Label: string;
  Type: ModuleType;
  Placeholder: string;
  Rows: KeyValueRow[];
  RenderHeading: boolean;
  BulletPrefix: string | null;
}

export interface KeyValueRow {
  Label: string;
  Unit: string;
}

export type ModuleType = keyof typeof moduleTypeMap;

export const moduleTypeMap = {
  text: "Einzeilig",
  multiline: "Mehrzeilig",
  bullets: "Stichpunkte",
  keyValues: "Beschriftete Liste"
} as const;

export interface FormData {
  Title: string;
  IncludeTitle: boolean;
  Values: Record<string, ModuleValue>;
}

export interface ModuleValue {
  Text: string;
  Rows: Record<string, string>;
}

export interface Draft {
  Id: string;
  Name: string;
  TemplateId: string;
  TemplateName: string;
  Data: FormData;
  UpdatedAt: string;
}

export type ViewType = "write" | "templates" | "drafts";
