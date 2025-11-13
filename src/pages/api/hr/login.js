// src/pages/api/hr/login.js
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { identifier, password } = req.body || {};

    const raw = String(identifier || "").trim();
    if (!raw || !password) {
      return res
        .status(400)
        .json({ error: "Email or Employee ID and password are required" });
    }

    // Check if it's an email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);

    // Queries
  const sqlById = `
  SELECT employeeid, email, name, role, password
  FROM public."EmployeeTable"
  WHERE LOWER(employeeid) = LOWER($1)
  LIMIT 1
`;
    const sqlByEmail = `
      SELECT employeeid, email, name, role, password
      FROM public."EmployeeTable"
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `;

    const { rows } = await pool.query(isEmail ? sqlByEmail : sqlById, [raw]);

    const user = rows?.[0];
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Only HR may log in
    if (String(user.role || "").toUpperCase() !== "HR") {
      return res.status(403).json({ error: "Only HR users can sign in here" });
    }

    // Password check (bcrypt or plain)
    const dbPwd = user.password || "";
    let ok = false;
    if (dbPwd.startsWith("$2")) {
      ok = await bcrypt.compare(password, dbPwd);
    } else {
      ok = password === dbPwd;
    }

    if (!ok) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    return res.status(200).json({
      ok: true,
      user: {
        id: user.employeeid,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("POST /api/hr/login failed:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
