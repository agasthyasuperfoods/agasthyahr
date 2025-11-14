// src/pages/api/attendance/late.js
// Returns per-employee late login counts and the computed "late_adj" (0.5 for every 3 late days)
// Rules:
// - Month is required ?month=YYYY-MM
// - Late if intime > 10:15 (default; override with ?threshold=HH:MM)
// - Exclude Sundays
// - Exclude holidays (if public."Holidays" exists; otherwise fallback without holidays)
// - Optional filter by ?company=XYZ

import { Pool } from "pg";

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const ssl =
    process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 10 });
  return _pool;
}

function parseMonth(m) {
  const s = String(m || "");
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [y, mm] = s.split("-").map(Number);
  const start = new Date(Date.UTC(y, mm - 1, 1));
  const end = new Date(Date.UTC(y, mm, 1));
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

function parseThreshold(t) {
  const s = String(t || "10:15").trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return "10:15";
  return s;
}

async function queryWithHolidays(pool, { startISO, endISO, company, threshold }) {
  const params = [startISO, endISO, threshold, company || null];
  const { rows } = await pool.query(
    `
    WITH scoped AS (
      SELECT d.employeeid,
             MAX(d.name) AS name,
             COUNT(*) FILTER (
               WHERE d.intime IS NOT NULL
                 AND d.intime::time > ($3::time)
             ) AS late_days
      FROM public."AttendanceDaily" d
      LEFT JOIN public."Holidays" h
        ON h.date = d.date
       AND ($4::text IS NULL OR h.company = $4) -- if Holidays has company column
      WHERE d.date >= $1::date
        AND d.date <  $2::date
        AND EXTRACT(DOW FROM d.date) <> 0  -- exclude Sundays
        AND ($4::text IS NULL OR d.company = $4)
        AND h.date IS NULL                 -- exclude holidays
      GROUP BY d.employeeid
    )
    SELECT employeeid,
           COALESCE(name, '') AS name,
           late_days::int,
           ( (late_days / 3)::int * 0.5 )::numeric AS late_adj
    FROM scoped
    ORDER BY employeeid;
    `,
    params
  );
  return rows;
}

async function queryWithoutHolidays(pool, { startISO, endISO, company, threshold }) {
  const params = [startISO, endISO, threshold, company || null];
  const { rows } = await pool.query(
    `
    WITH scoped AS (
      SELECT d.employeeid,
             MAX(d.name) AS name,
             COUNT(*) FILTER (
               WHERE d.intime IS NOT NULL
                 AND d.intime::time > ($3::time)
             ) AS late_days
      FROM public."AttendanceDaily" d
      WHERE d.date >= $1::date
        AND d.date <  $2::date
        AND EXTRACT(DOW FROM d.date) <> 0
        AND ($4::text IS NULL OR d.company = $4)
      GROUP BY d.employeeid
    )
    SELECT employeeid,
           COALESCE(name, '') AS name,
           late_days::int,
           ( (late_days / 3)::int * 0.5 )::numeric AS late_adj
    FROM scoped
    ORDER BY employeeid;
    `,
    params
  );
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const pool = getPool();
    const month = parseMonth(req.query.month);
    if (!month) return res.status(400).json({ ok: false, error: "month must be YYYY-MM" });

    const company = (req.query.company || "").trim() || null;
    const threshold = parseThreshold(req.query.threshold);

    let rows = [];
    try {
      // Try with Holidays table first
      rows = await queryWithHolidays(pool, { ...month, company, threshold });
    } catch (e) {
      // If Holidays table doesn't exist, fall back (error code 42P01)
      if (String(e?.code) === "42P01") {
        rows = await queryWithoutHolidays(pool, { ...month, company, threshold });
      } else {
        throw e;
      }
    }

    // Also return a handy map
    const map = {};
    for (const r of rows) map[String(r.employeeid).toUpperCase()] = Number(r.late_adj);

    return res.status(200).json({
      ok: true,
      month: req.query.month,
      company,
      threshold,
      rows,
      map,
    });
  } catch (e) {
    console.error("late.js error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
