import { Client } from "pg";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { date, employeeName, employeeId, amount, description, fileUrls } = req.body;

  // Only require necessary fields!
  if (!date || !employeeName || !employeeId || !amount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  try {
    // invoice_url as comma-separated string ONLY (no invoice_name, no payment_cycle)
    const invoice_url = Array.isArray(fileUrls) && fileUrls.length > 0
      ? fileUrls.join(',')
      : "";
    
    // Insert to DB (REMOVED payment_cycle in SQL and values)
    const result = await db.query(
      `INSERT INTO public."Reimbursement"
        (employeeid, amount, status, employeename, date, description, invoice_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        employeeId,
        amount,
        'SUBMITTED',
        employeeName,
        date,
        description || "",
        invoice_url,
      ]
    );
    await db.end();
    return res.status(200).json({ success: true, row: result.rows[0] });
  } catch (e) {
    await db.end();
    return res.status(500).json({ success: false, message: e.message || "DB Save Failed" });
  }
}
