// /pages/api/auth/reset/complete.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

const SECRET = process.env.RESET_TOKEN_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, password } = req.body || {};
    const pwd = String(password || "");

    if (!token || !pwd || pwd.length < 8) {
      return res.status(400).json({ error: "Token and a minimum 8-char password are required" });
    }

    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    if (payload?.t !== "pwd_reset" || !payload?.email) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const hash = await bcrypt.hash(pwd, 10);

    // Update password (adjust table/column names if needed)
    // Expecting `users` table with `email` and `password_hash`
    const { rowCount } = await query(
      `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE LOWER(email)=LOWER($2)`,
      [hash, payload.email]
    );

    if (!rowCount) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
