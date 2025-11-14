// pages/api/employee/[id].js
import { Pool } from "pg";

// Set your connection string in .env.local as POSTGRES_URL=postgres://user:pass@host/db
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ success: false, message: "Missing employee id" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  let client;
  try {
    client = await pool.connect();

    if (req.method === "GET") {
      try {
        const result = await client.query(
          `SELECT employeeid, name, number, email FROM "EmployeeTable" WHERE employeeid = $1`,
          [id]
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
        console.error("GET /api/employee/[id] error:", err);
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    if (req.method === "POST") {
      const { name, number } = req.body;
      if (!name || !number) {
        return res.status(400).json({ success: false, message: "Name and number are required" });
      }
      try {
        await client.query(
          `UPDATE "EmployeeTable" SET name = $1, number = $2 WHERE employeeid = $3`,
          [name, number, id]
        );
        return res.status(200).json({ success: true, message: "Profile updated" });
      } catch (err) {
        console.error("POST /api/employee/[id] error:", err);
        return res.status(500).json({ success: false, message: err.message });
      }
    }
  } catch (e) {
    console.error("Connection error:", e);
    return res.status(500).json({ success: false, message: "Database connection failed" });
  } finally {
    if (client) client.release();
  }
}
