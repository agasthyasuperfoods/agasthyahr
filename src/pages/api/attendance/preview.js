// /pages/api/attendance/preview.js
import formidable from "formidable";
import * as XLSX from "xlsx";
import fs from "fs";

export const config = { api: { bodyParser: false } };

/* ---------------- helpers ---------------- */

const pickOne = (v) => (Array.isArray(v) ? v[0] : v);

function firstField(fields, keys) {
  if (!fields) return null;
  const all = Object.keys(fields || {});
  for (const want of keys) {
    if (fields[want] != null) return pickOne(fields[want]);
    const k = all.find((x) => x.toLowerCase() === want.toLowerCase());
    if (k) return pickOne(fields[k]);
  }
  return null;
}

function normalizeReportDate(input) {
  const val = Array.isArray(input) ? input[0] : input;
  if (val instanceof Date && !isNaN(val)) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    const dd = String(val.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // YYYY-MM-DD

  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // DD/MM/YYYY or DD-MM-YYYY
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // DD.MM.YYYY
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;

  return null;
}

function extractDateFromFilename(name) {
  const n = String(name || "");
  let m = n.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = n.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = n.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return null;
}

function isFuture(yyyyMmDd) {
  const a = new Date(yyyyMmDd);
  if (Number.isNaN(a.getTime())) return true;
  const today = new Date();
  today.setHours(0,0,0,0);
  a.setHours(0,0,0,0);
  return a.getTime() > today.getTime();
}

function excelTimeToHMS(val) {
  if (typeof val !== "number" || !isFinite(val)) return null; // Excel fraction of a day
  const secs = Math.round(val * 24 * 60 * 60);
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}
function parseClockLike(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const ss = (m[3] || "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function toMinutesFromClockOrExcel(v) {
  if (typeof v === "number" && isFinite(v)) return Math.round(v * 24 * 60);
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/* header detection */
function findHeaderIndexes(row) {
  const idx = (preds) => row.findIndex((c) => preds.some((p) => p.test(c)));
  const codeIdx    = idx([/^e\.?\s*code$/i, /^emp(?:loyee)?\s*code$/i, /^emp\s*no/i, /^employee\s*id$/i, /^code$/i, /^id$/i]);
  const nameIdx    = idx([/^name$/i, /^employee\s*name$/i, /^emp(?:loyee)?\s*name$/i, /^emp\s*name$/i]);
  const inIdx      = idx([/^in\s*time$/i, /^intime$/i, /^in$/i, /^first\s*in$/i, /^in\s*scan$/i]);
  const outIdx     = idx([/^out\s*time$/i, /^outtime$/i, /^out$/i, /^last\s*out$/i, /^out\s*scan$/i]);
  const durIdx     = idx([/^tot\.?\s*dur\.?$/i, /^total\s*dur/i, /^total\s*hours?/i, /^work\s*dur/i, /^duration$/i, /^hrs?$/i]);
  const shiftIdx   = idx([/^shift$/i]);
  const statusIdx  = idx([/^status$/i, /^att(?:endance)?\s*status$/i, /^employee\s*status$/i, /^current\s*status$/i]);
  const remarksIdx = idx([/^remarks?$/i, /^note$/i, /^comments?$/i, /^reason(s)?$/i]);
  const companyIdx = idx([/^company$/i, /^department$/i, /^dept$/i, /^unit$/i, /^branch$/i]);
  return { codeIdx, nameIdx, inIdx, outIdx, durIdx, shiftIdx, statusIdx, remarksIdx, companyIdx };
}
const isHeaderRow = (row) => {
  const { codeIdx, inIdx } = findHeaderIndexes(row);
  return codeIdx !== -1 && inIdx !== -1;
};

/* detect section/department lines (incl. plain RESIGNED) */
const norm = (s) => String(s || "").trim().toLowerCase();
function detectDepartmentRow(row) {
  for (const cell of row) {
    const v = norm(cell);
    if (v === "resigned" || v.startsWith("resigned ")) return "RESIGNED";
  }
  const joined = row.map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
  const m1 = joined.match(/\b(dept|department|unit|branch)\s*[:\-]?\s*([A-Za-z0-9 \-\/]+)$/i);
  if (m1) return m1[2].trim();
  return null;
}

/* file parser */
function parseForm(req, options = {}) {
  // sensible defaults
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10 MB
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

/* ---------------- rules ---------------- */

// note: keep canonical strings in lowercase for allowlist checks
const ALLOWED_COMPANIES = new Set([
  "sonf", "asf", "anm", "agb", "avion", "dwaraka contract staff", "asf-factory",
  "sri chakra milk", "nature's wellness", "scm", "nw"
]);

/* ---------------- company mapping ---------------- */

/*
  Normalize and map many variants into canonical company strings.
  Ensures SCM / SRI CHAKRA MILK and NATURE'S WELLNESS are recognized.
*/
const mapCompany = (raw) => {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  // uppercase and remove weird punctuation but keep spaces and apostrophes
  const u = s.toUpperCase().replace(/[^A-Z0-9\s']/g, " ").replace(/\s+/g, " ").trim();

  // SRI CHAKRA MILK variants
  if (/\bSCM\b/.test(u) || /\bS\s*C\s*M\b/.test(u) || /\bSRI\b.*\bCHAKRA\b/.test(u) || /\bCHAKRA\b/.test(u)) {
    return "SRI CHAKRA MILK";
  }

  // NATURE'S WELLNESS / NW variants
  if (/\bNATURE\b/.test(u) || /\bNATURE'S\b/.test(u) || /\bNATURES\b/.test(u) || /\bNW\b/.test(u) || /\bNAT\b/.test(u)) {
    return "NATURE'S WELLNESS";
  }

  // ASF / ASF-FACTORY
  if (/\bFACTORY\b/.test(u) || /\bASF-?FACTORY\b/.test(u)) return "ASF-FACTORY";
  if (/\bASF\b/.test(u) && !/\bFACTORY\b/.test(u)) return "ASF";

  if (/\bAGB\b/.test(u)) return "AGB";
  if (/\bANM\b/.test(u)) return "ANM";
  if (/\bAVION\b/.test(u)) return "AVION";
  if (/DWARAKA/i.test(u) || /^DR/i.test(String(raw).trim())) return "Dwaraka Contract Staff";

  // fallback: return trimmed original (so we still capture odd but meaningful names)
  return s;
};

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  let filepath = null;
  try {
    const { fields, files } = await parseForm(req, { maxFileSize: 12 * 1024 * 1024 });

    // date
    const rawDate = firstField(fields, ["report_date", "reportDate", "date", "day"]) ?? null;
    const upFile = pickOne(files?.file);
    const originalName = upFile?.originalFilename || upFile?.newFilename || "";
    filepath = upFile?.filepath || upFile?.path;
    const date =
      normalizeReportDate(rawDate) ||
      normalizeReportDate(extractDateFromFilename(originalName));
    if (!date) {
      return res.status(400).json({
        error: "Invalid report_date (use YYYY-MM-DD)",
        hint: "Send 'report_date' or include DD.MM.YYYY / DD-MM-YYYY in filename",
        received_keys: Object.keys(fields || {}),
        filename: originalName || undefined,
      });
    }
    if (isFuture(date)) return res.status(400).json({ error: "Future date not allowed" });

    if (!filepath) return res.status(400).json({ error: "No file uploaded" });

    // Read workbook (defensive)
    let wb;
    try {
      wb = XLSX.read(fs.readFileSync(filepath), { cellDates: false, cellNF: false, cellText: false });
    } catch (e) {
      console.error("Failed to parse workbook:", e);
      return res.status(400).json({ error: "Unable to parse spreadsheet. Ensure file is a valid .xlsx/.xls/.csv" });
    }

    const parsedRows = [];
    const companies = new Set();

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true, defval: "" });
      if (!rows?.length) continue;

      // normalized strings for header detection (trimmed)
      const normRows = rows.map(r => (Array.isArray(r) ? r.map(x => String(x ?? "").trim()) : []));

      let currentDepartment = null;
      let resignedMode = false;

      for (let i = 0; i < normRows.length; i++) {
        const row = normRows[i];

        // Section/Department boundary?
        const deptHit = detectDepartmentRow(row);
        if (deptHit != null) {
          currentDepartment = deptHit;
          resignedMode = /\bresigned\b/i.test(deptHit);
          continue;
        }

        // Header row?
        if (!isHeaderRow(row)) continue;

        const { codeIdx, nameIdx, inIdx, outIdx, durIdx, shiftIdx, statusIdx, remarksIdx, companyIdx } =
          findHeaderIndexes(row);

        // Consume data rows until next header or department line
        let j = i + 1;
        for (; j < normRows.length; j++) {
          const rawNext = rows[j];
          const next = normRows[j];
          if (!rawNext) continue;
          if (!Array.isArray(next) || next.length === 0) continue;

          // boundary: next header or next dept
          if (isHeaderRow(next) || detectDepartmentRow(next) != null) break;

          // inside RESIGNED section -> skip whole row
          if (resignedMode) continue;

          const employeeid = String(next[codeIdx] || "").replace(/\s+/g, "");
          if (!employeeid) continue;

          const inCell  = rawNext[inIdx];
          const outCell = outIdx !== -1 ? rawNext[outIdx] : null;
          const durCell = durIdx !== -1 ? rawNext[durIdx] : null;

          const intime  = (typeof inCell  === "number" ? excelTimeToHMS(inCell)  : parseClockLike(inCell))  || null;
          const outtime = (typeof outCell === "number" ? excelTimeToHMS(outCell) : parseClockLike(outCell)) || null;
          const workdur = toMinutesFromClockOrExcel(durCell);

          if (!intime && workdur == null && !outtime) continue;

          // --- START: normalized company detection & allowlist check ---
          let companyFromCol = companyIdx !== -1 ? (next[companyIdx] || "") : "";
          let rawCompany = companyFromCol || currentDepartment || "";

          // DR* -> Dwaraka Contract Staff (explicit override)
          if (/^DR/i.test(employeeid)) {
            rawCompany = "Dwaraka Contract Staff";
          }

          // map to canonical company (SCM -> SRI CHAKRA MILK, NW -> NATURE'S WELLNESS, etc.)
          let normalizedCompany = mapCompany(rawCompany);

          // If still empty, try department-like/extra columns from the original raw row
          if (!normalizedCompany) {
            const extra = String(rawNext?.dept ?? rawNext?.department ?? rawNext?.group ?? rawNext?.division ?? rawNext?.BU ?? rawNext?.['Business Unit'] ?? "").trim();
            if (extra) normalizedCompany = mapCompany(extra);
          }

          // final skip if nothing recognized
          if (!normalizedCompany) {
            // temp debug (uncomment to log skipped rows)
            // console.log('SKIP: no company for', employeeid, 'rawCompany=', rawCompany, 'extra=', rawNext);
            continue;
          }

          // final allowlist check (use lowercase key)
          const allowedKey = String(normalizedCompany || "").trim().toLowerCase();
          if (!ALLOWED_COMPANIES.has(allowedKey)) {
            // defensive: allow a few common canonical names even if missing from the set
            if (!["sri chakra milk", "nature's wellness", "scm", "nw", "dwaraka contract staff"].includes(allowedKey)) {
              // console.log('SKIP: not allowed company for', employeeid, 'company=', normalizedCompany);
              continue;
            }
          }

          // use canonical name going forward
          const company = normalizedCompany;
          // --- END: normalized company detection & allowlist check ---

          // AVION: only GS shifts
          const shiftVal = shiftIdx !== -1 ? next[shiftIdx] : "";
          if (norm(company) === "avion" && !/gs/i.test(String(shiftVal || ""))) continue;

          companies.add(company);

          parsedRows.push({
            employeeid,
            name: nameIdx !== -1 ? (next[nameIdx] || null) : null,
            shift:   shiftIdx   !== -1 ? (next[shiftIdx]   || null) : null, // keep for preview/UI only
            intime,
            outtime,
            workdur: workdur ?? null,
            status:  statusIdx  !== -1 ? (next[statusIdx]  || null) : null,
            remarks: remarksIdx !== -1 ? (next[remarksIdx] || null) : null,
            company,
            date,
          });
        }

        // continue after the block we consumed
        i = j - 1;
      }
    }

    if (parsedRows.length > 20000) {
      return res.status(400).json({ error: "Too many rows in one file. Split and retry." });
    }

    return res.status(200).json({
      ok: true,
      date,
      rows: parsedRows,
      companies: Array.from(companies),
      count: parsedRows.length,
    });
  } catch (e) {
    console.error("POST /api/attendance/preview failed:", e);
    return res.status(500).json({ error: "Preview failed" });
  } finally {
    // cleanup uploaded temp file
    if (filepath) {
      fs.unlink(filepath, (err) => {
        if (err) console.warn("Failed to unlink upload file:", filepath, err?.message || err);
      });
    }
  }
}
