// src/pages/api/attendance/anm/daily.js
import pool from "@/lib/db";

const TABLES = {
  tandur: "public.tandur",
  thalakondapallya: "public.thalakondapallya",
};

function isYyyyMmDd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const site = String(req.query.site || "").toLowerCase();
    const date = String(req.query.date || ""); // YYYY-MM-DD

    const table = TABLES[site];
    if (!table) return res.status(400).json({ error: "Invalid site", sites: Object.keys(TABLES) });
    if (!isYyyyMmDd(date)) return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });

    // NOTE: Column names:
    // - Your table shows "SI" (uppercase) as integer primary key, "name" (text), "date" (date), "status" (text).
    // - We alias "SI" -> si and "date" -> date to keep the frontend simple.
    const sql = `
      SELECT "SI" AS si, name, "date"::date AS date, status
      FROM ${table}
      WHERE "date"::date = $1::date
      ORDER BY "SI" ASC
    `;
    const { rows } = await pool.query(sql, [date]);

    return res.status(200).json({ rows });
  } catch (e) {
    console.error("ANM daily fetch error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
