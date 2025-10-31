import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

const isValidMonth = (m) => /^\d{4}-\d{2}$/.test(m);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const month = String(req.query?.month || "").trim();
    if (!isValidMonth(month)) return res.status(400).json({ error: "month is required in YYYY-MM format" });
    const monthStart = `${month}-01`;

    const client = await pool.connect();
    try {
      const q = `
        SELECT
          e."Employeeid"      AS "EmployeeId",
          e.employee_name     AS name,
          e.designation       AS designation,
          e."Gross_Salary"    AS gross_salary,
          e."Advances"        AS advances,
          COALESCE(e."Food_Expenses"::integer, 0) AS food_expenses,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(a.status) IN ('p','present') THEN 1
                WHEN LOWER(a.status) IN ('h','half','halfday','half-day') THEN 0.5
                ELSE 0
              END
            ), 0
          ) AS working_days,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(a.status) IN ('a','absent') THEN 1
                ELSE 0
              END
            ), 0
          ) AS absent_days
        FROM public.tanduremployees e
        LEFT JOIN public.tandur_attendance a
          ON a."EmployeeId" = e."Employeeid"
         AND a.date >= $1::date
         AND a.date < ($1::date + INTERVAL '1 month')
        GROUP BY e."Employeeid", e.employee_name, e.designation, e."Gross_Salary", e."Advances", e."Food_Expenses"
        ORDER BY e.designation, e.employee_name;
      `;
      const { rows } = await client.query(q, [monthStart]);
      return res.status(200).json({ ok: true, month, attendance: rows });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/attendance/tandur error:", e);
    return res.status(500).json({ error: "Failed to load Tandur monthly attendance" });
  }
}
