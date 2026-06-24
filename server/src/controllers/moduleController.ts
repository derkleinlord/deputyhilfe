import type { Request, Response } from "express";
import * as moduleService from "../services/moduleService.js";
import * as templateService from "../services/templateService.js";
import { emitTemplateEvent } from "../socket.js";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const template = await templateService.getTemplateById(Number(req.params.templateId));
    if (!template) {
      res.status(404).json({ error: "Vorlage nicht gefunden." });
      return;
    }
    const module = await moduleService.createModule(Number(req.params.templateId), req.body);
    const updated = await templateService.getTemplateById(Number(req.params.templateId));
    emitTemplateEvent("template:modules-updated", updated);
    res.status(201).json(module);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const module = await moduleService.updateModule(Number(req.params.moduleId), req.body);
    if (!module) {
      res.status(404).json({ error: "Modul nicht gefunden." });
      return;
    }
    const updated = await templateService.getTemplateById(Number(req.params.templateId));
    emitTemplateEvent("template:modules-updated", updated);
    res.json(module);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await moduleService.deleteModule(Number(req.params.moduleId));
    const updated = await templateService.getTemplateById(Number(req.params.templateId));
    emitTemplateEvent("template:modules-updated", updated);
    res.json({ message: "Modul gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function reorder(req: Request, res: Response): Promise<void> {
  try {
    const { moduleIds } = req.body;
    if (!Array.isArray(moduleIds)) {
      res.status(400).json({ error: "moduleIds Array erforderlich." });
      return;
    }
    await moduleService.reorderModules(Number(req.params.templateId), moduleIds);
    const updated = await templateService.getTemplateById(Number(req.params.templateId));
    emitTemplateEvent("template:modules-updated", updated);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}
