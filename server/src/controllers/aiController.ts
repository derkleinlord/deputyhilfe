import type { Request, Response } from "express";
import { proofreadText } from "../services/aiService.js";

export async function proofread(req: Request, res: Response): Promise<void> {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Textfeld ist erforderlich." });
      return;
    }

    if (text.length > 50_000) {
      res.status(400).json({ error: "Text ist zu lang (max. 50.000 Zeichen)." });
      return;
    }

    const result = await proofreadText(text, req.user!.userId);
    res.json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("Zu viele")) {
      res.status(429).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
}
