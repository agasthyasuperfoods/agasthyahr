// /src/pages/api/auth/reset/complete.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

const SECRET = process.env.RESET_TOKEN_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, password } = req.body || {};
    const pwd = String(password || "");

    if (!token || pwd.length < 4) {
      return res.status(400).json({ error: "Token and a minimum 4-char password are required" });
    }

    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    if (payload?.typ !== "pwreset" || !payload?.email) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const hash = await bcrypt.hash(pwd, 10);

    // Try schema A: password_hash + updated_at
    let result;
    try {
      const sqlA = `UPDATE "EmployeeTable"
                    SET password_hash=$1, updated_at=NOW()
                    WHERE LOWER(email)=LOWER($2)`;
      result = await pool.query(sqlA, [hash, payload.email]);
    } catch (e) {
      // If column missing (42703), fall back to schema B: "password" only
      if (e?.code !== "42703") throw e;
      const sqlB = `UPDATE "EmployeeTable"
                    SET "password"=$1
                    WHERE LOWER(email)=LOWER($2)`;
      result = await pool.query(sqlB, [hash, payload.email]);
    }

    if (!result.rowCount) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
