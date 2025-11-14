// src/pages/api/attendance/anm/status.js
import { Pool } from "pg";

let pool;
if (!global.__PG_POOL__) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  global.__PG_POOL__ = pool;
} else {
  pool = global.__PG_POOL__;
}

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// candidate table names (extend only if you add other sites)
const CANDIDATES = {
  tandur: [
    "public.tandur_attendance",
    "public.tandurattendance",
    "public.tandur_attendance_tbl",
    "public.tandur_attendance_table",
  ],
  talakondapally: [
    // exact table name you reported
    "public.talakondapally_attendance",
    // keep a few reasonable fallbacks
    "public.talakondapallyattendance",
    "public.talakondapally_attendance_tbl",
    "public.talakondapally_attendance_table",
  ],
};

// column name candidates for the "review" / submitted flag
const REVIEW_COLS = ["Review", "review", "status", "submitted", "review_status", "reviewflag"];

// candidate date columns
const DATE_COLS = ["date", "attendance_date", "attendanceDate", "att_date", "attendanceDate"];

/**
 * columnsExist: consult information_schema to find which candidate column names are present
 * returns array of actual column_name values or empty array
 */
async function columnsExist(client, tableName, candidates) {
  const [schema, table] = tableName.split(".");
  if (!schema || !table) return [];

  // lower candidates for case-insensitive comparison
  const lowered = candidates.map((c) => String(c).toLowerCase());

  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
      AND lower(column_name) = ANY($3::text[])
  `;
  const r = await client.query(q, [schema, table, lowered]);
  return r.rows.map((row) => row.column_name); // actual column names (preserve DB casing)
}

/**
 * tryQuery: for a table, find real date/review columns and return first matching non-empty review value
 * returns: { found: boolean, table: string|null, date_col: string|null, review_col: string|null, value: string|null }
 */
async function tryQuery(client, table, dateValue) {
  // combine candidate lists for discovery
  const needed = [...new Set([...DATE_COLS, ...REVIEW_COLS])];

  // discover columns for this table
  let existingCols;
  try {
    existingCols = await columnsExist(client, table, needed);
  } catch (err) {
    console.debug(`[anm/status] information_schema lookup failed for ${table}: ${err?.message || err}`);
    return { found: false };
  }

  if (!existingCols || existingCols.length === 0) return { found: false };

  // prepare lower-cased map for case-insensitive checks
  const existingLower = existingCols.map((c) => c.toLowerCase());

  // pick the first matching date column (prefer exact candidates then snake-cased fallback)
  let pickedDate = null;
  for (const dc of DATE_COLS) {
    const lowerDc = String(dc).toLowerCase();
    if (existingLower.includes(lowerDc)) {
      pickedDate = existingCols[existingLower.indexOf(lowerDc)];
      break;
    }
    // camelCase -> snake_case fallback: e.g., attendanceDate => attendance_date
    const snake = String(dc).replace(/([A-Z])/g, "_$1").toLowerCase();
    if (existingLower.includes(snake)) {
      pickedDate = existingCols[existingLower.indexOf(snake)];
      break;
    }
  }

  // pick the first matching review column
  let pickedReview = null;
  for (const rc of REVIEW_COLS) {
    const lowerRc = String(rc).toLowerCase();
    if (existingLower.includes(lowerRc)) {
      pickedReview = existingCols[existingLower.indexOf(lowerRc)];
      break;
    }
    const snake = String(rc).replace(/([A-Z])/g, "_$1").toLowerCase();
    if (existingLower.includes(snake)) {
      pickedReview = existingCols[existingLower.indexOf(snake)];
      break;
    }
  }

  if (!pickedDate || !pickedReview) {
    return { found: false, table, date_col: pickedDate || null, review_col: pickedReview || null };
  }

  // Safe to query: use parameterized query and only the detected column names
  // Quote identifiers with double quotes in case of mixed-case or special names
  const safeDateCol = `"${pickedDate.replace(/"/g, '""')}"`;
  const safeReviewCol = `"${pickedReview.replace(/"/g, '""')}"`;

  const q = `
    SELECT ${safeReviewCol} as rv
    FROM ${table}
    WHERE (${safeDateCol}::date = $1::date)
      AND ${safeReviewCol} IS NOT NULL
    LIMIT 1
  `;
  try {
    const r = await client.query(q, [dateValue]);
    if (Array.isArray(r.rows) && r.rows.length > 0) {
      const val = r.rows[0].rv;
      if (val != null && String(val).trim() !== "") {
        return { found: true, table, date_col: pickedDate, review_col: pickedReview, value: String(val) };
      }
    }
  } catch (err) {
    console.debug(`[anm/status] safe query failed for ${table} (${pickedDate},${pickedReview}): ${err?.message || err}`);
    return { found: false };
  }

  return { found: false };
}

async function fetchReviewForSite(client, siteCandidates, date) {
  for (const table of siteCandidates) {
    const r = await tryQuery(client, table, date);
    if (r.found) return r;
  }
  return { found: false };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { date } = req.query;
    if (!date || !isValidDate(date)) {
      return res.status(400).json({ error: "Missing or invalid `date` query parameter. Use YYYY-MM-DD." });
    }

    const client = await pool.connect();
    try {
      const [tandurRes, talakRes] = await Promise.all([
        fetchReviewForSite(client, CANDIDATES.tandur, date),
        fetchReviewForSite(client, CANDIDATES.talakondapally, date),
      ]);

      const normalize = (r) => {
        if (!r || !r.found) return { value: null, matched: null };
        return {
          value: String(r.value).trim() || null,
          matched: { table: r.table, date_col: r.date_col, review_col: r.review_col },
        };
      };

      const t = normalize(tandurRes);
      const ta = normalize(talakRes);

      const isSubmitted = (s) => (s == null ? false : String(s).trim().toLowerCase() === "submitted");

      return res.status(200).json({
        tandur: t.value,
        talakondapally: ta.value,
        sites: { tandur: t.value, talakondapally: ta.value },
        debug: {
          tandur_matched: t.matched,
          talakondapally_matched: ta.matched,
          tandur_submitted: isSubmitted(t.value),
          talakondapally_submitted: isSubmitted(ta.value),
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("anm/status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
