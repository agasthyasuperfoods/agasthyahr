import { Pool } from "pg";

// Neon SSL Configuration
const pool =
  global._pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.PGSSL?.toLowerCase() === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (!global._pgPool) global._pgPool = pool;

// Full selection list including new probation columns
const SELECT_COLUMNS = `
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
  "Location" AS location,
  probation_status,
  probation_extension_days,
  probation_end_date
`;

// Mapping for PUT updates
const COLMAP = {
  name: `"name"`,
  doj: `"doj"`,
  number: `"number"`,
  role: `"role"`,
  email: `"email"`,
  company: `"company"`,
  grosssalary: `"grosssalary"`,
  adhaarnumber: `"adhaarnumber"`,
  pancard: `"pancard"`,
  address: `"address"`,
  designation: `"designation"`,
  reporting_to_id: `"reporting_to_id"`,
  leaves_cf: `"Leaves_cf"`,
  probation: `"probation"`,
  location: `"Location"`,
  probation_status: `"probation_status"`,
  probation_extension_days: `"probation_extension_days"`,
  probation_end_date: `"probation_end_date"`,
};

// Helper functions for search
function likeStarts(s) {
  const v = String(s || "").replace(/[%_]/g, "\\$&");
  return `${v}%`;
}
function likeContains(s) {
  const v = String(s || "").replace(/[%_]/g, "\\$&");
  return `%${v}%`;
}
function normId(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}
function digitsOnly(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}
function stripLeadingZeros(s) {
  return String(s || "").replace(/^0+/, "") || "";
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // 1) Count logic
      if (req.query.count === "1") {
        const { rows } = await pool.query(
          `SELECT COUNT(*)::int AS count FROM public."EmployeeTable"`,
        );
        return res.status(200).json({ count: rows?.[0]?.count ?? 0 });
      }

      // 2) Search/Suggest logic
      if (req.query.id) {
        const raw = req.query.id;
        const base = normId(raw);
        const digits = digitsOnly(base);
        const noZeros = stripLeadingZeros(digits);
        const sql = `SELECT ${SELECT_COLUMNS} FROM public."EmployeeTable" WHERE employeeid ILIKE $1 OR regexp_replace(employeeid, '[^0-9]', '', 'g') = $2 LIMIT 50`;
        const { rows } = await pool.query(sql, [
          likeContains(base),
          digits || null,
        ]);
        return res.status(200).json({ data: rows || [] });
      }

      // 3) Default fetch
      const { rows } = await pool.query(
        `SELECT ${SELECT_COLUMNS} FROM public."EmployeeTable" ORDER BY name ASC`,
      );
      return res.status(200).json({ data: rows || [] });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      if (!b.employeeid || !b.name || !b.role || !b.company) {
        return res.status(400).json({ error: "Required fields missing" });
      }

      // Explicit SQL with 18 values. Parameter $18 is the initial days used only for calculation.
const sql = `
        INSERT INTO public."EmployeeTable" (
          employeeid, name, email, role, company, doj, number, grosssalary,
          adhaarnumber, pancard, address, designation, reporting_to_id, "Leaves_cf", 
          probation, "Location", probation_status, probation_extension_days, probation_end_date
        ) VALUES (
          $1::text, $2::text, $3::text, $4::text, $5::text, NULLIF($6, '')::date, $7::text, $8::text, 
          $9::numeric, $10::text, $11::text, $12::text, $13::text, $14::numeric, 
          $15::text, $16::text, $17::text, 0, -- Force extension column to 0 for new hires
          CASE 
            WHEN $17::text = 'under_probation' AND NULLIF($6, '') IS NOT NULL 
            THEN (NULLIF($6, '')::date + ($18::int || ' days')::interval)::date 
            ELSE NULL 
          END
        ) RETURNING employeeid
      `;

      const params = [
        String(b.employeeid),
        String(b.name),
        b.email ? String(b.email) : null,
        String(b.role),
        String(b.company),
        b.doj || "", // Parameter $6
        b.number ? String(b.number) : null,
        b.grosssalary ? String(b.grosssalary) : null,
        b.adhaarnumber ? String(b.adhaarnumber) : null,
        b.pancard ? String(b.pancard).toUpperCase() : null,
        b.address ? String(b.address) : null,
        b.designation ? String(b.designation) : null,
        b.reporting_to_id ? String(b.reporting_to_id) : null,
        b.leaves_cf || 0,
        b.probation || "NO",
        b.location || null,

        String(b.probation_status || "confirmed"), // $17
        parseInt(b.initial_period_days) || 0, // $18 (Math calculation only)
      ];

      const r = await pool.query(sql, params);
      return res.status(201).json({ data: r.rows[0] });
    }

    if (req.method === "PUT") {
      const id = String(req.query.id || req.body?.employeeid || "").trim();
      const body = req.body || {};
      const entries = Object.entries(COLMAP).filter(([key]) =>
        body.hasOwnProperty(key),
      );
      const setClauses = entries.map(
        ([col], i) => `${COLMAP[entries[i][0]]} = $${i + 1}`,
      );
      const params = entries.map(([, val]) => (val === "" ? null : val));
      params.push(id);
      const sql = `UPDATE public."EmployeeTable" SET ${setClauses.join(", ")} WHERE employeeid = $${params.length} RETURNING ${SELECT_COLUMNS}`;
      const r = await pool.query(sql, params);
      return res.status(200).json({ data: r.rows[0] });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      await pool.query(
        `DELETE FROM public."EmployeeTable" WHERE employeeid = $1`,
        [id],
      );
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    console.error("API Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
