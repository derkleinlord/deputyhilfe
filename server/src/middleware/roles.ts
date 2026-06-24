import type { Request, Response, NextFunction } from "express";

type Role = "admin" | "template_manager" | "user";

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Nicht authentifiziert." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Keine Berechtigung für diese Aktion." });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireTemplateManager = requireRole("admin", "template_manager");
export const requireAdminOrOwner = (userIdField: string = "userId") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Nicht authentifiziert." });
      return;
    }
    if (req.user.role === "admin") {
      next();
      return;
    }
    const targetId = Number(req.params[userIdField] || req.body[userIdField]);
    if (targetId && targetId !== req.user.userId) {
      res.status(403).json({ error: "Keine Berechtigung für diesen Benutzer." });
      return;
    }
    next();
  };
};
