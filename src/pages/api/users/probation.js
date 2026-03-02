import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "GET") {
    try {
      const data = await sql`
        SELECT 
          employeeid, name, doj, company, designation, 
          COALESCE(probation_end_date, (doj::date + interval '3 months')::date) as probation_end_date,
          probation_status
        FROM "EmployeeTable"
        WHERE LOWER(probation_status) = 'under_probation'
        ORDER BY probation_end_date ASC
      `;
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === "POST") {
    // Destructure the new fields sent from the frontend
    const { employeeid, action, days, probation, probation_end_date } =
      req.body;

    try {
      if (action === "EXTEND") {
        await sql`
          UPDATE "EmployeeTable"
          SET probation_end_date = COALESCE(probation_end_date, (doj::date + interval '3 months')::date) + ${days} * interval '1 day',
              probation_extension_days = COALESCE(probation_extension_days, 0) + ${days}
          WHERE employeeid = ${employeeid}
        `;
      } else if (action === "CONFIRM") {
        // This query now updates ALL three required fields
        await sql`
          UPDATE "EmployeeTable" 
          SET 
            probation_status = 'CONFIRMED', 
            probation = ${probation || "NO"}, 
            probation_end_date = ${probation_end_date}::date
          WHERE employeeid = ${employeeid}
        `;
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Database Update Error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }
}

