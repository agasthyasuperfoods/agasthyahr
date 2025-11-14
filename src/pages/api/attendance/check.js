import pool from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const date = String(req.query?.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date" });
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public."AttendanceDaily" WHERE "date" = $1::date`,
      [date]
    );
    const count = rows?.[0]?.count ?? 0;
    return res.status(200).json({ date, count, hasData: count > 0 });
  } catch (e) {
    console.error("GET /api/attendance/check failed:", e);
    return res.status(500).json({ error: "Failed to check date" });
  }
}
