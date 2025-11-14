import pool from "@/lib/db"; // or wherever your pool connection is

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { employeeId, doj } = req.body;
    const dateOnly = doj.slice(0, 10); // "2025-08-01"
    try {
      const result = await pool.query(
        'SELECT * FROM public."EmployeeTable" WHERE employeeid = $1 AND CAST(doj AS date) = $2',
        [employeeId, dateOnly]
      );
      if (result.rows.length > 0) {
        res.status(200).json({ success: true });
      } else {
        res.status(200).json({ success: false, message: 'ID or DOJ mismatch.' });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error.', error: err.message });
    }
  } else {
    res.status(405).end();
  }
}
