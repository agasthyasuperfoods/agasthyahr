import { Pool } from "pg";

// Optional: bump body size if you upload big Excel files into this route
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

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
  if (req.method === "GET") {
    // ---------- READ-ONLY EXPORTS ----------
    try {
      const { scope, date, start, end, company } = req.query || {};
      const client = await pool.connect();
      try {
        let where = [];
        let params = [];
        let title = "Attendance – Export";

        const add = (cond, val) => {
          params.push(val);
          where.push(`${cond} $${params.length}`);
        };

        if (company) {
          add(`company =`, String(company));
          title += ` • ${company}`;
        }

        if (String(scope || "").toLowerCase() === "all") {
          title += company ? " • All Dates" : " • All Data";
        } else if (date) {
          const nd = normalizeReportDate(date);
          if (!nd) return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)" });
          add(`date =`, nd);
          title += ` • ${nd}`;
        } else if (start && end) {
          const s = normalizeReportDate(start);
          const e = normalizeReportDate(end);
          if (!s || !e) return res.status(400).json({ error: "Invalid start/end (use YYYY-MM-DD)" });
          params.push(s, e);
          where.push(`date BETWEEN $${params.length - 1} AND $${params.length}`);
          title += ` • ${s} → ${e}`;
        } else {
          return res.status(400).json({ error: "Provide scope=all OR date=YYYY-MM-DD OR start&end" });
        }

        const sql = `
  SELECT employeeid, name, company, intime, outtime, workdur, status, remarks, date
  FROM "AttendanceDaily"
  ${where.length ? "WHERE " + where.join(" AND ") : ""}
  ORDER BY company, date, name
`;

        const { rows } = await client.query(sql, params);

        const multiDate = !date && !(start && end && start === end);
        const pdfBytes = await makeAttendancePdf(rows, title, { includeDate: multiDate });

        res.setHeader("Content-Type", "application/pdf");
        const fname = safeFileName(title) + ".pdf";
        res.setHeader("Content-Disposition", `inline; filename="${fname}"`);
        return res.status(200).send(Buffer.from(pdfBytes));
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("GET /api/attendance/save export error:", e);
      return res.status(500).json({ error: "Export failed" });
    }
  }

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
const safeFileName = (s) =>
  String(s || "attendance").replace(/[^\w\-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\s/g, "_");

// Clean local timestamp (no seconds, no timezone)
function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/* ===================== PDF (company segmented; centered band; clean header) ===================== */
// makeAttendancePdf(items, titleText, { includeDate: boolean })
async function makeAttendancePdf(items, titleText, opts = {}) {
  const { includeDate = false } = opts;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  // Document & layout
  const pdf = await PDFDocument.create();
  const pageSize = { w: 595.28, h: 841.89 }; // A4 portrait
  const pageMargins = { left: 36, right: 36, top: 70, bottom: 64 };
  const contentW = pageSize.w - pageMargins.left - pageMargins.right;

  // Fonts
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Columns (Date column added when exporting >1 date)
  const cols = [
    { k: "employeeid", label: "EmpID",  w: 90,  align: "left"   },
    ...(includeDate ? [{ k: "date", label: "Date", w: 64, align: "center" }] : []),
    { k: "name",       label: "Name",   w: 120, align: "left"   },
    { k: "intime",     label: "In",     w: 56,  align: "center" },
    { k: "outtime",    label: "Out",    w: 56,  align: "center" },
    { k: "hours",      label: "Hours",  w: 58,  align: "right"  },
    { k: "status",     label: "Status", w: 70,  align: "left"   },
    { k: "remarks",    label: "Remarks", w: 73, align: "left"  },
  ];
  let totalW = cols.reduce((s, c) => s + c.w, 0);
  if (totalW > contentW) {
    const scale = contentW / totalW;
    cols.forEach((c) => (c.w = Math.floor(c.w * scale)));
    totalW = cols.reduce((s, c) => s + c.w, 0);
  }

  // Style tokens
  const titleSize = 16, metaSize = 10, headerSize = 11, cellSize = 10;
  const cellLeading = 15;
  const headerBandH = 26;

  // Company band tuning (centered with padding)
  const companySize = 12;
  const companyLeading = 16;
  const companyPadX = 12;
  const companyPadY = 8;
  const companyBandMinH = 28;

  const rowPadX = 8, rowPadY = 6;
  const zebra1 = rgb(1, 1, 1), zebra2 = rgb(0.97, 0.97, 0.99);
  const headerBg = rgb(0.90, 0.95, 1.00);
  const companyBg = rgb(0.95, 0.95, 0.95);
  const grid = rgb(0.80, 0.80, 0.85);
  const textColor = rgb(0.12, 0.12, 0.12);
  const metaColor = rgb(0.35, 0.35, 0.42);

  // Utils
  const widthOf = (t, f, s) => f.widthOfTextAtSize(String(t ?? ""), s);
  const wrapText = (t, f, s, maxW) => {
    const text = String(t ?? "").replace(/\s+/g, " ").trim();
    if (!text) return [""];
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (widthOf(test, f, s) <= maxW) line = test;
      else {
        if (!line) {
          let chunk = "";
          for (const ch of w) {
            if (widthOf(chunk + ch, f, s) <= maxW) chunk += ch;
            else { if (chunk) lines.push(chunk); chunk = ch; }
          }
          if (chunk) lines.push(chunk);
        } else { lines.push(line); line = w; }
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const fmtTime = (s) => {
    const v = String(s ?? "").trim();
    if (!v) return "";
    const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    return m ? `${m[1].padStart(2,"0")}:${m[2]}` : v;
  };
  const minutesToHHMM = (mins) => {
    const n = Number(mins);
    if (!Number.isFinite(n) || n < 0) return "";
    const h = Math.floor(n / 60), m = n % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  };
  const fmtDate = (d) => {
    if (!d) return "";
    const s = String(d).slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s;
  };

  const normalized = items.map((r) => ({
    employeeid: String(r.employeeid ?? ""),
    name: String(r.name ?? ""),
    company: String(r.company ?? "") || "—",
    intime: fmtTime(r.intime),
    outtime: fmtTime(r.outtime),
    hours: minutesToHHMM(r.workdur),
    status: String(r.status ?? ""),
    remarks: String(r.remarks ?? ""),
    date: includeDate ? fmtDate(r.date) : undefined,
  }))
  .sort((a, b) => {
    const cmpCompany = a.company.localeCompare(b.company);
    if (cmpCompany !== 0) return cmpCompany;

    const numA = Number(String(a.employeeid).replace(/\D/g, "")) || 0;
    const numB = Number(String(b.employeeid).replace(/\D/g, "")) || 0;
    if (numA !== numB) return numA - numB;

    if (a.employeeid !== b.employeeid) return a.employeeid.localeCompare(b.employeeid);
    return a.name.localeCompare(b.name);
  });

  const groups = [];
  let g = null;
  for (const row of normalized) {
    if (!g || g.company !== row.company) {
      const display = `${row.company} • v1`;
      g = { company: row.company, display, items: [] };
      groups.push(g);
    }
    g.items.push(row);
  }

  const pages = [];
  let page = pdf.addPage([pageSize.w, pageSize.h]); pages.push(page);

  const drawPageHeader = (p, pageIndex) => {
    const { height } = p.getSize();
    const x = pageMargins.left;
    let y = height - pageMargins.top + 10;

    p.drawText(String(titleText || "Attendance"), { x, y, size: titleSize, font: bold, color: textColor });
    y -= 18;

    const meta = `Records: ${normalized.length}   •   Generated: ${nowStamp()}   •   Page ${pageIndex + 1}`;
    p.drawText(meta, { x, y, size: metaSize, font, color: metaColor });
    y -= 12;
    return y;
  };

  const drawTableHeader = (p, y) => {
    p.drawRectangle({
      x: pageMargins.left,
      y: y - headerBandH + 6,
      width: totalW,
      height: headerBandH,
      color: headerBg,
      borderColor: grid,
      borderWidth: 0.5,
    });
    let x = pageMargins.left + rowPadX;
    const baseline = y - headerBandH + 14;
    for (const c of cols) {
      p.drawText(c.label, { x, y: baseline, size: headerSize, font: bold, color: textColor });
      x += c.w;
    }
    return y - headerBandH - 6;
  };

  const drawFooter = (p, pageIndex, pageCount) => {
    const { width } = p.getSize();
    const cx = width / 2;
    const y = pageMargins.bottom - 28;
    const t = `Page ${pageIndex + 1} of ${pageCount}`;
    const tw = widthOf(t, font, metaSize);
    p.drawText(t, { x: cx - tw / 2, y, size: metaSize, font, color: metaColor });
  };

  const newPage = () => {
    page = pdf.addPage([pageSize.w, pageSize.h]);
    pages.push(page);
    cursorY = drawPageHeader(page, pages.length - 1);
  };

  let cursorY = drawPageHeader(page, 0);
  const bottomLimit = pageMargins.bottom + 36;

  const drawCompanyBandAndHeader = (companyName, checkSpace = true) => {
    const name = (companyName || "—").trim();

    const maxTextWidth = totalW - 2 * companyPadX;
    const nameLines = wrapText(name, bold, companySize, Math.max(0, maxTextWidth));
    const contentH = Math.max(companySize, nameLines.length * companyLeading);
    const bandH = Math.max(companyBandMinH, companyPadY * 2 + contentH);

    const needed = bandH + headerBandH + 6;
    if (checkSpace && cursorY - needed < bottomLimit) newPage();

    page.drawRectangle({
      x: pageMargins.left,
      y: cursorY - bandH,
      width: totalW,
      height: bandH,
      color: companyBg,
      borderColor: grid,
      borderWidth: 0.6,
    });

    let lineY = cursorY - companyPadY - companySize;
    for (const line of nameLines) {
      const tw = widthOf(line, bold, companySize);
      const textX = pageMargins.left + (totalW - tw) / 2;
      page.drawText(line, { x: textX, y: lineY, size: companySize, font: bold, color: textColor });
      lineY -= companyLeading;
    }

    cursorY -= bandH;
    cursorY = drawTableHeader(page, cursorY);
  };

  const ensureRowSpace = (rowH, companyName) => {
    if (cursorY - rowH < bottomLimit) { newPage(); drawCompanyBandAndHeader(companyName, false); }
  };

  const drawRow = (row, idxWithinCompany) => {
    const linesPerCol = cols.map(c =>
      wrapText(row[c.k], font, cellSize, Math.max(0, c.w - 2*rowPadX))
    );
    const maxLines = Math.max(...linesPerCol.map(ls => ls.length));
    const rowH = Math.max(cellLeading + rowPadY + 4, rowPadY + maxLines * cellLeading + 4);

    ensureRowSpace(rowH, row.company);

    page.drawRectangle({
      x: pageMargins.left, y: cursorY - rowH,
      width: totalW, height: rowH,
      color: idxWithinCompany % 2 === 0 ? zebra1 : zebra2,
      borderColor: grid, borderWidth: 0.25,
    });

    let x = pageMargins.left;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      page.drawRectangle({ x, y: cursorY - rowH, width: c.w, height: rowH, borderColor: grid, borderWidth: 0.35 });

      const cellX = x + rowPadX;
      let yLine = cursorY - rowPadY - cellLeading;
      for (const line of linesPerCol[i]) {
        let drawX = cellX;
        if (c.align === "right") {
          const tw = widthOf(line, font, cellSize);
          drawX = x + c.w - rowPadX - tw;
        } else if (c.align === "center") {
          const tw = widthOf(line, font, cellSize);
          drawX = x + (c.w - tw) / 2;
        }
        page.drawText(line, { x: drawX, y: yLine, size: cellSize, font, color: textColor });
        yLine -= cellLeading;
      }
      x += c.w;
    }
    cursorY -= rowH;
  };

  for (const group of groups) {
    drawCompanyBandAndHeader(group.display, true);
    group.items.forEach((row, i) => drawRow({ ...row, company: group.company }, i));
    cursorY -= 8;
  }

  const pageCount = pages.length;
  pages.forEach((p, i) => drawFooter(p, i, pageCount));

  return await pdf.save();
}