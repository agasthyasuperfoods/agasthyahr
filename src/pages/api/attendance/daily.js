// /pages/api/attendance/daily.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

const DAILY_TABLE = `"AttendanceDaily"`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const date = String(req.query?.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid or missing date (YYYY-MM-DD)" });
    }

    const client = await pool.connect();
    try {
      const q = `
        SELECT
          d.employeeid::text AS employeeid,
          COALESCE(d.name, '')     AS name,
          d.shift,
          d.intime,
          d.outtime,
          d.workdur,
          d.status,
          d.remarks,
          COALESCE(d.company, '')  AS company
        FROM ${DAILY_TABLE} d
        WHERE d.date = $1
        ORDER BY d.employeeid::text ASC
      `;
      const { rows } = await client.query(q, [date]);
      return res.status(200).json({ ok: true, date, rows });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/attendance/daily error:", e);
    return res.status(500).json({ error: "Failed to load daily attendance" });
  }
}
