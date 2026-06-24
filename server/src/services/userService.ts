import bcrypt from "bcryptjs";
import { query } from "../db.js";

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export async function getAllUsers(): Promise<UserRecord[]> {
  return query<UserRecord[]>(
    "SELECT id, username, email, role, is_active, created_at, updated_at, last_login_at FROM users ORDER BY username"
  );
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const users = await query<UserRecord[]>(
    "SELECT id, username, email, role, is_active, created_at, updated_at, last_login_at FROM users WHERE id = ?",
    [id]
  );
  return users[0] || null;
}

export async function createUser(
  username: string,
  email: string,
  password: string,
  role: string
): Promise<UserRecord> {
  const existing = await query<UserRecord[]>(
    "SELECT id FROM users WHERE username = ? OR email = ?",
    [username, email]
  );
  if (existing.length > 0) {
    throw new Error("Benutzername oder E-Mail existiert bereits.");
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await query<{ insertId: number }>(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [username, email, hash, role]
  );

  const user = await getUserById(result.insertId);
  if (!user) throw new Error("Fehler beim Erstellen des Benutzers.");
  return user;
}

export async function updateUser(
  id: number,
  updates: Partial<{ username: string; email: string; password: string; role: string; is_active: number }>
): Promise<UserRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.username !== undefined) {
    sets.push("username = ?");
    params.push(updates.username);
  }
  if (updates.email !== undefined) {
    sets.push("email = ?");
    params.push(updates.email);
  }
  if (updates.password !== undefined) {
    const hash = await bcrypt.hash(updates.password, 12);
    sets.push("password_hash = ?");
    params.push(hash);
  }
  if (updates.role !== undefined) {
    sets.push("role = ?");
    params.push(updates.role);
  }
  if (updates.is_active !== undefined) {
    sets.push("is_active = ?");
    params.push(updates.is_active);
  }

  if (sets.length === 0) return getUserById(id);

  params.push(id);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  return getUserById(id);
}

export async function deleteUser(id: number): Promise<void> {
  await query("DELETE FROM users WHERE id = ?", [id]);
}
