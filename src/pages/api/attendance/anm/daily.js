// src/pages/api/attendance/anm/daily.js
import pool from "@/lib/db";

/**
 * Return rows for a single date.
 * We map EmployeeId -> si in the API response to match the UI.
 */
const TABLES = {
  tandur: `public.tandur_attendance`,
  talakondapally: `public.talakondapally_attendance`,
};

function isYyyyMmDd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const site = String(req.query.site || "").toLowerCase();
    const date = String(req.query.date || "");
    const table = TABLES[site];

    if (!table) return res.status(400).json({ error: "Invalid site", sites: Object.keys(TABLES) });
    if (!isYyyyMmDd(date)) return res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });

    const { rows } = await pool.query(
      `
      SELECT "EmployeeId", name, status, "date"
      FROM ${table}
      WHERE "date"::date = $1::date
      ORDER BY "EmployeeId" ASC
      `,
      [date]
    );

    // Map to UI shape { si, name, status, date }
    const mapped = rows.map(r => ({
      si: Number(r.EmployeeId),
      name: r.name,
      status: r.status,
      date: r.date?.toISOString?.()?.slice(0, 10) ?? String(r.date),
    }));

    return res.status(200).json({ rows: mapped, count: mapped.length });
  } catch (e) {
    console.error("ANM daily fetch error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
