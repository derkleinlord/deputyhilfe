import type { Request, Response } from "express";
import * as tgService from "../services/telegramListService.js";

function userId(req: Request): number {
  return req.user!.userId;
}

export async function getLists(req: Request, res: Response): Promise<void> {
  try {
    const lists = await tgService.getListsForUser(userId(req));
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getList(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    const lists = await tgService.getListsForUser(userId(req));
    const accessible = lists.find((l) => l.id === list.id);
    if (!accessible) { res.status(403).json({ error: "Keine Berechtigung." }); return; }
    res.json(accessible);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function createList(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: "Name erforderlich." }); return; }
    const list = await tgService.createList(name.trim(), userId(req));
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateList(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann die Liste bearbeiten." }); return;
    }
    const { name } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: "Name erforderlich." }); return; }
    const updated = await tgService.updateList(list.id, name.trim());
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function deleteList(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann die Liste löschen." }); return;
    }
    await tgService.deleteList(list.id);
    res.json({ message: "Liste gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getEntries(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    const lists = await tgService.getListsForUser(userId(req));
    if (!lists.find((l) => l.id === list.id)) {
      res.status(403).json({ error: "Keine Berechtigung." }); return;
    }
    const entries = await tgService.getEntriesByListId(list.id);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function createEntry(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann Einträge hinzufügen." }); return;
    }
    const { name, tg_number, company, note } = req.body;
    if (!name || !name.trim() || !tg_number || !tg_number.trim()) {
      res.status(400).json({ error: "Name und TG-Nummer erforderlich." }); return;
    }
    const entry = await tgService.createEntry(list.id, name.trim(), tg_number.trim(), company || null, note || null);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateEntry(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann Einträge bearbeiten." }); return;
    }
    const entry = await tgService.getEntryById(Number(req.params.entryId));
    if (!entry) { res.status(404).json({ error: "Eintrag nicht gefunden." }); return; }
    const updated = await tgService.updateEntry(entry.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function deleteEntry(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann Einträge löschen." }); return;
    }
    await tgService.deleteEntry(Number(req.params.entryId));
    res.json({ message: "Eintrag gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getShares(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    const lists = await tgService.getListsForUser(userId(req));
    if (!lists.find((l) => l.id === list.id)) {
      res.status(403).json({ error: "Keine Berechtigung." }); return;
    }
    const shares = await tgService.getSharesByListId(list.id);
    res.json(shares);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function createShare(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann Freigaben verwalten." }); return;
    }
    const { shared_with_user_id, group_name, shared_with_all } = req.body;
    if (!shared_with_user_id && !group_name && !shared_with_all) {
      res.status(400).json({ error: "Bitte einen Freigabetyp angeben." }); return;
    }
    const share = await tgService.createShare(list.id, shared_with_user_id || null, group_name || null, !!shared_with_all);
    res.status(201).json(share);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function deleteShare(req: Request, res: Response): Promise<void> {
  try {
    const list = await tgService.getListById(Number(req.params.id));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden." }); return; }
    if (list.owner_id !== userId(req) && req.user!.role !== "admin") {
      res.status(403).json({ error: "Nur der Besitzer kann Freigaben löschen." }); return;
    }
    await tgService.deleteShare(Number(req.params.shareId));
    res.json({ message: "Freigabe gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getMyGroups(req: Request, res: Response): Promise<void> {
  try {
    const groups = await tgService.getGroupMembers(userId(req));
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function joinGroup(req: Request, res: Response): Promise<void> {
  try {
    const { group_name } = req.body;
    if (!group_name || !group_name.trim()) { res.status(400).json({ error: "Gruppenname erforderlich." }); return; }
    await tgService.joinGroup(group_name.trim(), userId(req));
    res.json({ message: "Gruppe beigetreten." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function leaveGroup(req: Request, res: Response): Promise<void> {
  try {
    const { group_name } = req.body;
    if (!group_name || !group_name.trim()) { res.status(400).json({ error: "Gruppenname erforderlich." }); return; }
    await tgService.leaveGroup(group_name.trim(), userId(req));
    res.json({ message: "Gruppe verlassen." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await tgService.getActiveUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
