import { Pool } from "pg";

// Optional: bump body size if you upload big Excel files into this route
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

/**
 * Sends a simplified attendance report to a Teams workflow.
 * @param {object} attendanceStats - The statistics to send.
 * @param {string} attendanceStats.date - The date of the report (YYYY-MM-DD).
 * @param {number} attendanceStats.presentCount - The number of present employees.
 * @param {number} attendanceStats.absentCount - The number of absent employees.
 */
async function postToTeamsWorkflow(attendanceStats, pdfUrl) {
  const webhookUrl = process.env.TEAMS_ATTENDANCE_WEBHOOK;
  if (!webhookUrl) {
    console.warn("TEAMS_ATTENDANCE_WEBHOOK not set. Skipping notification.");
    return;
  }

  const { date, presentCount, absentCount } = attendanceStats;
  const payload = {
    text: `📢 **Daily Attendance Report Generated**\n\nTotal Present: ${presentCount}\nTotal Absent: ${absentCount}\nDate: ${date}`,
    // TODO: Implement PDF generation and include the URL here.
    pdfUrl: pdfUrl || "Not available",
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Failed to post to Teams workflow. Status: ${response.status}`, await response.text());
    }
  } catch (error) {
    console.error("Error posting to Teams workflow:", error);
  }
}


export default async function handler(req, res) {
  if (req.method === "POST") {
    const client = await pool.connect();
    try {
      const { date: uiDate, report_date, rows } = req.body || {};

      const date = normalizeReportDate(uiDate ?? report_date);
      if (!date) return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)" });
      if (isFuture(date)) return res.status(400).json({ error: "Future date not allowed" });

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows to save" });
      }

      const filtered = rows.filter((r) => txt(r.company) && !looksResigned(r));

      await client.query("BEGIN");
      for (const r of filtered) {
        const employeeid = String(r.employeeid || "").trim();
        if (!employeeid) continue;

        const name = txt(r.name);
        const intime = toPgTime(r.intime);
        const outtime = toPgTime(r.outtime);
        const workdur = toPgMinutes(r.workdur);
        const status = txt(r.status);
        const remarks = txt(r.remarks);
        const company = txt(r.company);

        await client.query('DELETE FROM "AttendanceDaily" WHERE employeeid = $1 AND date = $2', [
          employeeid,
          date,
        ]);
        await client.query(
          `INSERT INTO "AttendanceDaily"
           (employeeid, name, intime, outtime, workdur, status, remarks, company, date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [employeeid, name, intime, outtime, workdur, status, remarks, company, date]
        );
      }
      await client.query("COMMIT");

      // Calculate stats from the saved (filtered) rows
      let presentCount = 0;
      let absentCount = 0;
      for (const row of filtered) {
        const status = String(row.status || "").toLowerCase();
        if (status === 'present') {
          presentCount++;
        } else if (status === 'absent') {
          absentCount++;
        }
      }

      // Trigger the new Teams workflow
      await postToTeamsWorkflow({
        date,
        presentCount,
        absentCount,
      }, null);

      return res.status(200).json({ ok: true, date, saved: filtered.length });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      console.error("POST /api/attendance/save error:", e);
      return res.status(500).json({ error: "Save failed" });
    } finally {
      client.release();
    }
  }

  // The GET part of the handler is removed for this focused task as it's for PDF exports
  // and the user requested a restore of the core *saving* logic.
  return res.status(405).json({ error: "Method Not Allowed" });
}


/* ===================== Helpers ===================== */
function normalizeReportDate(d) {
  const s = String((Array.isArray(d) ? d[0] : d) || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return null;
}
function isFuture(yyyyMmDd) {
  const a = new Date(yyyyMmDd);
  if (Number.isNaN(a.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  a.setHours(0, 0, 0, 0);
  return a.getTime() > today.getTime();
}
function toPgTime(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:${(m[3] || "00")}`;
}
function toPgMinutes(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
const txt = (x) => {
  const s = String(x ?? "").trim();
  return s === "" ? null : s;
};
const looksResigned = (row) => {
  const bag = [row?.status, row?.remarks, row?.name, row?.company]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
  return /\bresign/.test(bag);
};