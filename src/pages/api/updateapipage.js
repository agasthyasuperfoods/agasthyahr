// src/pages/api/updateapipage.js
// Single endpoint to READ (search/suggest/list/count/single) + UPDATE EmployeeTable
// Table:
// public."EmployeeTable" (quoted identifiers for "Leaves_cf" and "Location")
//
// Env: process.env.DATABASE_URL (Postgres / Supabase connection string)

import { Pool } from "pg";

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const ssl =
    process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false;

  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: 10,
  });
  return _pool;
}

function normLimit(v, def = 25, max = 200) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

async function handleGET(req, res, pool) {
  const {
    id,
    email,
    name,
    suggest,
    q,
    count,
    limit,
    offset,
  } = req.query;

  // COUNT (fast path)
  if (count === "1") {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM public."EmployeeTable"`);
    return res.status(200).json({ ok: true, count: rows?.[0]?.count ?? 0 });
  }

  // SUGGEST (minimal, fast)
  if (suggest === "1") {
    const needle = String(q || "").trim();
    if (!needle) return res.status(200).json({ ok: true, data: [] });

    const lim = normLimit(limit, 8, 20);
    const pattern = `%${needle}%`;

    const { rows } = await pool.query(
      `
        SELECT employeeid, name, email, role, company
        FROM public."EmployeeTable"
        WHERE employeeid ILIKE $1
           OR name ILIKE $1
           OR email ILIKE $1
        ORDER BY employeeid ASC
        LIMIT $2
      `,
      [pattern, lim]
    );
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  // SINGLE BY ID (exact)
  if (id) {
    const idTrim = String(id).trim();
    const { rows } = await pool.query(
      `SELECT * FROM public."EmployeeTable" WHERE employeeid = $1`,
      [idTrim]
    );
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  // SINGLE BY EMAIL (exact)
  if (email) {
    const emailTrim = String(email).trim();
    const { rows } = await pool.query(
      `SELECT * FROM public."EmployeeTable" WHERE email = $1`,
      [emailTrim]
    );
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  // SEARCH BY NAME (fuzzy)
  if (name) {
    const needle = `%${String(name).trim()}%`;
    const lim = normLimit(limit, 50, 200);
    const off = Math.max(Number(offset || 0), 0);

    const { rows } = await pool.query(
      `
        SELECT * FROM public."EmployeeTable"
        WHERE name ILIKE $1
        ORDER BY name ASC, employeeid ASC
        LIMIT $2 OFFSET $3
      `,
      [needle, lim, off]
    );
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  // DEFAULT: list (paged)
  {
    const lim = normLimit(limit, 50, 200);
    const off = Math.max(Number(offset || 0), 0);
    const { rows } = await pool.query(
      `
        SELECT * FROM public."EmployeeTable"
        ORDER BY employeeid ASC
        LIMIT $1 OFFSET $2
      `,
      [lim, off]
    );
    return res.status(200).json({ ok: true, data: rows || [], total: rows?.length || 0 });
  }
}

function coerceNullOrText(v) {
  if (v === undefined) return undefined; // not provided
  if (v === null) return null; // explicit null (clear column)
  const s = String(v);
  return s.length ? s : null; // empty string -> null
}

async function handlePUT(req, res, pool) {
  // Dynamic UPDATE builder
  const {
    employeeid,            // required (WHERE)
    name,
    email,                 // optional in UI
    role,
    doj,
    number,                // phone
    company,
    grosssalary,
    adhaarnumber,
    pancard,               // optional in UI
    address,
    designation,
    reporting_to_id,
    location,              // if you choose to pass it
    // Leaves_cf is read-only in UI; ignore any updates to it
    Leaves_cf,             // eslint-disable-line no-unused-vars
    leaves_cf,             // eslint-disable-line no-unused-vars
  } = req.body || {};

  const id = String(employeeid || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "employeeid is required" });

  // Map json->db columns (quoted for case-sensitive cols)
  const inputMap = {
    name: coerceNullOrText(name),
    email: coerceNullOrText(email),
    role: coerceNullOrText(role),
    doj: coerceNullOrText(doj),
    number: coerceNullOrText(number),
    company: coerceNullOrText(company),
    grosssalary: coerceNullOrText(grosssalary),
    adhaarnumber: adhaarnumber === undefined ? undefined : (adhaarnumber === null ? null : String(adhaarnumber)),
    pancard: coerceNullOrText(pancard),
    address: coerceNullOrText(address),
    designation: coerceNullOrText(designation),
    reporting_to_id: coerceNullOrText(reporting_to_id),
    '"Location"': location === undefined ? undefined : (location === null ? null : String(location)),
    // NOTE: '"Leaves_cf"' intentionally not updated from this API per UI requirement
  };

  const sets = [];
  const values = [];
  let idx = 1;

  for (const [col, val] of Object.entries(inputMap)) {
    if (val === undefined) continue; // not provided
    sets.push(`${col} = $${idx++}`);
    values.push(val);
  }

  if (sets.length === 0) {
    // Nothing to update -> just return the row
    const { rows } = await pool.query(`SELECT * FROM public."EmployeeTable" WHERE employeeid = $1`, [id]);
    if (!rows?.length) return res.status(404).json({ ok: false, error: "Employee not found" });
    return res.status(200).json({ ok: true, data: rows[0] });
  }

  values.push(id);

  const sql = `
    UPDATE public."EmployeeTable"
       SET ${sets.join(", ")}
     WHERE employeeid = $${idx}
   RETURNING *;
  `;

  const { rows } = await pool.query(sql, values);
  if (!rows?.length) return res.status(404).json({ ok: false, error: "Employee not found" });
  return res.status(200).json({ ok: true, data: rows[0] });
}

export default async function handler(req, res) {
  try {
    const pool = getPool();

    if (req.method === "GET") {
      return await handleGET(req, res, pool);
    }

    if (req.method === "PUT") {
      return await handlePUT(req, res, pool);
    }

    // (Optional) allow POST to create, if you need it later.
    // For now, block others:
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (e) {
    console.error("updateapipage error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
