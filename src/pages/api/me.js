// src/pages/api/me.js
import pool from "@/lib/db";

export default async function handler(req, res) {
  try {
    // ID saved at login in cookies (server-side readable)
    const cookies = req.headers.cookie || "";
    const idCookie = cookies
      .split(";")
      .map((s) => s.trim())
      .find((c) => c.startsWith("hr_employeeid="));
    const employeeid = idCookie ? decodeURIComponent(idCookie.split("=")[1]) : null;

    let me = null;

    if (employeeid) {
      const { rows } = await pool.query(
        `SELECT employeeid, name, company FROM "EmployeeTable" WHERE employeeid = $1 LIMIT 1`,
        [employeeid]
      );
      if (rows.length) me = rows[0];
    }

    // Best effort fallback (default to ASF)
    if (!me) {
      me = { employeeid: employeeid || null, name: "HR", company: "ASF" };
    }

    res.status(200).json(me);
  } catch (e) {
    res.status(200).json({ employeeid: null, name: "HR", company: "ASF" });
  }
}
