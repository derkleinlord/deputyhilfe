export interface AppData {
  SchemaVersion: number;
  Templates: Template[];
  ActiveTemplateId: string;
  Autosaves: Record<string, FormData>;
}

export interface Template {
  Id: string;
  Name: string;
  TitleTemplate: string;
  Header: string;
  Heading: string;
  Separator: string;
  IncludeTitleByDefault: boolean;
  SortOrder: number;
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

export type ViewType = "write" | "templates" | "users" | "telegramlists";

export type UserRole = "admin" | "template_manager" | "user";

export interface User {
  id: number;
  username: string;
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
  sort_order: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  modules: ApiModule[];
}

export interface ProofreadSuggestion {
  original: string;
  replacement: string;
  category: "Rechtschreibung" | "Grammatik" | "Zeichensetzung" | "Stil";
  reason: string;
  confidence: "safe" | "review";
}

export interface ProofreadResponse {
  suggestions: ProofreadSuggestion[];
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

export interface TelegramList {
  id: number;
  name: string;
  owner_id: number;
  owner_name: string;
  access_type: "owner" | "shared_with_me" | "shared_with_group" | "public";
  created_at: string;
  updated_at: string;
}

export interface TelegramEntry {
  id: number;
  list_id: number;
  name: string;
  tg_number: string;
  company: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TelegramShare {
  id: number;
  list_id: number;
  shared_with_user_id: number | null;
  shared_with_username: string | null;
  group_name: string | null;
  shared_with_all: number;
  created_at: string;
}

export interface TelegramGroupMember {
  id: number;
  group_name: string;
  user_id: number;
  created_at: string;
}

export interface TelegramUserBrief {
  id: number;
  username: string;
}
