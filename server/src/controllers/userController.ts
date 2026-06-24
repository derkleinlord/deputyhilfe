import type { Request, Response } from "express";
import * as userService from "../services/userService.js";

export async function getAll(_req: Request, res: Response): Promise<void> {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const user = await userService.getUserById(Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: "Benutzer nicht gefunden." });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: "Benutzername, E-Mail und Passwort erforderlich." });
      return;
    }
    const user = await userService.createUser(username, email, password, role || "user");
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const user = await userService.updateUser(Number(req.params.id), req.body);
    if (!user) {
      res.status(404).json({ error: "Benutzer nicht gefunden." });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function remove(_req: Request, res: Response): Promise<void> {
  try {
    const id = Number(_req.params.id);
    if (_req.user?.userId === id) {
      res.status(400).json({ error: "Sie können sich nicht selbst löschen." });
      return;
    }
    await userService.deleteUser(id);
    res.json({ message: "Benutzer gelöscht." });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
