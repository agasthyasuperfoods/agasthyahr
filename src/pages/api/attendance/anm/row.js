import pool from "@/lib/db";

const TABLES = {
  tandur: "public.tandur",
  thalakondapallya: "public.thalakondapallya",
};

export default async function handler(req, res) {
  const site = String(req.query.site || "").toLowerCase();
  const table = TABLES[site];
  if (!table) {
    return res.status(400).json({ error: "Invalid site", sites: Object.keys(TABLES) });
  }

  try {
    if (req.method === "PUT") {
      // Body: { si, name, status }
      const { si, name, status } = req.body || {};
      const siNum = Number(si);
      if (!Number.isInteger(siNum)) {
        return res.status(400).json({ error: "si (integer) is required" });
      }

      const { rows } = await pool.query(
        `UPDATE ${table}
         SET name = COALESCE($2, name),
             status = COALESCE($3, status)
         WHERE si = $1
         RETURNING *`,
        [siNum, name ?? null, status ?? null]
      );

      if (rows.length === 0) return res.status(404).json({ error: "Row not found" });
      return res.status(200).json({ row: rows[0] });
    }

    if (req.method === "DELETE") {
      // Query: ?site=...&si=...
      const si = Number(req.query.si);
      if (!Number.isInteger(si)) {
        return res.status(400).json({ error: "si (integer) is required" });
      }

      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE si = $1`, [si]);
      if (rowCount === 0) return res.status(404).json({ error: "Row not found" });
      return res.status(200).json({ deleted: true });
    }

    res.setHeader("Allow", "PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("ANM row mutation error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
