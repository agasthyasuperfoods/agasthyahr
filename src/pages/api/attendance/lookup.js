import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// change if different
const EMP_TABLE = `"EmployeeTable"`;

// normalize like you do elsewhere: strip spaces + uppercase
function normId(s) {
  return String(s || "").replace(/\s+/g, "").toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const idsParam = String(req.query?.ids || "").trim();
    if (!idsParam) {
      return res.status(400).json({ error: "Missing ids. Use ?ids=EMP1,EMP2,..." });
    }

    const rawIds = idsParam.split(",").map((x) => x.trim()).filter(Boolean);
    const normIds = Array.from(new Set(rawIds.map(normId))).filter(Boolean);

    if (normIds.length === 0) {
      return res.status(200).json({ ok: true, count: 0, byId: {} });
    }

    const client = await pool.connect();
    try {
      const q = `
        SELECT
          employeeid,
          name,
          company
        FROM ${EMP_TABLE}
        WHERE regexp_replace(upper(employeeid::text), '\\s+', '', 'g') = ANY ($1::text[])
      `;
      const { rows } = await client.query(q, [normIds]);

      const byId = {};
      for (const r of rows) {
        byId[normId(r.employeeid)] = { employeeid: r.employeeid, name: r.name || "", company: r.company || "" };
      }
      return res.status(200).json({ ok: true, count: rows.length, byId });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("GET /api/employees/lookup error:", e);
    return res.status(500).json({ error: "Lookup failed" });
  }
}
