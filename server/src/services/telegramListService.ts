import { query } from "../db.js";

export interface TelegramListRecord {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface TelegramEntryRecord {
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

export interface TelegramShareRecord {
  id: number;
  list_id: number;
  shared_with_user_id: number | null;
  group_name: string | null;
  shared_with_all: number;
  created_at: string;
}

export interface TelegramGroupMemberRecord {
  id: number;
  group_name: string;
  user_id: number;
  created_at: string;
}

export interface ListWithAccess extends TelegramListRecord {
  owner_name: string;
  access_type: "owner" | "shared_with_me" | "shared_with_group" | "public";
}

export interface ShareWithUser extends TelegramShareRecord {
  shared_with_username: string | null;
}

export async function getListsForUser(userId: number): Promise<ListWithAccess[]> {
  return query<ListWithAccess[]>(
    `SELECT DISTINCT l.*, u.username AS owner_name,
      CASE
        WHEN l.owner_id = ? THEN 'owner'
        WHEN s.shared_with_user_id = ? THEN 'shared_with_me'
        WHEN s.group_name IS NOT NULL AND gm.user_id = ? THEN 'shared_with_group'
        WHEN s.shared_with_all = 1 THEN 'public'
      END AS access_type
    FROM telegram_lists l
    JOIN users u ON u.id = l.owner_id
    LEFT JOIN telegram_shares s ON s.list_id = l.id
    LEFT JOIN telegram_group_members gm ON gm.group_name = s.group_name AND gm.user_id = ?
    WHERE l.owner_id = ?
       OR s.shared_with_user_id = ?
       OR s.shared_with_all = 1
       OR (s.group_name IS NOT NULL AND gm.user_id = ?)
    ORDER BY l.name`,
    [userId, userId, userId, userId, userId, userId, userId]
  );
}

export async function getListById(id: number): Promise<TelegramListRecord | null> {
  const rows = await query<TelegramListRecord[]>(
    "SELECT * FROM telegram_lists WHERE id = ?", [id]
  );
  return rows[0] || null;
}

export async function createList(name: string, ownerId: number): Promise<TelegramListRecord> {
  const result = await query<{ insertId: number }>(
    "INSERT INTO telegram_lists (name, owner_id) VALUES (?, ?)",
    [name, ownerId]
  );
  const list = await getListById(result.insertId);
  if (!list) throw new Error("Fehler beim Erstellen der Liste.");
  return list;
}

export async function updateList(id: number, name: string): Promise<TelegramListRecord | null> {
  await query("UPDATE telegram_lists SET name = ? WHERE id = ?", [name, id]);
  return getListById(id);
}

export async function deleteList(id: number): Promise<void> {
  await query("DELETE FROM telegram_lists WHERE id = ?", [id]);
}

export async function getEntriesByListId(listId: number): Promise<TelegramEntryRecord[]> {
  return query<TelegramEntryRecord[]>(
    "SELECT * FROM telegram_entries WHERE list_id = ? ORDER BY sort_order, name",
    [listId]
  );
}

export async function getEntryById(id: number): Promise<TelegramEntryRecord | null> {
  const rows = await query<TelegramEntryRecord[]>(
    "SELECT * FROM telegram_entries WHERE id = ?", [id]
  );
  return rows[0] || null;
}

export async function createEntry(
  listId: number,
  name: string,
  tgNumber: string,
  company: string | null,
  note: string | null
): Promise<TelegramEntryRecord> {
  const result = await query<{ insertId: number }>(
    "INSERT INTO telegram_entries (list_id, name, tg_number, company, note) VALUES (?, ?, ?, ?, ?)",
    [listId, name, tgNumber, company || null, note || null]
  );
  const entry = await getEntryById(result.insertId);
  if (!entry) throw new Error("Fehler beim Erstellen des Eintrags.");
  return entry;
}

export async function updateEntry(
  id: number,
  updates: { name?: string; tg_number?: string; company?: string | null; note?: string | null }
): Promise<TelegramEntryRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.name !== undefined) { sets.push("name = ?"); params.push(updates.name); }
  if (updates.tg_number !== undefined) { sets.push("tg_number = ?"); params.push(updates.tg_number); }
  if (updates.company !== undefined) { sets.push("company = ?"); params.push(updates.company || null); }
  if (updates.note !== undefined) { sets.push("note = ?"); params.push(updates.note || null); }
  if (sets.length === 0) return getEntryById(id);
  params.push(id);
  await query(`UPDATE telegram_entries SET ${sets.join(", ")} WHERE id = ?`, params);
  return getEntryById(id);
}

export async function deleteEntry(id: number): Promise<void> {
  await query("DELETE FROM telegram_entries WHERE id = ?", [id]);
}

export async function getSharesByListId(listId: number): Promise<ShareWithUser[]> {
  return query<ShareWithUser[]>(
    `SELECT s.*, u.username AS shared_with_username
     FROM telegram_shares s
     LEFT JOIN users u ON u.id = s.shared_with_user_id
     WHERE s.list_id = ?`,
    [listId]
  );
}

export async function createShare(
  listId: number,
  sharedWithUserId: number | null,
  groupName: string | null,
  sharedWithAll: boolean
): Promise<TelegramShareRecord> {
  const result = await query<{ insertId: number }>(
    "INSERT INTO telegram_shares (list_id, shared_with_user_id, group_name, shared_with_all) VALUES (?, ?, ?, ?)",
    [listId, sharedWithUserId, groupName, sharedWithAll ? 1 : 0]
  );
  const rows = await query<TelegramShareRecord[]>(
    "SELECT * FROM telegram_shares WHERE id = ?", [result.insertId]
  );
  return rows[0];
}

export async function deleteShare(id: number): Promise<void> {
  await query("DELETE FROM telegram_shares WHERE id = ?", [id]);
}

export async function getGroupMembers(userId: number): Promise<TelegramGroupMemberRecord[]> {
  return query<TelegramGroupMemberRecord[]>(
    "SELECT * FROM telegram_group_members WHERE user_id = ? ORDER BY group_name",
    [userId]
  );
}

export async function joinGroup(groupName: string, userId: number): Promise<void> {
  await query(
    "INSERT IGNORE INTO telegram_group_members (group_name, user_id) VALUES (?, ?)",
    [groupName, userId]
  );
}

export async function leaveGroup(groupName: string, userId: number): Promise<void> {
  await query(
    "DELETE FROM telegram_group_members WHERE group_name = ? AND user_id = ?",
    [groupName, userId]
  );
}

export async function getActiveUsers(): Promise<{ id: number; username: string }[]> {
  return query<{ id: number; username: string }[]>(
    "SELECT id, username FROM users WHERE is_active = 1 ORDER BY username"
  );
}
