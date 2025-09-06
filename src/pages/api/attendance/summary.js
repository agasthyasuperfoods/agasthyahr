import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Attendance / Employee table candidates
const ATTENDANCE_TABLE_CANDIDATES = [
  "public.attendancedaily",
  "public.attendance_daily",
  "public.attendance",
  "attendancedaily",
  "attendance_daily",
  "attendance",
  'public."AttendanceDaily"',
  '"AttendanceDaily"',
  'public."Attendance"',
  '"Attendance"',
];

const EMPLOYEE_TABLE_CANDIDATES = [
  "public.employeetable",
  "public.employee_table",
  "public.employees",
  "public.users",
  "employeetable",
  "employee_table",
  "employees",
  "users",
  'public."EmployeeTable"',
  '"EmployeeTable"',
  'public."Employees"',
  '"Employees"',
  'public."Users"',
  '"Users"',
];

function prevMonthYYYYMM(d = new Date()) {
  const dt = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

async function resolveTable(client, candidates) {
  for (const cand of candidates) {
    const q = await client.query(`SELECT to_regclass($1) AS oid`, [cand]);
    const oid = q.rows?.[0]?.oid;
    if (oid) {
      const meta = await client.query(
        `SELECT n.nspname AS schema, c.relname AS name
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.oid = $1::regclass::oid`,
        [cand]
      );
      const r = meta.rows?.[0];
      if (r) return { schema: r.schema, name: r.name, fq: `${r.schema}."${r.name}"` };
    }
  }
  return null;
}

async function getColumns(client, schema, table) {
  const q = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
    [schema, table]
  );
  const cols = q.rows.map((r) => r.column_name);
  const map = new Map(cols.map((c) => [c.toLowerCase(), c]));
  const pick = (...names) => {
    for (const n of names) {
      const hit = map.get(String(n).toLowerCase());
      if (hit) return hit;
    }
    return null;
  };
  return { cols, pick };
}

/** Resolve HR company primarily from EmployeeTable, then cookie/header/query, else "ASF". */
async function resolveCompany(req, client) {
  const cookies = req.cookies || {};
  const hrEmpId = cookies.hr_employeeid || req.headers["x-employee-id"] || req.headers["x-user-id"] || null;
  const hrEmail = cookies.hr_email || req.headers["x-user-email"] || null;

  const emp = await resolveTable(client, EMPLOYEE_TABLE_CANDIDATES);
  if (emp) {
    const { pick } = await getColumns(client, emp.schema, emp.name);
    const empIdCol = pick("employeeid", "employee_id", "emp_id", "empid", "user_id", "userid");
    const emailCol = pick("email", "mail");
    const companyCol = pick("company", "company_name", "org", "business_unit", "dept", "department");
    if (companyCol) {
      if (empIdCol && hrEmpId) {
        const q = await client.query(
          `SELECT "${companyCol}" AS company FROM ${emp.fq} WHERE "${empIdCol}" = $1 LIMIT 1`,
          [String(hrEmpId)]
        );
        const c = q.rows?.[0]?.company;
        if (c) return String(c);
      }
      if (emailCol && hrEmail) {
        const q = await client.query(
          `SELECT "${companyCol}" AS company FROM ${emp.fq} WHERE LOWER("${emailCol}") = LOWER($1) LIMIT 1`,
          [String(hrEmail)]
        );
        const c = q.rows?.[0]?.company;
        if (c) return String(c);
      }
    }
  }

  const cookieCompany = (cookies.hr_company || "").trim();
  if (cookieCompany) return cookieCompany;
  const headerCompany = (req.headers["x-company"] || "").toString().trim();
  if (headerCompany) return headerCompany;
  const qpCompany = (req.query.company || "").toString().trim();
  if (qpCompany) return qpCompany;

  return "ASF";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const month = (req.query.month || prevMonthYYYYMM()).toString();
  const client = await pool.connect();

  try {
    const company = await resolveCompany(req, client);

    // Attendance table + cols
    const att = await resolveTable(client, ATTENDANCE_TABLE_CANDIDATES);
    if (!att) {
      return res.status(404).json({
        error: "Attendance table not found (try AttendanceDaily / attendance_daily).",
        tried: ATTENDANCE_TABLE_CANDIDATES,
      });
    }
    const { pick: pickAtt } = await getColumns(client, att.schema, att.name);
    const attEmpCol   = pickAtt("employeeid", "employee_id", "emp_id", "empid", "user_id", "userid", "staff_id", "person_id");
    const attDateCol  = pickAtt("date", "attendance_date", "punch_date", "work_date", "dt", "day", "log_date", "checkin_date", "entry_date", "ondate");
    const attNameCol  = pickAtt("name", "employee_name", "emp_name", "full_name", "display_name");
    const attCompCol  = pickAtt("company", "company_name", "org", "business_unit", "dept", "department");
    const attWorkdur  = pickAtt("workdur", "work_minutes", "work_mins"); // minutes field if present
    const attStatus   = pickAtt("status", "att_status", "attendance_status");

    if (!attEmpCol || !attDateCol) {
      return res.status(400).json({ error: "Attendance table missing employee/date columns", table: `${att.schema}.${att.name}` });
    }

    // Employee table (only needed if attendance has no company column; used just to filter employees of that company)
    const emp = await resolveTable(client, EMPLOYEE_TABLE_CANDIDATES);
    let joinEmp = "";
    let ctes = [
      `m AS (
        SELECT date_trunc('month', to_date($1,'YYYY-MM'))::date AS start_date,
               (date_trunc('month', to_date($1,'YYYY-MM')) + interval '1 month' - interval '1 day')::date AS end_date
      )`,
      `cal AS ( SELECT (end_date - start_date + 1)::int AS days_in_month FROM m )`,
    ];

    // WHERE parts
    const whereParts = [
      `t."${attDateCol}" BETWEEN (SELECT start_date FROM m) AND (SELECT end_date FROM m)`
    ];

    if (attCompCol) {
      // Attendance itself has company: filter directly
      whereParts.push(`t."${attCompCol}" = $2`);
    } else if (emp) {
      // Attendance lacks company: filter employees by company from EmployeeTable
      const { pick: pickEmp } = await getColumns(client, emp.schema, emp.name);
      const eEmpId   = pickEmp("employeeid", "employee_id", "emp_id", "empid", "user_id", "userid");
      const eCompany = pickEmp("company", "company_name", "org", "business_unit", "dept", "department");
      if (eEmpId && eCompany) {
        ctes.push(
          `emps AS (
            SELECT DISTINCT
              e."${eEmpId}" AS employeeid,
              UPPER(regexp_replace(e."${eEmpId}"::text,'[^A-Za-z0-9]','','g')) AS emp_key,
              ltrim(regexp_replace(e."${eEmpId}"::text,'[^0-9]','','g'),'0') AS emp_digits
            FROM ${emp.fq} e
            WHERE e."${eCompany}" = $2
          )`
        );
        const tKey    = `UPPER(regexp_replace(t."${attEmpCol}"::text,'[^A-Za-z0-9]','','g'))`;
        const tDigits = `ltrim(regexp_replace(t."${attEmpCol}"::text,'[^0-9]','','g'),'0')`;
        joinEmp = `
          INNER JOIN emps e
            ON e.emp_key = ${tKey}
            OR (e.emp_digits <> '' AND e.emp_digits = ${tDigits})
        `;
      }
      // if even EmployeeTable doesn't have company, we can't filter—rare
    }

    // Aggregations:
    // - name: from attendance (your ask)
    // - present_days:
    //     * counts a day as present if workdur > 0 OR status is NULL/starts with 'P'
    //     * absent_rows = status starts with 'ABS' (so these are NOT counted as present)
    //   You can tweak the status mapping to your exact values later.
    // - work_minutes: SUM(workdur) if available; else 0
    const nameSelect  = attNameCol ? `MAX(t."${attNameCol}")` : `NULL`;
    const workMinutes = attWorkdur ? `SUM(COALESCE(t."${attWorkdur}",0))` : `0`;
    const presentCond = [
      attWorkdur ? `COALESCE(t."${attWorkdur}",0) > 0` : null,
      attStatus  ? `t."${attStatus}" IS NULL` : null,
      attStatus  ? `t."${attStatus}" ILIKE 'p%'` : null,
    ].filter(Boolean).join(" OR ") || "TRUE"; // fallback: count all rows

    const whereSQL = `WHERE ${whereParts.join(" AND ")}`;

    const sql = `
      WITH ${ctes.join(",\n")}
      SELECT
        t."${attEmpCol}" AS employeeid,
        ${nameSelect} AS name,
        ${attCompCol ? `MAX(t."${attCompCol}")` : `$2::text`} AS company,
        COUNT(DISTINCT t."${attDateCol}")::int AS days_marked,
        (SELECT days_in_month FROM cal) AS actual_working_days,
        COUNT(*) FILTER (WHERE ${presentCond})::int AS present_days,
        GREATEST((SELECT days_in_month FROM cal) - COUNT(DISTINCT t."${attDateCol}"), 0)::int AS missing_days,
        ${workMinutes}::int AS work_minutes,
        0::numeric AS leaves_taken,
        0::numeric AS late_adj_days,
        0::numeric AS leaves_cf_new,
        0::numeric AS lop_days
      FROM ${att.fq} t
      ${joinEmp}
      ${whereSQL}
      GROUP BY t."${attEmpCol}"
      ORDER BY name NULLS LAST, t."${attEmpCol}";
    `;

    const params = [month, company];
    const { rows } = await client.query(sql, params);

    // Basic completeness + totals for UI
    const totalMissing = rows.reduce((s, r) => s + Number(r.missing_days || 0), 0);
    const isComplete = rows.length > 0;

    // Normalize shape for the UI
    const data = rows.map((r) => ({
      employeeid: r.employeeid,
      name: r.name,
      company: r.company,
      doj: null,                 // not from attendance; left null
      designation: null,         // not from attendance; left null
      salary_per_month: null,    // not from attendance; left null
      actual_working_days: Number(r.actual_working_days),
      current_month_eligibility: null, // UI shows "2"
      present_days: Number(r.present_days),
      work_minutes: Number(r.work_minutes),
      leaves_taken: Number(r.leaves_taken),
      late_adj_days: Number(r.late_adj_days),
      leaves_cf_new: Number(r.leaves_cf_new),
      lop_days: Number(r.lop_days),
      missing_days: Number(r.missing_days),
    }));

    return res.status(200).json({
      month,
      company,
      source_table: `${att.schema}.${att.name}`,
      rows: data,
      is_complete: isComplete,
      total_missing_days: totalMissing,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to load summary" });
  } finally {
    client.release();
  }
}
