// src/pages/api/nutromilk/login.js
import { Pool } from "pg";

let pool;
if (!global.__PG_POOL__) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  global.__PG_POOL__ = pool;
} else {
  pool = global.__PG_POOL__;
}

// We target EmployeeTable in public schema (case-insensitive lookup)
const TARGET_TABLE_NAME = "EmployeeTable"; // exact logical name provided by you

async function findTableByName(client, tableName) {
  // find matching table in public schema case-insensitively
  const q = `
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE lower(table_schema) = 'public'
      AND lower(table_name) = lower($1)
    LIMIT 1
  `;
  const r = await client.query(q, [tableName]);
  if (r.rowCount === 0) return null;
  return { schema: r.rows[0].table_schema, table: r.rows[0].table_name };
}

async function getColumns(client, schema, table) {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
  const r = await client.query(q, [schema, table]);
  return r.rows.map((row) => row.column_name);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { employeeId, passcode } = req.body || {};
  if (!employeeId || !passcode) {
    return res.status(400).json({ error: "Missing employeeId or passcode" });
  }

  const client = await pool.connect();
  try {
    const tbl = await findTableByName(client, TARGET_TABLE_NAME);
    if (!tbl) {
      return res.status(500).json({ error: `Employee table "${TARGET_TABLE_NAME}" not found in public schema.` });
    }

    const cols = await getColumns(client, tbl.schema, tbl.table);
    const lowerCols = cols.map((c) => c.toLowerCase());

    // identifier candidates (prefer common names)
    const idCandidates = [
      "employeeid", "employee_id", "employee_number", "employee_number",
      "emp_code", "empcode", "empid", "id", "employeeid"
    ];

    // passcode candidates
    const passCandidates = [
      "passcode", "pass_code", "password", "pass", "pin", "code", "emp_passcode"
    ];

    // pick first existing id col
    let pickedIdCol = null;
    for (const cand of idCandidates) {
      const idx = lowerCols.indexOf(cand);
      if (idx !== -1) {
        pickedIdCol = cols[idx]; // preserve actual column name casing
        break;
      }
    }

    // pick first existing pass col
    let pickedPassCol = null;
    for (const cand of passCandidates) {
      const idx = lowerCols.indexOf(cand);
      if (idx !== -1) {
        pickedPassCol = cols[idx];
        break;
      }
    }

    if (!pickedIdCol) {
      return res.status(500).json({ error: `No identifier column found in ${tbl.schema}.${tbl.table}. Expected columns like employeeid/employee_id/employee_number.` });
    }
    if (!pickedPassCol) {
      return res.status(500).json({ error: `No passcode column found in ${tbl.schema}.${tbl.table}. Expected columns like passcode/password/pin.` });
    }

    // safe quoted identifiers
    const safeSchema = tbl.schema.replace(/"/g, '""');
    const safeTable = tbl.table.replace(/"/g, '""');
    const safeIdCol = pickedIdCol.replace(/"/g, '""');
    const safePassCol = pickedPassCol.replace(/"/g, '""');

    const fullTable = `"${safeSchema}"."${safeTable}"`;
    const idIdentifier = `"${safeIdCol}"`;
    const passIdentifier = `"${safePassCol}"`;

    // Query - case-insensitive match on identifier
    const q = `
      SELECT *
      FROM ${fullTable}
      WHERE lower(COALESCE(${idIdentifier}::text, '')) = $1
      LIMIT 1
    `;
    const empLower = String(employeeId).trim().toLowerCase();
    const r = await client.query(q, [empLower]);

    if (!r.rows || r.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Employee ID or Passcode" });
    }

    const userRow = r.rows[0];
    const storedPass = String(userRow[pickedPassCol] ?? "");

    // plain-text comparison (if you use hashes, replace with bcrypt.compare)
    if (storedPass !== String(passcode)) {
      return res.status(401).json({ error: "Invalid Employee ID or Passcode" });
    }

    // build sanitized user object
    const safeUser = {
      id: userRow.id ?? userRow[pickedIdCol] ?? null,
      name: userRow.name ?? userRow.employee_name ?? userRow.full_name ?? null,
      employeeId: userRow[pickedIdCol] ?? null,
    };

    // success
    return res.status(200).json({
      success: true,
      user: safeUser,
      _debug: { table: `${tbl.schema}.${tbl.table}`, idCol: pickedIdCol, passCol: pickedPassCol },
    });
  } catch (err) {
    console.error("nutromilk/login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}
