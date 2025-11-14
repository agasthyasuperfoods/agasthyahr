import { Pool } from "pg";

let pool;
if (!global._pgpool) {
  global._pgpool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}
pool = global._pgpool;

// GET  /api/admin/profile?identifier=<employeeid or email>
// PUT  /api/admin/profile  body: { employeeid, name, email, number, doj, designation, address, pancard, aadhaar, company, password? }
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { identifier = "" } = req.query;
      const id = String(identifier || "").trim();
      if (!id) return res.status(400).json({ error: "Missing identifier" });

      const { rows } = await pool.query(
        `SELECT id, name, email, employeeid, doj, designation, address, number, pancard, aadhaar, company
           FROM public.admin
          WHERE LOWER(employeeid)=LOWER($1) OR LOWER(email)=LOWER($1)
          LIMIT 1`,
        [id]
      );
      const row = rows?.[0];
      if (!row) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ ok: true, data: row });
    }

    if (req.method === "PUT") {
      const {
        employeeid,
        name,
        email,
        number,
        doj,
        designation,
        address,
        pancard,
        aadhaar,
        company,
        password, // plain text to match your current table
      } = req.body || {};

      const emp = String(employeeid || "").trim();
      if (!emp) return res.status(400).json({ error: "employeeid is required" });

      const fields = [];
      const values = [];
      let i = 1;

      const push = (col, val) => {
        fields.push(`${col}=$${i++}`);
        values.push(val);
      };

      if (name != null)       push("name", String(name));
      if (email != null)      push("email", String(email));
      if (number != null)     push("number", number === "" ? null : Number(number));
      if (doj != null)        push("doj", doj ? new Date(doj) : null);
      if (designation != null)push("designation", String(designation));
      if (address != null)    push("address", String(address));
      if (pancard != null)    push("pancard", String(pancard));
      if (aadhaar != null)    push("aadhaar", String(aadhaar));
      if (company != null)    push("company", String(company));
      if (password && String(password).trim().length >= 4) {
        push("password", String(password)); // keep plain to match your DB
      }

      if (!fields.length) return res.status(400).json({ error: "No changes" });

      values.push(emp);
      const sql = `
        UPDATE public.admin
           SET ${fields.join(", ")},
               updated_at = NOW()
         WHERE LOWER(employeeid)=LOWER($${i})
            OR LOWER(email)=LOWER($${i})
         RETURNING id
      `;
      const { rows } = await pool.query(sql, values);
      if (!rows?.length) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("/api/admin/profile error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
