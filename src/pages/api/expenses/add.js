import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { location, employeeId, type, amount, date, notes } = req.body;

    if (!location || !employeeId || !type || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const client = await pool.connect();
    try {
      let query = '';
      const numAmount = Number(amount);

      if (location === 'tandur') {
        if (type === 'advance') {
          query = `
            UPDATE public.tanduremployees
            SET "Advances" = COALESCE("Advances", 0) + $1
            WHERE "Employeeid" = $2
            RETURNING employee_name;
          `;
        } else {
          query = `
            UPDATE public.tanduremployees
            SET "Food_Expenses" = (COALESCE("Food_Expenses"::integer, 0) + $1)::text
            WHERE "Employeeid" = $2
            RETURNING employee_name;
          `;
        }
      } else if (location === 'talakondapally') {
        const column = type === 'advance' ? '"Advances"' : '"Food_Expenses"';
        query = `
          UPDATE public.talakondapallyemployees
          SET ${column} = COALESCE(${column}, 0) + $1
          WHERE "Employeeid" = $2
          RETURNING employee_name;
        `;
      } else if (location === 'operations') {
        const column = type === 'advance' ? '"Advances"' : '"Food_Expenses"';
        query = `
          UPDATE public."Milk_point_Employees"
          SET ${column} = COALESCE(${column}, 0) + $1
          WHERE id = $2
          RETURNING "Name" as employee_name;
        `;
      }

      const { rows } = await client.query(query, [numAmount, employeeId]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      return res.status(200).json({ 
        ok: true, 
        message: `${type === 'advance' ? 'Advance' : 'Food Expense'} added successfully`,
        employeeName: rows[0].employee_name
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("POST /api/expenses/add error:", e);
    return res.status(500).json({ error: "Failed to add expense" });
  }
}
