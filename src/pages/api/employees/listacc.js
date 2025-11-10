// pages/api/employees/listacc.js
import { Pool } from "pg";

let pool;
function getPool() {
  if (!global._pgpool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("FATAL: DATABASE_URL is not set in .env");
      global._pgpool = new Pool({ connectionString: null });
    } else {
      global._pgpool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
    }
  }
  return global._pgpool;
}
pool = getPool();

export default async function handler(req, res) {
  const t0 = Date.now();
  try {
    const { location = "all" } = req.query;
    const loc = String(location || "all").toLowerCase();
    const allowed = ["all", "tandur", "talakondapally", "operations"];

    if (!allowed.includes(loc)) {
      return res
        .status(400)
        .json({ success: false, message: `Invalid location. Allowed: ${allowed.join(", ")}` });
    }

    // connect
    let client;
    try {
      client = await pool.connect();
    } catch (connErr) {
      console.error("[/api/employees/listacc] DB CONNECT ERROR:", connErr && connErr.message ? connErr.message : connErr);
      return res
        .status(500)
        .json({ success: false, message: "DB_CONN_FAILED - check DATABASE_URL or DB network (see server logs)." });
    }

    try {
      // Select with explicit quoting/aliasing for mixed-case columns
      let sql = `
        SELECT
          employeeid,
          name,
          doj,
          number,
          role,
          email,
          company,
          grosssalary,
          adhaarnumber,
          pancard,
          address,
          designation,
          reporting_to_id,
          "Leaves_cf" AS leaves_cf,
          probation,
          "Location" AS location
        FROM public."EmployeeTable"
        WHERE LOWER(COALESCE(company, '')) IN ('asf', 'asf-factory')
      `;

      const params = [];
      if (loc !== "all") {
        sql += ` AND LOWER(COALESCE("Location", '')) = $1`;
        params.push(loc);
      }

      sql += ` ORDER BY name ASC LIMIT 1000`;

      const { rows } = await client.query(sql, params);

      const employees = rows.map((r) => ({
        employeeid: r.employeeid,
        name: r.name || "",
        doj: r.doj || "",
        phone: r.number || "",
        role: r.role || "",
        email: r.email || "",
        company: r.company || "",
        gross_salary: r.grosssalary ?? null,
        adhaarnumber: r.adhaarnumber ?? null,
        pancard: r.pancard || "",
        address: r.address || "",
        designation: r.designation || "",
        reporting_to_id: r.reporting_to_id || "",
        leaves_cf: r.leaves_cf ?? 0,
        probation: r.probation || "",
        location: r.location || "Unknown",
        advances: 0,
      }));

      client.release();
      const took = Date.now() - t0;
      return res.status(200).json({ success: true, employees, meta: { count: employees.length, took_ms: took } });
    } catch (qErr) {
      console.error("[/api/employees/listacc] QUERY ERROR:", qErr && qErr.stack ? qErr.stack : qErr);
      if (client) client.release();
      return res
        .status(500)
        .json({ success: false, message: "QUERY_FAILED - check column names or RLS policies (see server logs)." });
    }
  } catch (err) {
    console.error("[/api/employees/listacc] UNEXPECTED ERROR:", err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, message: "UNEXPECTED_SERVER_ERROR - see server logs." });
  }
}
