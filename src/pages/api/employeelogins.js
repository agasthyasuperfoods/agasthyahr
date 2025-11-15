import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { employeeId, page = 1, limit = 7 } = req.query;
  if (!employeeId) {
    return res.status(400).json({ success: false, message: "Missing employeeId" });
  }
  const p = Math.max(1, parseInt(page));
  const lim = Math.max(1, parseInt(limit));
  const offset = (p - 1) * lim;

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  try {
    // Use correct table name with correct case
    const countResult = await db.query(
      `SELECT count(*) FROM public."AttendanceDaily" WHERE employeeid = $1`, [employeeId]
    );
    const totalRows = Number(countResult.rows[0].count);

    const result = await db.query(
      `SELECT date, shift, intime, outtime, workdur, status, remarks, company, uploaded_at
       FROM public."AttendanceDaily"
       WHERE employeeid = $1
       ORDER BY date DESC
       LIMIT $2 OFFSET $3`,
      [employeeId, lim, offset]
    );

    await db.end();
    return res.status(200).json({
      success: true,
      data: result.rows,
      total: totalRows,
      page: p,
      pages: Math.ceil(totalRows / lim)
    });
  } catch (e) {
    await db.end();
    console.error("Attendance API error:", e);
    return res.status(500).json({ success: false, message: e.message });
  }
}
