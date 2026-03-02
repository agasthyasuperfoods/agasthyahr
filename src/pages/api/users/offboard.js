import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { employeeid, resigneddate } = req.body;
  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Fetch employee from active table
    const [employee] =
      await sql`SELECT * FROM "EmployeeTable" WHERE employeeid = ${employeeid}`;
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    // 2. Perform move in a single transaction to ensure data safety
    await sql.transaction([
      sql`
        INSERT INTO "ExEmployeeTable" (
          employeeid, name, doj, number, role, email, company, 
          resigneddate, grosssalary, adhaarnumber, pancard, 
          address, designation, reporting_to_id
        ) VALUES (
          ${employee.employeeid}, 
          ${employee.name || ''}, 
          ${employee.doj}, 
          ${employee.number ? parseFloat(employee.number) : null}, 
          ${employee.role}, 
          ${employee.email}, 
          ${employee.company}, 
          ${resigneddate}, 
          ${employee.grosssalary}, 
          ${employee.adhaarnumber ? parseFloat(employee.adhaarnumber) : null}, 
          ${employee.pancard}, 
          ${employee.address}, 
          ${employee.designation}, 
          ${employee.reporting_to_id}
        )
      `,
      sql`DELETE FROM "EmployeeTable" WHERE employeeid = ${employeeid}`
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Offboarding Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
