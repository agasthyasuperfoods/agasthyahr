// src/pages/api/documents.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, url, NOW() AS updated_at FROM public.documents ORDER BY id DESC`
    );
    return res.status(200).json({ data: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
}
