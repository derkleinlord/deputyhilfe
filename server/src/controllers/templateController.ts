import type { Request, Response } from "express";
import * as templateService from "../services/templateService.js";
import { emitTemplateEvent } from "../socket.js";

export async function getAll(_req: Request, res: Response): Promise<void> {
  try {
    const templates = await templateService.getAllTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const template = await templateService.getTemplateById(Number(req.params.id));
    if (!template) {
      res.status(404).json({ error: "Vorlage nicht gefunden." });
      return;
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const template = await templateService.createTemplate({
      ...req.body,
      created_by: req.user?.userId,
    });
    emitTemplateEvent("template:created", template);
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const template = await templateService.updateTemplate(Number(req.params.id), req.body);
    if (!template) {
      res.status(404).json({ error: "Vorlage nicht gefunden." });
      return;
    }
    emitTemplateEvent("template:updated", template);
    res.json(template);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await templateService.deleteTemplate(Number(req.params.id));
    emitTemplateEvent("template:deleted", { id: Number(req.params.id) });
    res.json({ message: "Vorlage gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function duplicate(req: Request, res: Response): Promise<void> {
  try {
    const template = await templateService.duplicateTemplate(
      Number(req.params.id),
      req.body.name as string | undefined,
      req.user?.userId
    );
    if (!template) {
      res.status(404).json({ error: "Vorlage nicht gefunden." });
      return;
    }
    emitTemplateEvent("template:created", template);
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}
