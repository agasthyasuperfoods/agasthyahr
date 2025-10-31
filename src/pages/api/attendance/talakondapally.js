// pages/api/attendance/talakondapally.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

const isValidMonth = (m) => /^\d{4}-\d{2}$/.test(m);

// Find exact table via to_regclass or information_schema, then return { schema, table }
async function resolveAttendanceTable(client) {
  const candidates = [
    'public.talakondapally_attendance',
    'public.talakonda_attendance',
    'public."talakondapally_attendance"',
    'public."talakonda_attendance"',
  ];

  for (const rel of candidates) {
    const { rows } = await client.query(
      `SELECT n.nspname AS schema, c.relname AS table
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.oid = to_regclass($1);`,
      [rel]
    );
    if (rows[0]?.schema && rows[0]?.table) {
      return { schema: rows[0].schema, table: rows[0].table };
    }
  }

  // Fallback: scan information_schema for a plausible match
  const scan = await client.query(
    `
    SELECT table_schema AS schema, table_name AS table
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name ILIKE 'talak%attendance%';
    `
  );
  if (scan.rows.length > 0) {
    const preferred =
      scan.rows.find((r) => r.table.toLowerCase().includes('talakondapally')) ||
      scan.rows[0];
    return { schema: preferred.schema, table: preferred.table };
  }

  return null;
}

// Decide which date column to use
async function resolveDateExpr(client, schema, table) {
  const { rows } = await client.query(
    `
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2;
    `,
    [schema, table]
  );

  const cols = rows.map((r) => r.column_name.toLowerCase());
  const hasDate = cols.includes('date');
  const hasAttendanceDate = cols.includes('attendance_date');

  if (hasDate && hasAttendanceDate) return 'COALESCE(a.date, a.attendance_date)';
  if (hasDate) return 'a.date';
  if (hasAttendanceDate) return 'a.attendance_date';
  return null;
}

// Safe double-quote for identifiers
const dq = (s) => `"${String(s).replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const month = String(req.query?.month || "").trim();
    if (!isValidMonth(month)) return res.status(400).json({ error: "month is required in YYYY-MM format" });
    const monthStart = `${month}-01`;

    const client = await pool.connect();
    try {
      const att = await resolveAttendanceTable(client);
      if (!att) return res.status(500).json({ error: "Talakondapally attendance table not found in public schema" });

      const dateExpr = await resolveDateExpr(client, att.schema, att.table);
      if (!dateExpr) {
        return res.status(500).json({ error: `No date column found on ${att.schema}.${att.table} (expected 'date' or 'attendance_date')` });
      }

      // Compose quoted relation: "schema"."table"
      const fq = `${dq(att.schema)}.${dq(att.table)}`;

      // Final sanity check to avoid 42P01 before main query
      const chk = await client.query(`SELECT to_regclass($1) AS rel;`, [`${att.schema}.${att.table}`]);
      if (!chk.rows[0]?.rel) {
        return res.status(500).json({ error: `Attendance table not resolvable: ${att.schema}.${att.table}` });
      }

      const q = `
        SELECT
          e."Employeeid"  AS "EmployeeId",
          e.employee_name AS name,
          e.designation   AS designation,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(a.status) IN ('p','present') THEN 1
                WHEN LOWER(a.status) IN ('h','half','halfday','half-day') THEN 0.5
                ELSE 0
              END
            ), 0
          )               AS working_days
        FROM public.talakondapallyemployees e
        LEFT JOIN ${fq} a
          ON a."EmployeeId" = e."Employeeid"
         AND ${dateExpr} >= $1::date
         AND ${dateExpr} <  ($1::date + INTERVAL '1 month')
        GROUP BY e."Employeeid", e.employee_name, e.designation
        ORDER BY e.employee_name;
      `;
      const { rows } = await client.query(q, [monthStart]);
      return res.status(200).json({ ok: true, month, attendance: rows, from: `${att.schema}.${att.table}` });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/attendance/talakondapally error:", e);
    return res.status(500).json({ error: "Failed to load Talakondapally monthly attendance" });
  }
}
