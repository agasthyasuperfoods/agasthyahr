import bcrypt from "bcryptjs";
import { Pool } from "pg";

// 1. Reuse one pool instance
let pool;
if (!global._pgpool) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("FATAL ERROR: DATABASE_URL is not set in your .env.local file.");
  }
  
  global._pgpool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
  });
}
pool = global._pgpool;

// 2. SQL Query - UPDATED to use "EmployeeTable"
// This now matches your database schema
const SQL_FIND_EMPLOYEE = `
  SELECT employeeid, password, name, role
  FROM public."EmployeeTable"
  WHERE LOWER("employeeid") = LOWER($1)
  LIMIT 1
`;


export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { employeeId, passcode } = req.body || {};
    const idTrim = String(employeeId || "").trim();
    const pwdTrim = String(passcode || "");

    if (!idTrim || !pwdTrim) {
      return res.status(400).json({ success: false, message: "Employee ID and Passcode are required." });
    }

    // 3. Look up by employeeid in your 'EmployeeTable'
    const { rows } = await pool.query(SQL_FIND_EMPLOYEE, [idTrim]);
    const user = rows?.[0];
    
    if (!user) {
      console.log("Login failed: User not found.");
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const storedPassword = String(user.password || "");

    // 4. Securely check password
    let isMatch = false;
    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(pwdTrim, storedPassword);
    } else {
      isMatch = (storedPassword === pwdTrim);
    }

    if (!isMatch) {
      console.log("Login failed: Passwords do not match.");
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // 5. Success!
    console.log("Login successful for:", user.employeeid);
    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: {
        employeeid: user.employeeid,
        name: user.name,
        role: user.role || "Employee",
      },
    });

  } catch (e) {
    console.error("--- LOGIN API CRASHED ---");
    console.error(e); // The real error will be in your terminal
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}