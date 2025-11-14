// pages/api/talakondapally/employees.js
import pool from "@/lib/db";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      console.log("[POST] /api/talakondapally/employees body:", req.body);

      const rawEmployeeId = req.body.employee_id;
      const rawName = req.body.employee_name;
      const rawDesignation = req.body.designation ?? null;

      if (!rawEmployeeId || !rawName || typeof rawEmployeeId !== "string" || typeof rawName !== "string") {
        return res.status(400).json({ error: "employee_id and employee_name required" });
      }

      const employee_number = rawEmployeeId.trim();
      const employee_name = rawName.trim();
      // normalize designation: trim and convert empty string -> null
      const designation = (typeof rawDesignation === "string" && rawDesignation.trim().length > 0)
        ? rawDesignation.trim()
        : null;

      const q = `
        INSERT INTO public.talakondapallyemployees (employee_number, employee_name, designation)
        VALUES ($1, $2, NULLIF(TRIM($3), ''))
        RETURNING "Employeeid", employee_number, employee_name, designation
      `;
      const values = [employee_number, employee_name, designation];

      const { rows } = await pool.query(q, values);

      console.log("[DB] inserted employee:", rows[0]);

      return res.status(200).json({ success: true, employee: rows[0] });
    } catch (e) {
      console.error("[ERR] POST /api/talakondapally/employees:", e);
      return res.status(500).json({ error: "Failed to add employee", details: e.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id required" });
      // allow deleting by employee_number or Employeeid
      const q = `DELETE FROM public.talakondapallyemployees WHERE employee_number = $1 OR "Employeeid"::text = $1 RETURNING "Employeeid"`;
      const { rows } = await pool.query(q, [id]);
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("[ERR] DELETE /api/talakondapally/employees:", e);
      return res.status(500).json({ error: "Delete failed", details: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
