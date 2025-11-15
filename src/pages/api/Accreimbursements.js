import { Client } from "pg";

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Fetch all SUBMITTED reimbursements, ordered by date
    const db = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await db.connect();
    try {
      const result = await db.query(
        `SELECT id, employeeid, employeename, date, amount, status, description, invoice_url
         FROM public."Reimbursement"
         WHERE status = 'SUBMITTED'
         ORDER BY date ASC, id ASC`
      );
      await db.end();
      return res.status(200).json({ success: true, data: result.rows });
    } catch (e) {
      await db.end();
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // PATCH: Update status to PAID for given id
  if (req.method === "PATCH") {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: "Missing reimbursement id" });
    }
    const db = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await db.connect();
    try {
      await db.query(
        `UPDATE public."Reimbursement" SET status = 'PAID' WHERE id = $1`,
        [id]
      );
      await db.end();
      return res.status(200).json({ success: true, message: "Payment marked as done" });
    } catch (e) {
      await db.end();
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}
