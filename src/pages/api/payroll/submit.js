import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const tableForCompany = (company) => {
  switch ((company || "").toUpperCase()) {
    case "ASF": return "payroll_submissions_asf";
    // add more when you’re ready:
    // case "AGB": return "payroll_submissions_agb";
    default: throw new Error("Unsupported company");
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { month, company } = req.body || {};
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Invalid month" });
  if (!company) return res.status(400).json({ error: "Company required" });

  const client = await pool.connect();
  try {
    const table = tableForCompany(company);

    await client.query("BEGIN");

    // Re-run summary to freeze a clean snapshot
    const { rows: summary } = await client.query(
      `WITH m AS (
         SELECT date_trunc('month', to_date($1,'YYYY-MM'))::date AS start_date,
                (date_trunc('month', to_date($1,'YYYY-MM')) + interval '1 month' - interval '1 day')::date AS end_date
       ),
       cal AS ( SELECT (end_date - start_date + 1)::int AS days_in_month FROM m )
       SELECT
         e.employeeid, e.name, e.company, e.doj, e.designation,
         NULLIF(e.grosssalary,'')::numeric AS salary_per_month,
         (SELECT days_in_month FROM cal) AS actual_working_days,
         2::numeric AS current_month_eligibility,
         COALESCE(SUM(CASE
           WHEN (ad.status ILIKE 'P%' OR (ad.workdur > 0 AND ad.intime IS NOT NULL)) THEN 1 ELSE 0
         END),0)::int AS present_days,
         COALESCE(SUM(ad.workdur),0)::int AS work_minutes,
         COALESCE(SUM(CASE
           WHEN ad.status ILIKE ANY (ARRAY['LEAVE%','CL%','SL%','PL%','EL%']) THEN 1 ELSE 0
         END),0)::numeric AS leaves_taken,
         ROUND(COALESCE(SUM(CASE WHEN ad.status ILIKE 'LATE%' THEN 1 ELSE 0 END),0)::numeric / 6, 2) AS late_adj_days,
         ((SELECT days_in_month FROM cal) - COUNT(ad.date))::int AS missing_days,
         GREATEST(0,
           (2 + COALESCE(e.leaves_cf,0))
           - (COALESCE(SUM(CASE WHEN ad.status ILIKE ANY (ARRAY['LEAVE%','CL%','SL%','PL%','EL%']) THEN 1 ELSE 0 END),0)::numeric
              + ROUND(COALESCE(SUM(CASE WHEN ad.status ILIKE 'LATE%' THEN 1 ELSE 0 END),0)::numeric / 6, 2))
         ) AS leaves_cf_new,
         GREATEST(0,
           (COALESCE(SUM(CASE WHEN ad.status ILIKE ANY (ARRAY['LEAVE%','CL%','SL%','PL%','EL%']) THEN 1 ELSE 0 END),0)::numeric
            + ROUND(COALESCE(SUM(CASE WHEN ad.status ILIKE 'LATE%' THEN 1 ELSE 0 END),0)::numeric / 6, 2))
           - (2 + COALESCE(e.leaves_cf,0))
         ) AS lop_days
       FROM EmployeeTable e
       CROSS JOIN m
       LEFT JOIN AttendanceDaily ad
         ON ad.employeeid = e.employeeid
        AND ad.company    = e.company
        AND ad.date BETWEEN m.start_date AND m.end_date
       WHERE e.company = $2
       GROUP BY e.employeeid, e.name, e.company, e.doj, e.designation, e.grosssalary, e.leaves_cf
       ORDER BY e.name;`,
      [month, company]
    );

    // completeness check
    const missing = summary.reduce((acc, r) => acc + Number(r.missing_days || 0), 0);
    if (missing > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Month has ${missing} missing day entries.` });
    }

    // write snapshot
    await client.query(
      `INSERT INTO ${table} (month, payload_json)
       VALUES ($1, $2)
       ON CONFLICT (month) DO UPDATE SET payload_json = EXCLUDED.payload_json`,
      [month, JSON.stringify(summary)]
    );

    // OPTIONAL: update carry-forward for next month
    await client.query(
      `UPDATE EmployeeTable e
         SET leaves_cf = s.leaves_cf_new
       FROM (SELECT employeeid, leaves_cf_new FROM jsonb_to_recordset($1::jsonb)
             AS x(employeeid text, leaves_cf_new numeric)) s
       WHERE e.employeeid = s.employeeid AND e.company = $2`,
      [JSON.stringify(summary), company]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, saved: summary.length });
  } catch (e) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: e.message || "Submit failed" });
  } finally {
    client.release();
  }
}
