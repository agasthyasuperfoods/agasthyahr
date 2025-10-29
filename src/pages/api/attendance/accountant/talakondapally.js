import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  try {
    // Get attendance with employee details - using correct column names
    const query = `
      SELECT 
        ta."EmployeeId" as employeeid,
        ta."name",
        ta."date",
        ta."status",
        ta."review",
        ta."submitted",
        ta."review_status",
        ta."reviewflag",
        ta."attendance_date",
        te."employee_name",
        te."employee_number",
        te."designation",
        te."location"
      FROM public."talakondapally_attendance" ta
      LEFT JOIN public."talakondapallyemployees" te ON ta."EmployeeId" = te."Employeeid"
      WHERE ta."date" = $1 OR ta."attendance_date" = $1
      ORDER BY ta."EmployeeId"
    `;

    const result = await pool.query(query, [date]);
    
    // Get total employee count
    const countQuery = `SELECT COUNT(*) as total FROM public."talakondapallyemployees"`;
    const countResult = await pool.query(countQuery);

    res.status(200).json({
      attendance: result.rows,
      totalEmployees: parseInt(countResult.rows[0].total),
      date: date
    });
  } catch (error) {
    console.error("Error fetching Talakondapally attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}