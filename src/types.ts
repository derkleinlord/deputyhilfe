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

export type ViewType = "write" | "templates" | "drafts" | "users";

export type UserRole = "admin" | "template_manager" | "user";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

// API-compatible template types
export interface ApiTemplate {
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
  modules: ApiModule[];
}

export interface ApiModule {
  id: number;
  template_id: number;
  label: string;
  field_type: ModuleType;
  placeholder: string | null;
  bullet_prefix: string | null;
  show_heading: number;
  rows_json: string | null;
  position: number;
}

export interface ApiDraft {
  id: number;
  user_id: number;
  template_id: number;
  title: string;
  form_data_json: string;
  template_name?: string;
  created_at: string;
  updated_at: string;
}
