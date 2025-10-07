import { Pool } from "pg";

// Optional: bump body size if you upload big Excel files into this route
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    // ---------- READ-ONLY EXPORTS ----------
    // Modes:
    //   /api/attendance/save?scope=all
    //   /api/attendance/save?date=YYYY-MM-DD
    //   /api/attendance/save?start=YYYY-MM-DD&end=YYYY-MM-DD
    // Optional: &company=Exact Company Name
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
        // connection auto-managed by pool; no-op
      }
    } catch (e) {
      console.error("GET /api/attendance/save export error:", e);
      return res.status(500).json({ error: "Export failed" });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // ---------- WRITE + DAILY PDF ----------
  const isPreview =
    String(req.query.preview || "").toLowerCase() === "1" || req.body?.preview === true;
  const isDebug =
    String(req.query.debug || "").toLowerCase() === "1" || req.body?.debug === true;

  const client = await pool.connect();
  try {
    const { date: uiDate, report_date, rows } = req.body || {};

    const date = normalizeReportDate(uiDate ?? report_date);
    if (!date) return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)" });
    if (isFuture(date)) return res.status(400).json({ error: "Future date not allowed" });

    // --- PREVIEW: generate PDF without writing ---
    // If rows provided -> preview those (as-is). If rows empty OR ?source=db -> preview from DB for the date.
    if (isPreview) {
      const useDb =
        String(req.query.source || "").toLowerCase() === "db" ||
        !Array.isArray(rows) ||
        rows.length === 0;

      let previewRows;
      if (useDb) {
        const { rows: persisted } = await client.query(
          'SELECT employeeid, name, company, intime, outtime, workdur, status, remarks, date \
           FROM "AttendanceDaily" WHERE date = $1 ORDER BY company, name',
          [date]
        );
        previewRows = persisted;
      } else {
        // Only rows with a company AND not resigned
        const filtered = rows.filter((r) => txt(r.company) && !looksResigned(r));
        previewRows = filtered.map((r) => ({
          employeeid: String(r.employeeid || "").trim(),
          name: txt(r.name),
          company: txt(r.company),
          intime: toPgTime(r.intime),
          outtime: toPgTime(r.outtime),
          workdur: toPgMinutes(r.workdur),
          status: txt(r.status),
          remarks: txt(r.remarks),
          date,
        }));
      }

      const pdfBytes = await makeAttendancePdf(previewRows, `Attendance – ${date}`, { includeDate: false });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="attendance-${date}.pdf"`);
      return res.status(200).send(Buffer.from(pdfBytes));
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows to save" });
    }

    // Only rows with a company AND not resigned
    const filtered = rows.filter((r) => txt(r.company) && !looksResigned(r));

    let saved = 0;
    await client.query("BEGIN");
    for (const r of filtered) {
      const employeeid = String(r.employeeid || "").trim();
      if (!employeeid) continue;

      const name = txt(r.name);
      const intime = toPgTime(r.intime);
      const outtime = toPgTime(r.outtime);
      const workdur = toPgMinutes(r.workdur); // minutes
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
      saved++;
    }
    await client.query("COMMIT");

    // Build PDF from DB state for that date
    const { rows: persisted } = await client.query(
      'SELECT employeeid, name, company, intime, outtime, workdur, status, remarks, date \
       FROM "AttendanceDaily" WHERE date = $1 ORDER BY company, name',
      [date]
    );
    const pdfBytes = await makeAttendancePdf(persisted, `Attendance – ${date}`, { includeDate: false });
    if (isDebug) console.info("DEBUG: PDF generated", { length: pdfBytes?.length, date });

    // Push to Teams Files (SharePoint)
    let teams = { ok: false };
    try {
      const fileName = `attendance-${date}.pdf`;
      teams = await uploadPdfToTeams(pdfBytes, fileName, isDebug);
      if (process.env.TEAMS_WEBHOOK_URL && teams?.url) {
        await postTeamsWebhookCard(
          process.env.TEAMS_WEBHOOK_URL,
          `Attendance – ${date}`,
          `Uploaded attendance report for ${date}.`,
          teams.url
        );
      }
    } catch (e) {
      console.error("Teams upload failed:", e);
      teams = { ok: false, error: String(e?.message || e) };
    }

    return res.status(200).json({ ok: true, date, saved, teams });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("POST /api/attendance/save error:", e);
    return res.status(500).json({ error: "Save failed" });
  } finally {
    client.release();
  }
}

/* ===================== Helpers ===================== */
function normalizeReportDate(d) {
  const s = String((Array.isArray(d) ? d[0] : d) || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // YYYY-MM-DD
  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // DD/MM/YYYY or DD-MM-YYYY
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // DD.MM.YYYY
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
  if (typeof v === "number" && isFinite(v)) {
    const secs = Math.round(v * 24 * 60 * 60);
    const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
    const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const ss = (m[3] || "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function toPgMinutes(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
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
 // Columns (Date column added when exporting >1 date)
const cols = [
  { k: "employeeid", label: "EmpID",  w: 80,  align: "left"   },   // increased for proper spacing
  ...(includeDate ? [{ k: "date", label: "Date", w: 64, align: "center" }] : []),
  { k: "name",       label: "Name",   w: 200, align: "left"   },   // reduced to give EmpID more room
  { k: "intime",     label: "In",     w: 46,  align: "center" },   // compact for HH:MM
  { k: "outtime",    label: "Out",    w: 46,  align: "center" },   // compact for HH:MM
  { k: "hours",      label: "Hours",  w: 52,  align: "right"  },   // numeric, right-aligned
  { k: "status",     label: "Status", w: 56,  align: "left"   },   // modest width
  { k: "remarks",    label: "Remarks", w: 60, align: "left"  },    // kept compact to avoid long wraps
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
    const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
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

  // Normalize + group by company
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
  .sort((a,b) =>
    a.company.localeCompare(b.company) ||
    (a.date || "").localeCompare(b.date || "") ||
    a.name.localeCompare(b.name)
  );

  const groups = [];
  let g = null;
  for (const row of normalized) {
    if (!g || g.company !== row.company) { g = { company: row.company, items: [] }; groups.push(g); }
    g.items.push(row);
  }

  // Page primitives
  const pages = [];
  let page = pdf.addPage([pageSize.w, pageSize.h]); pages.push(page);

  const drawPageHeader = (p, pageIndex) => {
    const { height } = p.getSize();
    const x = pageMargins.left;
    let y = height - pageMargins.top + 10;

    p.drawText(String(titleText || "Attendance"), { x, y, size: titleSize, font: bold, color: textColor });
    y -= 18;

    // Clean, timezone-free meta
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

  // Centered company band + header (no time strings here)
  const drawCompanyBandAndHeader = (companyName, checkSpace = true) => {
    const name = (companyName || "—").trim();

    // Compute band height with padding
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

    // Centered company name only
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

    // zebra
    page.drawRectangle({
      x: pageMargins.left, y: cursorY - rowH,
      width: totalW, height: rowH,
      color: idxWithinCompany % 2 === 0 ? zebra1 : zebra2,
      borderColor: grid, borderWidth: 0.25,
    });

    // cells
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

  // Render (no grand totals)
  for (const group of groups) {
    drawCompanyBandAndHeader(group.company, true);
    group.items.forEach((row, i) => drawRow({ ...row, company: group.company }, i));
    cursorY -= 8;
  }

  const pageCount = pages.length;
  pages.forEach((p, i) => drawFooter(p, i, pageCount));

  return await pdf.save();
}

/* ===================== Microsoft Graph (Teams Files) ===================== */
async function uploadPdfToTeams(pdfBytes, filename, debug = false) {
  const token = await getGraphToken();
  if (debug) console.info("DEBUG: token acquired");

  const filesFolder = await graphFetch(
    `https://graph.microsoft.com/v1.0/teams/${process.env.MS_TEAM_ID}/channels/${process.env.MS_CHANNEL_ID}/filesFolder`,
    token
  );
  if (debug)
    console.info("DEBUG: filesFolder", {
      id: filesFolder?.id,
      driveId: filesFolder?.parentReference?.driveId,
    });

  const driveId = filesFolder?.parentReference?.driveId;
  const folderId = filesFolder?.id;
  if (!driveId || !folderId) throw new Error("Unable to resolve Teams channel Files folder");

  const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${encodeURIComponent(
    filename
  )}:/content`;
  if (debug) console.info("DEBUG: uploading", { filename, size: pdfBytes?.length });

  const r = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/pdf" },
    body: Buffer.from(pdfBytes),
  });

  if (!r.ok) {
    let body = {};
    try { body = await r.json(); } catch {}
    if (debug) console.error("GRAPH UPLOAD FAILED", { status: r.status, body });
    throw new Error(`Upload failed: ${r.status} ${JSON.stringify(body)}`);
  }

  const j = await r.json();
  return { ok: true, url: j?.webUrl, id: j?.id, name: j?.name };
}

async function getGraphToken() {
  const params = new URLSearchParams();
  params.append("client_id", process.env.MS_CLIENT_ID);
  params.append("client_secret", process.env.MS_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");
  params.append("scope", "https://graph.microsoft.com/.default");

  const url = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!r.ok) {
    let e = {};
    try { e = await r.json(); } catch {}
    throw new Error(`Token error: ${r.status} ${JSON.stringify(e)}`);
  }
  const j = await r.json();
  return j.access_token;
}

async function graphFetch(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    let e = {};
    try { e = await r.json(); } catch {}
    throw new Error(`Graph error: ${r.status} ${JSON.stringify(e)}`);
  }
  return r.json();
}

async function postTeamsWebhookCard(webhookUrl, title, text, link) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: title,
      themeColor: "0076D7",
      title,
      text,
      potentialAction: [
        { "@type": "OpenUri", name: "Open PDF", targets: [{ os: "default", uri: link }] },
      ],
    }),
  });
}
