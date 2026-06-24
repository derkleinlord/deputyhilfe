import bcrypt from "bcryptjs";
import { query } from "../db.js";

async function seed() {
  const existingAdmin = await query<{ count: number }[]>("SELECT COUNT(*) as count FROM users WHERE role = ?", ["admin"]);
  if (existingAdmin[0].count > 0) {
    console.log("Admin user already exists, skipping seed.");
    process.exit(0);
  }

  const hash = await bcrypt.hash("admin123", 12);
  await query(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
    ["admin", "admin@aktenschreiben.local", hash, "admin"]
  );
  console.log("Default admin user created: admin / admin123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
