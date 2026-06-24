import type { Request, Response } from "express";
import * as draftService from "../services/draftService.js";

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.role === "admin";
    const drafts = isAdmin
      ? await draftService.getAllDrafts()
      : await draftService.getDraftsByUser(req.user!.userId);
    res.json(drafts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const draft = await draftService.getDraftById(Number(req.params.id));
    if (!draft) {
      res.status(404).json({ error: "Entwurf nicht gefunden." });
      return;
    }
    if (req.user?.role !== "admin" && draft.user_id !== req.user!.userId) {
      res.status(403).json({ error: "Keine Berechtigung." });
      return;
    }
    res.json(draft);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const { templateId, title, formData } = req.body;
    if (!templateId || !formData) {
      res.status(400).json({ error: "templateId und formData erforderlich." });
      return;
    }
    const draft = await draftService.createDraft(
      req.user!.userId,
      templateId,
      title || "",
      JSON.stringify(formData)
    );
    res.status(201).json(draft);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const existing = await draftService.getDraftById(Number(req.params.id));
    if (!existing) {
      res.status(404).json({ error: "Entwurf nicht gefunden." });
      return;
    }
    if (req.user?.role !== "admin" && existing.user_id !== req.user!.userId) {
      res.status(403).json({ error: "Keine Berechtigung." });
      return;
    }
    const { title, formData } = req.body;
    const draft = await draftService.updateDraft(
      Number(req.params.id),
      title || existing.title,
      formData ? JSON.stringify(formData) : existing.form_data_json
    );
    res.json(draft);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const existing = await draftService.getDraftById(Number(req.params.id));
    if (!existing) {
      res.status(404).json({ error: "Entwurf nicht gefunden." });
      return;
    }
    if (req.user?.role !== "admin" && existing.user_id !== req.user!.userId) {
      res.status(403).json({ error: "Keine Berechtigung." });
      return;
    }
    await draftService.deleteDraft(Number(req.params.id));
    res.json({ message: "Entwurf gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
