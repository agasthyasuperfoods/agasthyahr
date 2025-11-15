import { Client } from "pg";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { employeeId, page = 1, limit = 7, year, month } = req.query;
  if (!employeeId) {
    return res.status(400).json({ success: false, message: "Missing employeeId" });
  }
  const p = Math.max(1, parseInt(page));
  const lim = Math.max(1, parseInt(limit));
  const offset = (p - 1) * lim;

  // Support dynamic month/year (default to current)
  const now = new Date();
  const yyyy = year ? Number(year) : now.getFullYear();
  const mm = month ? String(month).padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0");
  const firstDay = `${yyyy}-${mm}-01`;
  const lastDayDateObj = new Date(yyyy, parseInt(mm), 0);
  const lastDay = `${yyyy}-${mm}-${String(lastDayDateObj.getDate()).padStart(2, "0")}`;

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  try {
    // Get Carry Forward Leaves and name
    const empResult = await db.query(
      `SELECT "Leaves_cf", name FROM public."EmployeeTable" WHERE employeeid = $1`,
      [employeeId]
    );
    if (!empResult.rows.length) {
      await db.end();
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Count total leave records for pagination (only 'Leave' status)
    const countResult = await db.query(
      `SELECT COUNT(*) FROM public."AttendanceDaily"
       WHERE employeeid = $1 AND date >= $2 AND date <= $3 AND status = 'Leave'`,
      [employeeId, firstDay, lastDay]
    );
    const totalRows = Number(countResult.rows[0].count);

    // Paginate only leave records in this month
    const result = await db.query(
      `SELECT date, status, remarks
       FROM public."AttendanceDaily"
       WHERE employeeid = $1 AND date >= $2 AND date <= $3 AND status = 'Leave'
       ORDER BY date DESC
       LIMIT $4 OFFSET $5`,
      [employeeId, firstDay, lastDay, lim, offset]
    );

    // Aggregate leave count for summary
    const summaryResult = await db.query(
      `SELECT COUNT(*) FROM public."AttendanceDaily"
       WHERE employeeid = $1 AND date >= $2 AND date <= $3 AND status = 'Leave'`,
      [employeeId, firstDay, lastDay]
    );
    const leaveDays = Number(summaryResult.rows[0].count) || 0;

    await db.end();
    return res.status(200).json({
      success: true,
      leaves_cf: empResult?.rows[0]?.Leaves_cf || 0,
      name: empResult?.rows[0]?.name || "",
      leaveDays,
      data: result.rows,
      total: totalRows,
      page: p,
      pages: Math.ceil(totalRows / lim)
    });
  } catch (e) {
    await db.end();
    console.error("EmployeeLeaves API Error:", e);
    return res.status(500).json({ success: false, message: e.message });
  }
}
