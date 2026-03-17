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
    all,
    unique,
  } = req.query;

  // FETCH ALL (bypass pagination)
  if (all === '1' || all === 'true') {
    const { rows } = await pool.query(`SELECT *, grosssalary FROM public."EmployeeTable" ORDER BY employeeid ASC`);
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  if (unique) {
    const field = unique === 'roles' ? 'role' : unique === 'companies' ? 'company' : null;
    if (!field) {
      return res.status(400).json({ ok: false, error: 'Invalid unique field specified' });
    }
    const { rows } = await pool.query(`SELECT DISTINCT ${field} FROM public."EmployeeTable" WHERE ${field} IS NOT NULL ORDER BY ${field} ASC`);
    return res.status(200).json({ ok: true, data: rows.map(r => r[field]) });
  }

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
      `SELECT *, grosssalary FROM public."EmployeeTable" WHERE employeeid = $1`,
      [idTrim]
    );
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  // SINGLE BY EMAIL (exact)
  if (email) {
    const emailTrim = String(email).trim();
    const { rows } = await pool.query(
      `SELECT *, grosssalary FROM public."EmployeeTable" WHERE email = $1`,
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
        SELECT *, grosssalary FROM public."EmployeeTable"
        WHERE name ILIKE $1
        ORDER BY name ASC, employeeid ASC
        LIMIT $2 OFFSET $3
      `,
      [needle, lim, off]
    );
    return res.status(200).json({ ok: true, data: rows || [] });
  }

  // DEFAULT: list (paged and filtered)
  {
    const { page, company } = req.query;
    const lim = normLimit(limit, 15, 50);
    // Calculate offset from page number (1-based)
    const off = page ? (Math.max(Number(page) - 1, 0) * lim) : (Math.max(Number(offset || 0), 0));

    const whereClauses = [];
    const queryParams = [];

    if (company && company !== 'All') {
      queryParams.push(company);
      // Use ILIKE for case-insensitive matching
      whereClauses.push(`company ILIKE $${queryParams.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 1. Get total count with the filter applied
    const countResult = await pool.query(`SELECT COUNT(*)::int FROM public."EmployeeTable" ${whereSql}`, queryParams);
    const total = countResult.rows[0].count;

    // 2. Get the paginated data with the same filter
    const dataParams = [...queryParams, lim, off];
    const dataSql = `
      SELECT *, grosssalary FROM public."EmployeeTable"
      ${whereSql}
      ORDER BY employeeid ASC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    const { rows } = await pool.query(dataSql, dataParams);
    
    return res.status(200).json({ ok: true, data: rows || [], total });
  }
}

function coerceNullOrText(v) {
  if (v === undefined) return undefined; // not provided
  if (v === null) return null; // explicit null (clear column)
  const s = String(v);
  return s.length ? s : null; // empty string -> null
}

async function handlePUT(req, res, pool) {
  // Explicitly define the columns that are allowed to be updated.
  const allowedColumns = [
    'name', 'email', 'number', 'designation', 'role', 'company', 
    'adhaarnumber', 'pancard', 'address', 'grosssalary', 'doj',
    'reporting_to_id', '"Leaves_cf"'
  ];

  const body = req.body || {};
  const id = String(body.employeeid || req.query.id || '').trim();

  if (!id) {
    return res.status(400).json({ ok: false, error: "employeeid is required for update" });
  }

  const inputMap = {};
  for (const key in body) {
    // Skip the primary key itself from the update set
    if (key === 'employeeid') continue;
    
    // Map frontend keys to database columns
    let dbKey = key;
    if (key === 'Leaves_cf') dbKey = '"Leaves_cf"';
    

    if (allowedColumns.includes(dbKey)) {
      // Use coerce function to handle nulls and empty strings consistently
      inputMap[dbKey] = coerceNullOrText(body[key]);
    }
  }

  const sets = [];
  const values = [];
  let idx = 1;

  for (const [col, val] of Object.entries(inputMap)) {
    if (val === undefined) continue; // Skip fields not present in the body
    sets.push(`${col} = $${idx++}`);
    values.push(val);
  }

  if (sets.length === 0) {
    // If nothing to update, it could be a no-op success or an error.
    // For a PUT request, arguably it's a success. Let's return the existing record.
    const { rows } = await pool.query(`SELECT *, grosssalary FROM public."EmployeeTable" WHERE employeeid = $1`, [id]);
    if (!rows?.length) return res.status(404).json({ ok: false, error: "Employee not found" });
    return res.status(200).json({ ok: true, data: rows[0], message: "No fields to update" });
  }

  values.push(id); // Add employeeid for the WHERE clause

  const sql = `
    UPDATE public."EmployeeTable"
       SET ${sets.join(", ")}
     WHERE employeeid = $${idx}
   RETURNING *, grosssalary;
  `;

  try {
    const { rows } = await pool.query(sql, values);
    if (!rows?.length) return res.status(404).json({ ok: false, error: "Employee not found" });
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (dbError) {
    console.error('DB Error:', dbError);
    return res.status(500).json({ ok: false, error: "Database update failed." });
  }
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
    console.error("Error in /api/updateapipage:", e);
    return res.status(500).json({ ok: false, error: "An unexpected error occurred. Check server logs for details." });
  }
}
