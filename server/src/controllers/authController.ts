import type { Request, Response } from "express";
import * as authService from "../services/authService.js";

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: "Benutzername und Passwort erforderlich." });
      return;
    }

    const result = await authService.login(identifier, password);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: result.user, token: result.token });
  } catch (error) {
    res.status(401).json({ error: (error as Error).message });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("token");
  res.json({ message: "Erfolgreich abgemeldet." });
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user });
}
