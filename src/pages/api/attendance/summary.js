// /pages/api/attendance/summary.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

const EMP_TABLE = `public."EmployeeTable"`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const month = String(req.query?.month || "").trim();   // YYYY-MM
    const company = String(req.query?.company || "").trim();
    const location = String(req.query?.location || "").trim();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid month (expected YYYY-MM)" });
    }

    const where = [];
    const params = [];

    if (company) {
      params.push(company);
      where.push(`BTRIM(LOWER(e."company")) = BTRIM(LOWER($${params.length}))`);
    }
    if (location) {
      params.push(`%${location}%`);
      where.push(`COALESCE(e."Location",'') ILIKE $${params.length}`);
    }

    const q = `
      SELECT
        e."employeeid"::text              AS employeeid,
        COALESCE(e."name",'')            AS name,
        COALESCE(e."doj",'')             AS doj,
        COALESCE(e."designation",'')     AS designation,
        COALESCE(e."company",'')         AS company,
        NULL::integer                    AS actual_working_days,
        0::numeric                       AS leaves_taken,
        0::numeric                       AS late_adj_days,
        0::numeric                       AS lop_days,
        NULL::numeric                    AS leaves_cf_new,
        NULL::numeric                    AS present_days,
        NULLIF(TRIM(e."grosssalary"), '') AS salary_per_month_text,
        CASE WHEN LOWER(COALESCE(e."probation", '')) = 'yes' THEN 0 ELSE 2 END AS current_month_eligibility
      FROM ${EMP_TABLE} e
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY e."employeeid"
    `;
    const { rows } = await pool.query(q, params);

    const mapped = rows.map((r) => {
      const n = Number(String(r.salary_per_month_text || "").replace(/[, ]/g, ""));
      return {
        employeeid: r.employeeid,
        name: r.name,
        doj: r.doj,
        designation: r.designation,
        company: r.company,
        actual_working_days: r.actual_working_days,
        leaves_taken: Number(r.leaves_taken) || 0,
        late_adj_days: Number(r.late_adj_days) || 0,
        lop_days: Number(r.lop_days) || 0,
        leaves_cf_new: r.leaves_cf_new == null ? null : Number(r.leaves_cf_new),
        present_days: r.present_days == null ? null : Number(r.present_days),
        salary_per_month: Number.isFinite(n) ? n : (r.salary_per_month_text || null),
        current_month_eligibility: r.current_month_eligibility,
      };
    });

    return res.status(200).json({
      rows: mapped,
      is_complete: true,
      total_missing_days: 0,
    });
  } catch (e) {
    console.error("GET /api/attendance/summary failed:", e);
    return res.status(500).json({ error: "Failed to load summary" });
  }
}
