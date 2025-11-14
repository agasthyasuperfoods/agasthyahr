// /pages/api/ex-employees.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon
});

const EX_TABLE = `"ExEmployeeTable"`;

const toPositiveInt = (v, fb) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fb;
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const {
        q = "",
        page: pageQ,
        pageSize: pageSizeQ,
        sort = "resigneddate_desc",
      } = req.query || {};

      const page = toPositiveInt(pageQ, 1);
      const pageSize = Math.min(toPositiveInt(pageSizeQ, 20), 200);
      const offset = (page - 1) * pageSize;

      // Filters
      const where = [];
      const params = [];
      let p = 1;

      if (q && q.trim()) {
        where.push(`(
          employeeid   ILIKE $${p} OR
          name         ILIKE $${p} OR
          email        ILIKE $${p} OR
          company      ILIKE $${p} OR
          pancard      ILIKE $${p} OR
          address      ILIKE $${p}
        )`);
        params.push(`%${q.trim()}%`);
        p++;
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const asDate = `CASE WHEN resigneddate ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN resigneddate::date ELSE NULL END`;

      // Sort
      let orderBy = `ORDER BY ${asDate} DESC NULLS LAST, name ASC`;
      if (sort) {
        const [col, dirRaw] = String(sort).toLowerCase().split("_");
        const dir = dirRaw === "asc" ? "ASC" : "DESC";
        if (col === "resigneddate") orderBy = `ORDER BY ${asDate} ${dir} NULLS LAST, name ASC`;
        else if (["name", "employeeid", "company"].includes(col)) orderBy = `ORDER BY ${col} ${dir}, ${asDate} DESC NULLS LAST`;
      }

      const countSql = `SELECT COUNT(*)::int AS total FROM ${EX_TABLE} ${whereSql}`;
      const listSql = `
        SELECT
          employeeid::text,
          name,
          doj,
          number,
          role,
          email,
          company,
          resigneddate,
          grosssalary,
          adhaarnumber,
          pancard,
          address
        FROM ${EX_TABLE}
        ${whereSql}
        ${orderBy}
        LIMIT $${p} OFFSET $${p + 1}
      `;

      const client = await pool.connect();
      try {
        const [countRes, listRes] = await Promise.all([
          client.query(countSql, params),
          client.query(listSql, [...params, pageSize, offset]),
        ]);

        const total = countRes.rows?.[0]?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        res.status(200).json({
          ok: true,
          page,
          pageSize,
          total,
          totalPages,
          rows: listRes.rows || [],
        });
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("GET /api/ex-employees error:", e);
      res.status(500).json({ error: "Failed to load ex-employees" });
    }
    return;
  }

  if (req.method === "PUT") {
    try {
      const {
        employeeid, // required PK
        name,
        doj,
        number,
        role,
        email,
        company,
        resigneddate,
        grosssalary,
        adhaarnumber,
        pancard,
        address,
      } = req.body || {};

      if (!employeeid || String(employeeid).trim() === "") {
        return res.status(400).json({ error: "employeeid is required" });
      }

      // Build dynamic update list
      const sets = [];
      const params = [];
      let p = 1;

      const add = (frag, val) => { sets.push(frag.replace(/\$\?/g, `$${p}`)); params.push(val); p++; };

      if (name !== undefined)         add(`name = NULLIF($?, '')`, name);
      if (doj !== undefined)          add(`doj = NULLIF($?, '')`, doj);
      if (number !== undefined)       add(`number = NULLIF($?, '')::numeric`, number === null ? "" : String(number));
      if (role !== undefined)         add(`role = NULLIF($?, '')`, role);
      if (email !== undefined)        add(`email = NULLIF($?, '')`, email);
      if (company !== undefined)      add(`company = NULLIF($?, '')`, company);
      if (resigneddate !== undefined) add(`resigneddate = NULLIF($?, '')`, resigneddate);
      if (grosssalary !== undefined)  add(`grosssalary = NULLIF($?, '')`, grosssalary);
      if (adhaarnumber !== undefined) add(`adhaarnumber = NULLIF($?, '')::numeric`, adhaarnumber === null ? "" : String(adhaarnumber));
      if (pancard !== undefined)      add(`pancard = NULLIF($?, '')`, pancard);
      if (address !== undefined)      add(`address = NULLIF($?, '')`, address);

      if (!sets.length) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      const sql = `
        UPDATE ${EX_TABLE}
        SET ${sets.join(", ")}
        WHERE employeeid = $${p}
        RETURNING
          employeeid::text, name, doj, number, role, email, company,
          resigneddate, grosssalary, adhaarnumber, pancard, address
      `;
      params.push(String(employeeid).trim());

      const client = await pool.connect();
      try {
        const { rows } = await client.query(sql, params);
        if (!rows.length) return res.status(404).json({ error: "Employee not found" });
        return res.status(200).json({ ok: true, row: rows[0] });
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("PUT /api/ex-employees error:", e);
      return res.status(500).json({ error: "Failed to update ex-employee" });
    }
  } else {
    // <-- This was causing your 405. With PUT implemented above, you’re good.
    return res.status(405).json({ error: "Method Not Allowed" });
  }
}
