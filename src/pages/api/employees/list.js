import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { location } = req.query;

    if (!location || !['tandur', 'talakondapally', 'operations', 'all'].includes(location)) {
      return res.status(400).json({ error: "Invalid location" });
    }

    const client = await pool.connect();
    try {
      let employees = [];
      
      if (location === 'all' || location === 'tandur') {
        const tandurQuery = `
          SELECT 
            "Employeeid" as id,
            employee_name as name,
            designation,
            "Gross_Salary" as gross_salary,
            "Advances" as advances,
            "Food_Expenses" as food_expenses,
            'Tandur' as location
          FROM public.tanduremployees
          ORDER BY employee_name;
        `;
        const { rows: tandurRows } = await client.query(tandurQuery);
        employees = [...employees, ...tandurRows];
      }
      
      if (location === 'all' || location === 'talakondapally') {
        const talQuery = `
          SELECT 
            "Employeeid" as id,
            employee_name as name,
            designation,
            "Gross_Salery" as gross_salary,
            "Advances" as advances,
            "Food_Expenses" as food_expenses,
            'Talakondapally' as location
          FROM public.talakondapallyemployees
          ORDER BY employee_name;
        `;
        const { rows: talRows } = await client.query(talQuery);
        employees = [...employees, ...talRows];
      }
      
      if (location === 'all' || location === 'operations') {
        const opsQuery = `
          SELECT 
            id,
            "Name" as name,
            "Designation" as designation,
            "Gross Salary" as gross_salary,
            "Advances" as advances,
            "Food_Expenses" as food_expenses,
            'Operations' as location
          FROM public."Milk_point_Employees"
          WHERE LOWER(COALESCE("Location", '')) = 'operations'
          ORDER BY "Name";
        `;
        const { rows: opsRows } = await client.query(opsQuery);
        employees = [...employees, ...opsRows];
      }

      return res.status(200).json({ ok: true, employees });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/employees/list error:", e);
    return res.status(500).json({ error: "Failed to load employees" });
  }
}
