// /src/pages/api/auth/reset/complete.js
import jwt from "jsonwebtoken";
import pool from "@/lib/db";

const SECRET = process.env.RESET_TOKEN_SECRET;
const DEBUG = process.env.DEBUG_RESET === "1";

// If your EmployeeTable stores password in a different column (e.g. password_hash), update SQL_EMPLOYEE accordingly.
const SQL_ADMIN_UPDATE = `
  UPDATE public.admin
  SET password = $1
  WHERE lower(email) = lower($2) OR lower(employeeid) = lower($3)
`;

const SQL_EMPLOYEE_UPDATE = `
  UPDATE "EmployeeTable"
  SET password = $1
  WHERE lower(email) = lower($2) OR lower(employeeid) = lower($3)
`;

function normalizeToPath(toParam) {
  const ALLOWED = new Set(["/Alogin", "/Hlogin"]);
  if (!toParam) return "/Hlogin";
  let s = String(toParam).trim();
  if (!s.startsWith("/")) s = `/${s}`;
  return ALLOWED.has(s) ? s : "/Hlogin";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!SECRET) throw new Error("RESET_TOKEN_SECRET is not set");

    const { token, password, to } = req.body || {};
    const pwd = String(password || "");

    if (!token || !pwd) {
      return res.status(400).json({ error: "Missing token or password" });
    }
    if (pwd.length < 4) {
      return res.status(400).json({ error: "Password too short" });
    }

    let payload;
    try {
      payload = jwt.verify(String(token), SECRET);
    } catch (e) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Prefer audience from token; fall back to the 'to' param if token is old and lacks 'aud'
    const toPath = normalizeToPath(to);
    const audience = payload?.aud || (toPath === "/Alogin" ? "admin" : "employee");

    const email = payload?.email || "";
    const employeeid = payload?.sub || "";

    const params = [pwd, email, employeeid];

    const sql = audience === "admin" ? SQL_ADMIN_UPDATE : SQL_EMPLOYEE_UPDATE;

    const result = await pool.query(sql, params);

    if (!result.rowCount) {
      if (DEBUG) console.log("[reset/complete] No rows updated", { audience, email, employeeid });
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    if (DEBUG) console.error("[reset/complete] Fatal:", e?.message || e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
