import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // <- use DATABASE_URL, not POSTGRES_URL
  ssl: { rejectUnauthorized: false }
});


export default async function handler(req, res) {
  let client;
  try {
    client = await pool.connect();

    if (req.method === "GET") {
      // GET /api/emp?employeeid=EMP163
      const { employeeid } = req.query;
      if (!employeeid) {
        return res.status(400).json({ success: false, message: "Missing employeeid in query" });
      }
      try {
        const result = await client.query(
          'SELECT employeeid, name, number, email FROM "EmployeeTable" WHERE employeeid = $1',
          [employeeid]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Employee not found" });
        }
        const row = result.rows[0];
        return res.status(200).json({
          success: true,
          employeeid: row.employeeid,
          name: row.name,
          number: row.number,
          email: row.email,
        });
      } catch (err) {
        console.error("GET /api/emp error:", err);
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    if (req.method === "POST") {
      // POST to /api/emp with { employeeid, name, number } in JSON
      const { employeeid, name, number } = req.body;
      if (!employeeid || !name || !number) {
        return res.status(400).json({ success: false, message: "employeeid, name, and number required in body" });
      }
      try {
        await client.query(
          'UPDATE "EmployeeTable" SET name = $1, number = $2 WHERE employeeid = $3',
          [name, number, employeeid]
        );
        return res.status(200).json({ success: true, message: "Profile updated" });
      } catch (err) {
        console.error("POST /api/emp error:", err);
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error("Connection error:", e);
    return res.status(500).json({ success: false, message: "Database connection failed" });
  } finally {
    if (client) client.release();
  }
}
