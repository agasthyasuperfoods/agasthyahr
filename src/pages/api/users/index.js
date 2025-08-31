// /src/pages/api/users.js
import pool from "@/lib/db";

const COLMAP = {
  employeeid: "employeeid",
  name: "name",
  email: "email",
  doj: "doj",
  number: "number",
  company: "company",
  role: "role",
  grosssalary: "grosssalary",
  adhaarnumber: "adhaarnumber",
  pancard: "pancard",
  address: "address",
  designation: "designation",
  reporting_to_id: "reporting_to_id",
};

function selectList(existingDbCols) {
  const cols = [];
  for (const apiName of Object.keys(COLMAP)) {
    const dbName = COLMAP[apiName];
    if (existingDbCols.has(dbName)) cols.push(`"${dbName}" AS "${apiName}"`);
  }
  return cols;
}

async function getExistingDbColumns() {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'EmployeeTable'
  `);
  return new Set(rows.map((r) => String(r.column_name).toLowerCase()));
}

function asInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

export default async function handler(req, res) {
  /* ------------------------------ GET ------------------------------ */
  if (req.method === "GET") {
    try {
      const existingDbCols = await getExistingDbColumns();
      const cols = selectList(existingDbCols);
      if (cols.length === 0) {
        return res.status(500).json({ error: "No known columns found in EmployeeTable" });
      }

      // Count
      if (String(req.query?.count || "") === "1") {
        const { rows } = await pool.query(`SELECT COUNT(*)::bigint AS cnt FROM public."EmployeeTable"`);
        return res.status(200).json({ count: Number(rows[0]?.cnt || 0) });
      }

      // Suggestions
      if (String(req.query?.suggest || "") === "1") {
        const qStr = String(req.query?.q || "").trim();
        const limit = asInt(req.query?.limit, 8);
        if (!qStr) return res.status(200).json({ data: [] });

        const like = `%${qStr.toLowerCase()}%`;
        const ors = [];
        const params = [];

        if (existingDbCols.has(COLMAP.employeeid)) { params.push(like); ors.push(`LOWER("${COLMAP.employeeid}") LIKE $${params.length}`); }
        if (existingDbCols.has(COLMAP.name))       { params.push(like); ors.push(`LOWER("${COLMAP.name}") LIKE $${params.length}`); }
        if (existingDbCols.has(COLMAP.email))      { params.push(like); ors.push(`LOWER("${COLMAP.email}") LIKE $${params.length}`); }

        if (!ors.length) return res.status(200).json({ data: [] });

        params.push(limit);
        const { rows } = await pool.query(
          `SELECT ${cols.join(", ")} FROM public."EmployeeTable"
           WHERE (${ors.join(" OR ")})
           ORDER BY "employeeid" ASC
           LIMIT $${params.length}`, params
        );
        return res.status(200).json({ data: rows });
      }

      // Filters
      const where = [];
      const params = [];

      if (req.query?.id) {
        params.push(String(req.query.id).trim());
        where.push(`"${COLMAP.employeeid}" = $${params.length}`);
      }
      if (req.query?.email) {
        params.push(String(req.query.email).trim());
        where.push(`LOWER("${COLMAP.email}") = LOWER($${params.length})`);
      }
      if (req.query?.name) {
        params.push(`%${String(req.query.name).trim()}%`);
        where.push(`"${COLMAP.name}" ILIKE $${params.length}`);
      }

      params.push(asInt(req.query?.limit, 100));
      params.push(asInt(req.query?.offset, 0));

      const { rows } = await pool.query(
        `SELECT ${cols.join(", ")} FROM public."EmployeeTable"
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY "employeeid" ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return res.status(200).json({ data: rows });
    } catch (e) {
      console.error("GET /api/users failed:", e);
      return res.status(500).json({ error: "Failed to load users" });
    }
  }

  /* ----------------------------- POST ----------------------------- */
  if (req.method === "POST") {
    try {
      const existingDbCols = await getExistingDbColumns();
      const body = req.body || {};

      const {
        employeeid, name, email, role, doj, company,
        adhaarnumber, pancard, address, password,
        designation, reporting_to_id, grosssalary, number
      } = body;

      if (!employeeid || !name || !email || !company) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const fields = [];
      const placeholders = [];
      const values = [];
      let idx = 1;

      for (const [api, val] of [
        ["employeeid", String(employeeid).trim()],
        ["name", name],
        ["email", email],
        ["doj", doj || null],
        ["number", number || null],
        ["company", company],
        ["role", role],
        ["grosssalary", grosssalary],
        ["adhaarnumber", adhaarnumber],
        ["pancard", pancard],
        ["address", address],
        ["designation", designation],
        ["reporting_to_id", reporting_to_id],
        ["password", password]
      ]) {
        const db = COLMAP[api] || api;
        if (val !== undefined && existingDbCols.has(db)) {
          fields.push(`"${db}"`);
          placeholders.push(`$${idx++}`);
          values.push(val);
        }
      }

      const returning = selectList(existingDbCols).join(", ");
      const q = `
        INSERT INTO public."EmployeeTable" (${fields.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING ${returning}
      `;
      const result = await pool.query(q, values);
      return res.status(201).json({ data: result.rows[0] });
    } catch (e) {
      console.error("POST /api/users failed:", e);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }

  /* ------------------------------ PUT ------------------------------ */
  if (req.method === "PUT") {
    try {
      const existingDbCols = await getExistingDbColumns();
      const body = req.body || {};
      const employeeId = String(req.query?.id || body?.employeeid || "").trim();
      if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });

      const fields = [];
      const values = [];
      let idx = 1;

      for (const [api, val] of Object.entries(body)) {
        const db = COLMAP[api];
        if (db && existingDbCols.has(db)) {
          fields.push(`"${db}" = $${idx++}`);
          values.push(val);
        }
      }

      if (!fields.length) return res.status(400).json({ error: "No fields to update" });

      values.push(employeeId);
      const returning = selectList(existingDbCols).join(", ");
      const q = `
        UPDATE public."EmployeeTable"
        SET ${fields.join(", ")}
        WHERE "employeeid" = $${idx}
        RETURNING ${returning}
      `;
      const result = await pool.query(q, values);
      if (!result.rowCount) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({ data: result.rows[0] });
    } catch (e) {
      console.error("PUT /api/users failed:", e);
      return res.status(500).json({ error: "Failed to update user" });
    }
  }

  /* ---------------------------- DELETE ---------------------------- */
  if (req.method === "DELETE") {
    try {
      const employeeId = String(req.query?.id || req.body?.id || req.body?.employeeid || "").trim();
      if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });

      const result = await pool.query(
        `DELETE FROM public."EmployeeTable" WHERE "employeeid" = $1`,
        [employeeId]
      );
      if (!result.rowCount) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/users failed:", e);
      return res.status(500).json({ error: "Failed to delete user" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
