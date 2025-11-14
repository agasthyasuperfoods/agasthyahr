// pages/api/auth/login.js
import bcrypt from "bcryptjs";
import { Pool } from "pg";

// Reuse one pool instance across hot reloads / serverless invocations
let pool;
if (!global._pgpool) {
  global._pgpool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
  });
}
pool = global._pgpool;

const SQL_FIND_ADMIN = `
  SELECT id, name, email, employeeid, password
  FROM public."admin"
  WHERE LOWER(employeeid) = LOWER($1) OR LOWER(email) = LOWER($1)
  LIMIT 1
`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { identifier, password } = req.body || {};
    const idTrim = String(identifier || "").trim();
    const pwdTrim = String(password || "");

    if (!idTrim || !pwdTrim) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // Look up by employeeid (or email) in 'admin' table
    const { rows } = await pool.query(SQL_FIND_ADMIN, [idTrim]);
    const user = rows?.[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const stored = String(user.password || "");

    // Accept bcrypt OR plain text (so you can migrate later without breaking)
    let ok = false;
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      ok = await bcrypt.compare(pwdTrim, stored);
    } else {
      ok = stored === pwdTrim;
    }
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Success payload (your Alogin only needs ok:true, but returning user is handy)
    return res.status(200).json({
      ok: true,
      user: {
        id: user.id,
        employeeid: user.employeeid,
        name: user.name || user.employeeid,
        email: user.email || null,
        role: "ADMIN",
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
