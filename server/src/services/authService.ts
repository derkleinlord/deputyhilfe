import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { config } from "../config.js";
import type { JwtPayload } from "../middleware/auth.js";

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: "admin" | "template_manager" | "user";
  is_active: number;
}

export async function login(identifier: string, password: string) {
  const users = await query<UserRow[]>(
    "SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1",
    [identifier, identifier]
  );

  const user = users[0];
  if (!user) {
    throw new Error("Ungültige Anmeldedaten.");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error("Ungültige Anmeldedaten.");
  }

  await query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);

  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const token = jwt.sign(payload as object, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string | number,
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}
