// src/pages/api/attendance/anm/row.js
import pool from "@/lib/db";

/**
 * We only allow whitelisted tables, and we always qualify with schema.
 * NOTE the exact table names:
 *   - public.tandur_attendance            (Review column is "Review")
 *   - public.talakondapally_attendance    (review column is review)
 *
 * Columns used here: "EmployeeId", name, status, "date"
 */
const TABLES = {
  tandur: `public.tandur_attendance`,
  talakondapally: `public.talakondapally_attendance`,
};

function isYyyyMmDd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

export default async function handler(req, res) {
  const site = String(req.query.site || "").toLowerCase();
  const table = TABLES[site];

  if (!table) {
    return res.status(400).json({ error: "Invalid site", sites: Object.keys(TABLES) });
  }

  try {
    if (req.method === "PUT") {
      // Accept either si or employeeId. Require date (because PK is (EmployeeId, date))
      const { si, employeeId, name, status, date } = req.body || {};
      const empId = Number(si ?? employeeId);

      if (!Number.isFinite(empId) || empId <= 0) {
        return res.status(400).json({ error: "Valid si/employeeId is required" });
      }
      if (!isYyyyMmDd(date)) {
        return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
      }

      const { rows } = await pool.query(
        `
        UPDATE ${table}
        SET
          name   = COALESCE($2, name),
          status = COALESCE($3, status)
        WHERE "EmployeeId" = $1
          AND "date"::date  = $4::date
        RETURNING "EmployeeId"
        `,
        [empId, name ?? null, status ?? null, date]
      );

      return res.status(200).json({ updated: rows.length });
    }

    if (req.method === "DELETE") {
      // Delete needs both si/employeeId and date (because PK is (EmployeeId, date))
      const si = Number(req.query.si ?? req.body?.si);
const date = String((req.query.date ?? req.body?.date) || "");

      if (!Number.isFinite(si) || si <= 0) {
        return res.status(400).json({ error: "Valid si is required" });
      }
      if (!isYyyyMmDd(date)) {
        return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
      }

      const r = await pool.query(
        `
        DELETE FROM ${table}
        WHERE "EmployeeId" = $1
          AND "date"::date  = $2::date
        `,
        [si, date]
      );
      return res.status(200).json({ deleted: r.rowCount || 0 });
    }

    res.setHeader("Allow", "PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("ANM row mutation error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
