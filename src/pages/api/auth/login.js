// pages/api/auth/login.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { identifier, password } = req.body || {};
    if (!identifier?.trim() || !password?.trim()) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // Look up by name in 'admin' table
    const { rows } = await pool.query(
      `SELECT password FROM public.admin WHERE name = $1 LIMIT 1`,
      [identifier.trim()]
    );

    if (!rows?.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const dbPass = rows[0].password ?? "";
    // Plain text comparison (since your table stores plain password)
    if (dbPass !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // All good
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
