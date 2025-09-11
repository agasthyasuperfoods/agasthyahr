// src/pages/api/users/index.js
import { Pool } from "pg";

// Neon typically needs SSL. Set PGSSL=true in env for managed Postgres like Neon.
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

// Normalize output keys. Quote the mixed-case DB columns and alias to snake_case.
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
  "Leaves_cf"  AS leaves_cf,
  probation,
  "Location"   AS location
`;

// Updatable fields map to their DB columns (quoted where needed).
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
};

function likeStarts(s) {
  const v = String(s || "").replace(/[%_]/g, "\\$&");
  return `${v}%`;
}
function likeContains(s) {
  const v = String(s || "").replace(/[%_]/g, "\\$&");
  return `%${v}%`;
}
function normId(raw) {
  return String(raw || "").trim().replace(/\s+/g, "").toUpperCase();
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
      // ---- 1) COUNT ----
      if (req.query.count === "1") {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM public."EmployeeTable"`);
        return res.status(200).json({ count: rows?.[0]?.count ?? 0 });
      }

      // ---- 2) SUGGEST (typeahead) ----
      if (req.query.suggest === "1") {
        const q = (req.query.q || "").toString().trim();
        const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "8", 10)));
        if (!q) return res.status(200).json({ data: [] });

        const sql = `
          SELECT employeeid, name, email, role, company
          FROM public."EmployeeTable"
          WHERE
            employeeid ILIKE $1 ESCAPE '\\'
            OR name   ILIKE $2 ESCAPE '\\'
            OR email  ILIKE $2 ESCAPE '\\'
            OR number ILIKE $2 ESCAPE '\\'
          ORDER BY name ASC NULLS LAST
          LIMIT $3
        `;
        const { rows } = await pool.query(sql, [likeStarts(q), likeContains(q), limit]);
        return res.status(200).json({ data: rows || [] });
      }

      // ---- 3) SEARCH BY ID ----
      if (req.query.id) {
        const raw = req.query.id;
        const base = normId(raw);
        const digits = digitsOnly(base);
        const noZeros = stripLeadingZeros(digits);

        const sql = `
          SELECT ${SELECT_COLUMNS}
          FROM public."EmployeeTable"
          WHERE
            employeeid ILIKE $1 ESCAPE '\\'
            OR regexp_replace(employeeid, '[^0-9]', '', 'g') = $2
            OR regexp_replace(regexp_replace(employeeid, '[^0-9]', '', 'g'), '^0+', '') = $3
          ORDER BY name ASC NULLS LAST
          LIMIT 50
        `;
        const params = [likeContains(base), digits || null, noZeros || null];
        const { rows } = await pool.query(sql, params);
        return res.status(200).json({ data: rows || [] });
      }

      // ---- 4) SEARCH BY EMAIL ----
      if (req.query.email) {
        const email = String(req.query.email || "").trim();
        const sql = `
          SELECT ${SELECT_COLUMNS}
          FROM public."EmployeeTable"
          WHERE email ILIKE $1 ESCAPE '\\'
          ORDER BY name ASC NULLS LAST
          LIMIT 50
        `;
        const { rows } = await pool.query(sql, [likeContains(email)]);
        return res.status(200).json({ data: rows || [] });
      }

      // ---- 5) SEARCH BY NAME ----
      if (req.query.name) {
        const name = String(req.query.name || "").trim();
        const sql = `
          SELECT ${SELECT_COLUMNS}
          FROM public."EmployeeTable"
          WHERE name ILIKE $1 ESCAPE '\\'
          ORDER BY name ASC NULLS LAST
          LIMIT 50
        `;
        const { rows } = await pool.query(sql, [likeContains(name)]);
        return res.status(200).json({ data: rows || [] });
      }

      // ---- 6) DEFAULT LIST (bounded) ----
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "25", 10)));
      const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
      const sql = `SELECT ${SELECT_COLUMNS} FROM public."EmployeeTable" ORDER BY employeeid ASC LIMIT $1 OFFSET $2`;
      const { rows } = await pool.query(sql, [limit, offset]);
      return res.status(200).json({ data: rows || [] });
    }

    if (req.method === "PUT") {
      // Update by employeeid (required)
      const id = String(req.query.id || req.body?.employeeid || "").trim();
      if (!id) return res.status(400).json({ error: "Missing employeeid (query param ?id=...)" });

      // Build dynamic SET clause from body keys in COLMAP
      const body = req.body || {};
      const entries = Object.entries(COLMAP)
        .filter(([key]) => Object.prototype.hasOwnProperty.call(body, key))
        .map(([key, col]) => [col, body[key]]);

      if (!entries.length) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      const setClauses = entries.map(([col], i) => `${col} = $${i + 1}`);
      const params = entries.map(([, val]) => (val === "" ? null : val));
      params.push(id); // WHERE param

      const sql = `
        UPDATE public."EmployeeTable"
        SET ${setClauses.join(", ")}
        WHERE employeeid = $${params.length}
        RETURNING ${SELECT_COLUMNS}
      `;

      const r = await pool.query(sql, params);
      if (!r.rows?.length) return res.status(404).json({ error: "Employee not found" });
      return res.status(200).json({ data: r.rows[0] });
    }

    if (req.method === "POST") {
      // Create. Relaxed: do NOT force email/pancard server-side (UI can enforce).
      const b = req.body || {};
      if (!b.employeeid || !b.name || !b.role || !b.company) {
        return res.status(400).json({ error: "employeeid, name, role, company are required" });
      }

      const sql = `
        INSERT INTO public."EmployeeTable" (
          employeeid, name, email, role, company, doj, number, grosssalary,
          adhaarnumber, pancard, address, designation, reporting_to_id, "Leaves_cf", probation, "Location"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
        )
        RETURNING ${SELECT_COLUMNS}
      `;
      const params = [
        b.employeeid,
        b.name,
        b.email ?? null,
        b.role,
        b.company,
        b.doj || null,
        b.number || null,
        b.grosssalary ?? null,
        b.adhaarnumber ?? null,
        b.pancard ?? null,
        b.address ?? null,
        b.designation ?? null,
        b.reporting_to_id ?? null,
        b.leaves_cf ?? null,
        b.probation ?? null,
        b.location ?? null,
      ];
      const r = await pool.query(sql, params);
      return res.status(201).json({ data: r.rows[0] });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      if (!id) return res.status(400).json({ error: "Missing employeeid (?id=...)" });
      const r = await pool.query(`DELETE FROM public."EmployeeTable" WHERE employeeid = $1`, [id]);
      return res.status(200).json({ ok: true, deleted: r.rowCount || 0 });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("API /users error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
