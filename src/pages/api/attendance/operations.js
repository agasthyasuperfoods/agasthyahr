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
          e.id                AS "EmployeeId",
          e."Name"            AS name,
          e."Designation"     AS designation,
          e."Gross Salary"    AS gross_salary,
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
        FROM public."Milk_point_Employees" e
        LEFT JOIN public."Milk_point_Employees_Attendance" a
          ON a.employeeid = e.id::text
         AND a.date >= $1::date
         AND a.date < ($1::date + INTERVAL '1 month')
        WHERE LOWER(COALESCE(e."Location", '')) = 'operations'
        GROUP BY e.id, e."Name", e."Designation", e."Gross Salary"
        ORDER BY e."Designation", e."Name";
      `;
      
      const { rows } = await client.query(q, [monthStart]);
      return res.status(200).json({ ok: true, month, attendance: rows });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/attendance/operations error:", e);
    return res.status(500).json({ error: "Failed to load Operations monthly attendance" });
  }
}
