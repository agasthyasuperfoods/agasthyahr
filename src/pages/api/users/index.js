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
  if (req.method === "GET") {
    try {
      const existingDbCols = await getExistingDbColumns();
      const cols = selectList(existingDbCols);
      if (cols.length === 0) {
        return res.status(500).json({ error: "No known columns found in EmployeeTable" });
      }

      if (String(req.query?.count || "") === "1") {
        const where = [];
        const params = [];
        if (req.query?.role && existingDbCols.has(COLMAP.role)) {
          params.push(String(req.query.role).trim());
          where.push(`"${COLMAP.role}" = $${params.length}`);
        }
        const qCount = `
          SELECT COUNT(*)::bigint AS cnt
          FROM public."EmployeeTable"
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        `;
        const { rows } = await pool.query(qCount, params);
        return res.status(200).json({ count: Number(rows[0]?.cnt || 0) });
      }

      if (String(req.query?.suggest || "") === "1") {
        const qStr = String(req.query?.q || "").trim();
        const limit = asInt(req.query?.limit, 8);
        if (!qStr) return res.status(200).json({ data: [] });

        const fieldsToReturn = [];
        for (const key of ["employeeid", "name", "email", "company", "role"]) {
          const db = COLMAP[key];
          if (existingDbCols.has(db)) fieldsToReturn.push(`"${db}" AS "${key}"`);
        }
        if (fieldsToReturn.length === 0) fieldsToReturn.push(...cols);

        const like = `%${qStr.toLowerCase()}%`;
        const params = [];
        const ors = [];

        if (existingDbCols.has(COLMAP.employeeid)) { params.push(like); ors.push(`LOWER("${COLMAP.employeeid}") LIKE $${params.length}`); }
        if (existingDbCols.has(COLMAP.name))       { params.push(like); ors.push(`LOWER("${COLMAP.name}") LIKE $${params.length}`); }
        if (existingDbCols.has(COLMAP.email))      { params.push(like); ors.push(`LOWER("${COLMAP.email}") LIKE $${params.length}`); }

        if (!ors.length) return res.status(200).json({ data: [] });

        const prefix = `${qStr.toLowerCase()}%`;
        const orderParts = [];
        if (existingDbCols.has(COLMAP.name))       { params.push(prefix); orderParts.push(`(LOWER("${COLMAP.name}") LIKE $${params.length}) DESC`); }
        if (existingDbCols.has(COLMAP.employeeid)) { params.push(prefix); orderParts.push(`(LOWER("${COLMAP.employeeid}") LIKE $${params.length}) DESC`); }
        if (existingDbCols.has(COLMAP.email))      { params.push(prefix); orderParts.push(`(LOWER("${COLMAP.email}") LIKE $${params.length}) DESC`); }
        orderParts.push(`"${existingDbCols.has(COLMAP.employeeid) ? COLMAP.employeeid : (existingDbCols.has(COLMAP.name) ? COLMAP.name : (existingDbCols.has(COLMAP.email) ? COLMAP.email : "1"))}" ASC`);

        params.push(limit);
        const qSuggest = `
          SELECT ${fieldsToReturn.join(", ")}
          FROM public."EmployeeTable"
          WHERE (${ors.join(" OR ")})
          ORDER BY ${orderParts.join(", ")}
          LIMIT $${params.length}
        `;
        const { rows } = await pool.query(qSuggest, params);
        return res.status(200).json({ data: rows });
      }

      const roleFilter = req.query?.role;
      const idFilter = req.query?.id;
      const emailFilter = req.query?.email;
      const nameFilter = req.query?.name;

      const limit = asInt(req.query?.limit, 100);
      const offset = asInt(req.query?.offset, 0);

      const where = [];
      const params = [];

      if (idFilter && existingDbCols.has(COLMAP.employeeid)) {
        params.push(String(idFilter).trim());
        where.push(`"${COLMAP.employeeid}" = $${params.length}`);
      }
      if (emailFilter && existingDbCols.has(COLMAP.email)) {
        params.push(String(emailFilter).trim());
        where.push(`"${COLMAP.email}" = $${params.length}`);
      }
      if (nameFilter && existingDbCols.has(COLMAP.name)) {
        params.push(String(nameFilter).trim());
        where.push(`"${COLMAP.name}" = $${params.length}`);
      }
      if (roleFilter && existingDbCols.has(COLMAP.role)) {
        params.push(String(roleFilter).trim());
        where.push(`"${COLMAP.role}" = $${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const q = `
        SELECT ${cols.join(", ")}
        FROM public."EmployeeTable"
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY "${existingDbCols.has(COLMAP.employeeid) ? COLMAP.employeeid : COLMAP.name}" ASC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `;
      const result = await pool.query(q, params);
      return res.status(200).json({ data: result.rows, limit, offset });
    } catch (e) {
      console.error("GET /api/users failed:", e);
      return res.status(500).json({ error: "Failed to load users" });
    }
  }

  if (req.method === "POST") {
    try {
      const existingDbCols = await getExistingDbColumns();
      const body = req.body || {};

      // NORMALIZE keys accepted from client
      const grosssalary = body.grosssalary ?? body.grossSalary ?? null;
      const phone = body.phone ?? body.number ?? null;

      const {
        employeeid,
        name,
        email,
        role,
        doj,
        company,
        adhaarnumber,
        pancard,
        address,
        password,
      } = body;

      if (!employeeid || String(employeeid).trim() === "") {
        return res.status(400).json({ error: "Invalid or missing employee id" });
      }
      if (!name || !email || !company) {
        return res.status(400).json({ error: "Missing required fields (name/email/company)" });
      }
      if (existingDbCols.has(COLMAP.role) && !role) {
        return res.status(400).json({ error: "Missing role" });
      }
      if (existingDbCols.has(COLMAP.grosssalary)) {
        if (grosssalary === undefined || grosssalary === null || String(grosssalary).trim() === "") {
          return res.status(400).json({ error: "Missing grosssalary" });
        }
      }
      if (existingDbCols.has("password") && (role === "HR" || role === "FINANCE")) {
        if (!password || String(password).trim() === "") {
          return res.status(400).json({ error: "Password is required for HR/FINANCE user" });
        }
      }

      let aadhaarDigits = null;
      if (existingDbCols.has(COLMAP.adhaarnumber)) {
        aadhaarDigits = String(adhaarnumber || "").replace(/\D/g, "");
        if (aadhaarDigits.length !== 12) return res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
      }

      let panNorm = null;
      if (existingDbCols.has(COLMAP.pancard)) {
        panNorm = String(pancard || "").toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) {
          return res.status(400).json({ error: "PAN format is invalid (e.g., ABCDE1234F)" });
        }
      }

      let addressVal = null;
      if (existingDbCols.has(COLMAP.address)) {
        addressVal = String(address || "").trim();
      }

      const digitsOnlyPhone = phone ? String(phone).replace(/\D/g, "") : null;

      const fields = [];
      const placeholders = [];
      const values = [];
      let idx = 1;

      for (const [api, val] of [
        ["employeeid", String(employeeid).trim()],
        ["name", name],
        ["email", email],
        ["doj", doj || null],
        ["number", digitsOnlyPhone],
        ["company", company],
      ]) {
        const db = COLMAP[api];
        if (existingDbCols.has(db)) {
          fields.push(`"${db}"`);
          if (api === "doj") { placeholders.push(`$${idx++}::date`); values.push(val); }
          else { placeholders.push(`$${idx++}`); values.push(val); }
        }
      }

      if (existingDbCols.has(COLMAP.role))        { fields.push(`"${COLMAP.role}"`);        placeholders.push(`$${idx++}`);          values.push(role); }
      if (existingDbCols.has(COLMAP.grosssalary)) { fields.push(`"${COLMAP.grosssalary}"`); placeholders.push(`$${idx++}::numeric`); values.push(String(grosssalary).trim()); }
      if (existingDbCols.has(COLMAP.adhaarnumber)){ fields.push(`"${COLMAP.adhaarnumber}"`); placeholders.push(`$${idx++}`);          values.push(aadhaarDigits); }
      if (existingDbCols.has(COLMAP.pancard))     { fields.push(`"${COLMAP.pancard}"`);     placeholders.push(`$${idx++}`);          values.push(panNorm); }
      if (existingDbCols.has(COLMAP.address))     { fields.push(`"${COLMAP.address}"`);     placeholders.push(`$${idx++}`);          values.push(addressVal); }
      if (existingDbCols.has("password") && password) {
        fields.push(`"password"`); placeholders.push(`$${idx++}`); values.push(String(password));
      }

      if (fields.length === 0) return res.status(500).json({ error: "No known columns found in EmployeeTable" });

      const returning = selectList(existingDbCols).join(", ");
      const q = `
        INSERT INTO public."EmployeeTable"
          (${fields.join(", ")})
        OVERRIDING SYSTEM VALUE
        VALUES
          (${placeholders.join(", ")})
        RETURNING ${returning}
      `;
      const result = await pool.query(q, values);
      return res.status(201).json({ data: result.rows[0] });
    } catch (e) {
      console.error("POST /api/users failed:", e);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }

  if (req.method === "PUT") {
    try {
      const existingDbCols = await getExistingDbColumns();
      const body = req.body || {};

      // NORMALIZE keys accepted from client
      const grosssalary = body.grosssalary ?? body.grossSalary ?? null;
      const phone = body.phone ?? body.number ?? null;

      const idFromQuery = req.query?.id;
      const idFromBody = body?.employeeid;
      const employeeId = String((idFromQuery ?? idFromBody) || "").trim();
      if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });

      const {
        name,
        email,
        role,
        doj,
        company,
        adhaarnumber,
        pancard,
        address,
      } = body;

      const fields = [];
      const values = [];
      let idx = 1;

      if (name !== undefined && existingDbCols.has(COLMAP.name))        { fields.push(`"${COLMAP.name}" = $${idx++}`); values.push(name); }
      if (email !== undefined && existingDbCols.has(COLMAP.email))      { fields.push(`"${COLMAP.email}" = $${idx++}`); values.push(email); }
      if (role !== undefined && existingDbCols.has(COLMAP.role))        { fields.push(`"${COLMAP.role}" = $${idx++}`); values.push(role); }
      if (doj !== undefined && existingDbCols.has(COLMAP.doj))          { fields.push(`"${COLMAP.doj}" = $${idx++}::date`); values.push(doj || null); }
      if (phone !== undefined && existingDbCols.has(COLMAP.number))     { const digits = phone ? String(phone).replace(/\D/g, "") : null; fields.push(`"${COLMAP.number}" = $${idx++}`); values.push(digits); }
      if (company !== undefined && existingDbCols.has(COLMAP.company))  { fields.push(`"${COLMAP.company}" = $${idx++}`); values.push(company); }
      if (grosssalary !== undefined && grosssalary !== null && String(grosssalary).trim() !== "" && existingDbCols.has(COLMAP.grosssalary)) {
        fields.push(`"${COLMAP.grosssalary}" = $${idx++}::numeric`); values.push(String(grosssalary).trim());
      }
      if (adhaarnumber !== undefined && existingDbCols.has(COLMAP.adhaarnumber)) {
        const aadhaarDigits = String(adhaarnumber || "").replace(/\D/g, "");
        if (aadhaarDigits && aadhaarDigits.length !== 12) return res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
        fields.push(`"${COLMAP.adhaarnumber}" = $${idx++}`); values.push(aadhaarDigits || null);
      }
      if (pancard !== undefined && existingDbCols.has(COLMAP.pancard)) {
        const panNorm = String(pancard || "").toUpperCase();
        if (panNorm && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return res.status(400).json({ error: "PAN format is invalid (e.g., ABCDE1234F)" });
        fields.push(`"${COLMAP.pancard}" = $${idx++}`); values.push(panNorm || null);
      }
      if (address !== undefined && existingDbCols.has(COLMAP.address))  { fields.push(`"${COLMAP.address}" = $${idx++}`); values.push(String(address || "").trim() || null); }

      if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

      const returning = selectList(existingDbCols).join(", ");
      const q = `
        UPDATE public."EmployeeTable"
        SET ${fields.join(", ")}
        WHERE "${COLMAP.employeeid}" = $${idx}
        RETURNING ${returning}
      `;
      values.push(employeeId);

      const result = await pool.query(q, values);
      if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({ data: result.rows[0] });
    } catch (e) {
      console.error("PUT /api/users failed:", e);
      return res.status(500).json({ error: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const idFromQuery = req.query?.id;
      const idFromBody = req.body?.id ?? req.body?.employeeid;
      const employeeId = String((idFromQuery ?? idFromBody) || "").trim();
      if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });

      const result = await pool.query(
        `DELETE FROM public."EmployeeTable" WHERE "${COLMAP.employeeid}" = $1`,
        [employeeId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/users failed:", e);
      return res.status(500).json({ error: "Failed to delete user" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
