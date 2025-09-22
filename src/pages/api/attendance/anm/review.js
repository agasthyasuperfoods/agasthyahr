// src/pages/api/attendance/anm/review.js
import pool from "@/lib/db";

const TABLES = {
  tandur: { table: `public.tandur_attendance`, reviewCol: `"Review"` },         // NOTE: capital R
  talakondapally: { table: `public.talakondapally_attendance`, reviewCol: `review` }, // NOTE: lowercase
};

function isYyyyMmDd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const site = String(req.query.site || "").toLowerCase();
    const meta = TABLES[site];
    if (!meta) return res.status(400).json({ error: "Invalid site", sites: Object.keys(TABLES) });

    const { date, review } = req.body || {};
    if (!isYyyyMmDd(date)) return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });

    const sql = `
      UPDATE ${meta.table}
      SET ${meta.reviewCol} = $1
      WHERE "date"::date = $2::date
    `;
    const r = await pool.query(sql, [String(review || "Submitted"), date]);

    return res.status(200).json({ updated: r.rowCount || 0 });
  } catch (e) {
    console.error("ANM review update error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
