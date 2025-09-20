// src/pages/api/tandur/employees.js
import { query } from "@/lib/db";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const r = await query(
        `SELECT "Employeeid" AS id,
                employee_name,
                employee_number AS number,
                location
           FROM public.tanduremployees
          ORDER BY "Employeeid" ASC`
      );
      return res.status(200).json({ data: r.rows });
    }

    if (req.method === "POST") {
      // frontend sends: { employeeid?, employee_name, number?, location? }
      const { employeeid, employee_name, number, location } = req.body || {};

      const name = (employee_name || "").trim();
      if (!name) return res.status(400).json({ error: "employee_name is required" });

      const num = (number || "").trim() || null;
      const loc = (location || "").trim() || null;

      let inserted;
      if (employeeid !== undefined && employeeid !== null && String(employeeid).trim() !== "") {
        const eid = Number(employeeid);
        if (!Number.isInteger(eid) || eid <= 0) {
          return res.status(400).json({ error: "employeeid must be a positive integer" });
        }
        inserted = await query(
          `INSERT INTO public.tanduremployees ("Employeeid", employee_name, employee_number, location)
           VALUES ($1, $2, $3, $4)
           RETURNING "Employeeid" AS id, employee_name, employee_number AS number, location`,
          [eid, name, num, loc]
        );
      } else {
        inserted = await query(
          `INSERT INTO public.tanduremployees (employee_name, employee_number, location)
           VALUES ($1, $2, $3)
           RETURNING "Employeeid" AS id, employee_name, employee_number AS number, location`,
          [name, num, loc]
        );
      }

      // keep sequence aligned with max id
      await query(
        `SELECT setval(
           pg_get_serial_sequence('public.tanduremployees', 'Employeeid'),
           GREATEST(COALESCE((SELECT MAX("Employeeid") FROM public.tanduremployees), 0), 0)
         )`
      );

      return res.status(201).json({ data: inserted.rows[0] });
    }

    if (req.method === "DELETE") {
      // id can come from ?id= or body.id
      const idRaw = (req.query?.id ?? req.body?.id ?? "").toString().trim();
      const id = Number(idRaw);
      if (!id || !Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Valid id is required" });
      }

      // delete row
      const del = await query(
        `DELETE FROM public.tanduremployees WHERE "Employeeid" = $1 RETURNING "Employeeid" AS id`,
        [id]
      );
      if (del.rowCount === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // re-align sequence after delete (safe to run)
      await query(
        `SELECT setval(
           pg_get_serial_sequence('public.tanduremployees', 'Employeeid'),
           GREATEST(COALESCE((SELECT MAX("Employeeid") FROM public.tanduremployees), 0), 0)
         )`
      );

      return res.status(200).json({ ok: true, id });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("tandur/employees error:", e);
    return res.status(500).json({ error: e?.detail || e?.message || "Internal server error" });
  }
}
