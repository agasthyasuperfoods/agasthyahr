import pool from "@/lib/db";

export default async function handler(req, res) {
  try {
    const month = String(req.query.month || "").slice(0, 7); // YYYY-MM
    const company = String(req.query.company || "").trim();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid month" });
    }

    // Stub: project employees into “summary-like” rows; scope by company
    const sql = `
      SELECT
        e."employeeid",
        e."name",
        e."doj",
        e."designation",
        e."company",
        NULL::integer AS actual_working_days,
        0::integer    AS leaves_taken,
        0::integer    AS late_adj_days,
        0::integer    AS lop_days,
        NULL::integer AS leaves_cf_new,
        NULL::integer AS present_days,
        NULLIF(TRIM(e."grosssalary"), '') AS salary_per_month_text,
        CASE WHEN LOWER(COALESCE(e."probation", '')) = 'yes' THEN 0 ELSE 2 END AS current_month_eligibility
      FROM public."EmployeeTable" e
      WHERE ($1 = '' OR LOWER(TRIM(e."company")) = LOWER(TRIM($1)))
      ORDER BY e."employeeid"
    `;
    const { rows } = await pool.query(sql, [company]);

    const mapped = rows.map((r) => {
      const n = Number(String(r.salary_per_month_text || "").replace(/[, ]/g, ""));
      return { ...r, salary_per_month: Number.isFinite(n) ? n : (r.salary_per_month_text || null) };
    });

    res.status(200).json({ rows: mapped, is_complete: true, total_missing_days: 0 });
  } catch (e) {
    console.error("GET /api/attendance/summary failed:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
}
