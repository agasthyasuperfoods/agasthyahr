// src/pages/api/hr/changepwd.js
import pool from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { employeeid, oldPassword, newPassword } = req.body || {};

  if (!employeeid || !oldPassword || !newPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    // 1. Fetch the current user to verify the old password
    const sqlCheck = `
      SELECT password 
      FROM public."EmployeeTable" 
      WHERE LOWER(employeeid) = LOWER($1) 
      LIMIT 1
    `;
    const { rows } = await pool.query(sqlCheck, [employeeid]);
    const user = rows?.[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Verify current password (plain text check as per your DB screenshot)
    if (user.password !== oldPassword) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    // 3. Update to the new password
    const sqlUpdate = `
      UPDATE public."EmployeeTable" 
      SET password = $1 
      WHERE LOWER(employeeid) = LOWER($2)
    `;
    await pool.query(sqlUpdate, [newPassword, employeeid]);

    return res.status(200).json({ ok: true, message: "Password updated successfully" });

  } catch (e) {
    console.error("POST /api/hr/changepwd failed:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}