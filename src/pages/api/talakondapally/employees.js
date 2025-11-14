// FILE: pages/api/talakondapally/employees.js

import { query } from "@/lib/db";

const FIXED_LOCATION = "Talakondapally";

export default async function handler(req, res) {
  try {
    // ----------------------------------------------------------------------
    // GET: Fetch all employees
    // ----------------------------------------------------------------------
    if (req.method === "GET") {
      const r = await query(
        `SELECT "Employeeid" AS id,
                employee_name,
                designation,
                employee_number AS number,
                location
           FROM public.talakondapallyemployees
          ORDER BY designation, employee_name ASC`
      );
      // Ensure IDs are returned as strings if they are not plain numbers
      const data = r.rows.map(row => ({
          ...row,
          id: row.id.toString() // Ensure 'id' is a string for consistent frontend usage
      }));
      return res.status(200).json({ data: data });
    }

    // ----------------------------------------------------------------------
    // POST: Create new employee (Auto-ID Generation Enforced)
    // ----------------------------------------------------------------------
    if (req.method === "POST") {
      // Expect ONLY employee_name and designation from the frontend.
      const { employee_name, designation } = req.body || {};

      const name = (employee_name || "").trim();
      const desig = (designation || "").trim();
      
      if (!name || !desig) {
          return res.status(400).json({ error: "employee_name and designation are required" });
      }

      // Default values for optional columns in the table structure:
      const num = null; // employee_number is TEXT, can be null
      const loc = FIXED_LOCATION; // Enforce fixed location
      
      const inserted = await query(
        `INSERT INTO public.talakondapallyemployees (employee_name, designation, employee_number, location)
         VALUES ($1, $2, $3, $4)
         RETURNING "Employeeid" AS id`, // Return the generated ID as 'id'
        [name, desig, num, loc]
      );
      
      // Sequence alignment logic (Keep if needed for your specific DB setup)
      await query(
        `SELECT setval(
           pg_get_serial_sequence('public.talakondapallyemployees', 'Employeeid'),
           GREATEST(COALESCE((SELECT MAX("Employeeid") FROM public.talakondapallyemployees), 0), 0)
         )`
      );
      
      const newEmployeeId = inserted.rows[0].id.toString(); // Return as string
      return res.status(201).json({ 
          ok: true,
          employee_id: newEmployeeId // This key name matches the frontend's expectation
      });
    }

    // ----------------------------------------------------------------------
    // 🚨 DELETE: Delete employee by id
    // ----------------------------------------------------------------------
    if (req.method === "DELETE") {
      const idRaw = (req.query?.id ?? req.body?.id ?? "").toString().trim();
      
      if (!idRaw) {
        return res.status(400).json({ error: "Employee ID is required for deletion." });
      }

      // Attempt to delete. Since 'Employeeid' is your primary key, 
      // PostgreSQL handles type coercion if it's numeric, or you can explicitly
      // cast the column if necessary, but passing idRaw as the parameter is typically sufficient.
      const del = await query(
        `DELETE FROM public.talakondapallyemployees WHERE "Employeeid" = $1 RETURNING "Employeeid" AS id`,
        [idRaw]
      );
      
      if (del.rowCount === 0) {
        return res.status(404).json({ error: "Employee not found or ID is invalid." });
      }

      // Re-align sequence after delete (safe to run)
      await query(
        `SELECT setval(
           pg_get_serial_sequence('public.talakondapallyemployees', 'Employeeid'),
           GREATEST(COALESCE((SELECT MAX("Employeeid") FROM public.talakondapallyemployees), 0), 0)
         )`
      );

      return res.status(200).json({ ok: true, id: idRaw });
    }
    // ----------------------------------------------------------------------

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("talakondapally/employees error:", e);
    const errorMessage = e?.message?.includes('duplicate key value') 
        ? 'Employee ID already exists or name is duplicate.' 
        : (e?.detail || e?.message || "Internal server error");
    // Check for foreign key constraint violation (employee has existing attendance records)
    if (e?.detail?.includes('is still referenced from table')) {
        return res.status(409).json({ error: `Cannot delete employee: They have recorded attendance entries. Please ensure all related records are deleted first.` });
    }

    return res.status(500).json({ error: errorMessage });
  }
}