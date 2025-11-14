// /pages/api/attendance/daily.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

const DAILY_TABLE = `"AttendanceDaily"`;
const EMP_TABLE = `public."EmployeeTable"`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const date = String(req.query?.date || "").trim();   // YYYY-MM-DD
    const month = String(req.query?.month || "").trim(); // YYYY-MM
    const company = String(req.query?.company || "").trim();
    const location = String(req.query?.location || "").trim(); // e.g. "HO"

    const client = await pool.connect();
    try {
      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ error: "Invalid month format (expected YYYY-MM)" });
        }
        const monthStart = `${month}-01`;
        const params = [monthStart, company, location ? `%${location}%` : ""];
        const q = `
          SELECT
            d.employeeid::text AS employeeid,
            COALESCE(d.name, '')     AS name,
            d.status,
            d.date::date             AS date,
            COALESCE(d.company, '')  AS company
          FROM ${DAILY_TABLE} d
          LEFT JOIN ${EMP_TABLE} e
            ON e."employeeid" = d.employeeid::text
          WHERE d.date >= $1::date
            AND d.date < ($1::date + INTERVAL '1 month')
            AND ($2::text = '' OR d.company = $2::text)
            AND ($3::text = '' OR COALESCE(e."Location",'') ILIKE $3)
          ORDER BY d.employeeid::text ASC, d.date ASC
        `;
        const { rows } = await client.query(q, params);
        return res.status(200).json({ ok: true, month, rows });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid or missing date (YYYY-MM-DD)" });
      }

      const params = [date, company, location ? `%${location}%` : ""];
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
        LEFT JOIN ${EMP_TABLE} e
          ON e."employeeid" = d.employeeid::text
        WHERE d.date = $1::date
          AND ($2::text = '' OR d.company = $2::text)
          AND ($3::text = '' OR COALESCE(e."Location",'') ILIKE $3)
        ORDER BY d.employeeid::text ASC
      `;
      const { rows } = await client.query(q, params);
      return res.status(200).json({ ok: true, date, rows });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/attendance/daily error:", e);
    return res.status(500).json({ error: "Failed to load daily attendance" });
  }
}
