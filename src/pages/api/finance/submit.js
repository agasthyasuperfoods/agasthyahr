// /src/pages/api/finance/submit.js
import pool from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { month, company, rows } = req.body || {};

    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ error: "month required as YYYY-MM" });
    }
    if (!company) {
      return res.status(400).json({ error: "company required" });
    }
    // Only ASF -> asfho table for now
    if (String(company).trim().toUpperCase() !== "ASF") {
      return res
        .status(400)
        .json({ error: "This endpoint currently supports only ASF (asfho)." });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "rows[] required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const upsertSql = `
        INSERT INTO public.asfho (
          month, employeeid, name, doj, designation, gross_salary,
          actual_working_days, current_month_eligibility, leaves_taken,
          late_adj_days, lop_days, leaves_cf, working_days
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13
        )
        ON CONFLICT (month, employeeid) DO UPDATE SET
          name = EXCLUDED.name,
          doj = EXCLUDED.doj,
          designation = EXCLUDED.designation,
          gross_salary = EXCLUDED.gross_salary,
          actual_working_days = EXCLUDED.actual_working_days,
          current_month_eligibility = EXCLUDED.current_month_eligibility,
          leaves_taken = EXCLUDED.leaves_taken,
          late_adj_days = EXCLUDED.late_adj_days,
          lop_days = EXCLUDED.lop_days,
          leaves_cf = EXCLUDED.leaves_cf,
          working_days = EXCLUDED.working_days
      `;

      let saved = 0;
      for (const r of rows) {
        const doj =
          r.doj && !Number.isNaN(Date.parse(r.doj)) ? new Date(r.doj) : null;

        const params = [
          month,
          String(r.employeeid || "").trim(),
          r.name || "",
          doj,
          r.designation || null,
          Number.isFinite(Number(r.gross_salary)) ? Number(r.gross_salary) : null,
          Number.isFinite(Number(r.actual_working_days)) ? Number(r.actual_working_days) : 0,
          Number.isFinite(Number(r.current_month_eligibility)) ? Number(r.current_month_eligibility) : 0,
          Number.isFinite(Number(r.leaves_taken)) ? Number(r.leaves_taken) : 0,
          Number.isFinite(Number(r.late_adj_days)) ? Number(r.late_adj_days) : 0,
          Number.isFinite(Number(r.lop_days)) ? Number(r.lop_days) : 0,
          Number.isFinite(Number(r.leaves_cf)) ? Number(r.leaves_cf) : 0,
          Number.isFinite(Number(r.working_days)) ? parseInt(r.working_days, 10) : 0,
        ];

        await client.query(upsertSql, params);
        saved++;
      }

      await client.query("COMMIT");
      return res.status(200).json({ ok: true, saved });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      return res.status(500).json({ error: e.message || "DB error" });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
