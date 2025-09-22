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

// candidate table names (extend with any other names you suspect)
const CANDIDATES = {
  tandur: [
    "public.tandur_attendance",
    "public.tandurattendance",
    "public.tandur_attendance_tbl",
    "public.tandur_attendance_table",
    // add any other variants you might have
  ],
  talakondapally: [
    "public.talakondapally_attendance",
    "public.talakonda_attendance",
    "public.talakondapallyattendance",
    "public.talakondapally_attendance_tbl",
    // add other variants
  ],
};

// column name candidates for the "review" / submitted flag
const REVIEW_COLS = ["review", "status", "submitted", "review_status", "reviewflag"];

// candidate date columns
const DATE_COLS = ["date", "attendance_date", "attendanceDate", "att_date"];

/**
 * tryQuery: for a table, try every (dateCol, reviewCol) pair and return first non-empty result
 * returns: { found: boolean, table: string|null, date_col: string|null, review_col: string|null, value: string|null }
 */
async function tryQuery(client, table, dateValue) {
  for (const dateCol of DATE_COLS) {
    for (const reviewCol of REVIEW_COLS) {
      // parameterize date; cast both sides to date to be tolerant of timestamp columns
      const q = `
        SELECT ${reviewCol} as rv
        FROM ${table}
        WHERE (${dateCol}::date = $1::date)
          AND ${reviewCol} IS NOT NULL
        LIMIT 1
      `;
      try {
        const r = await client.query(q, [dateValue]);
        if (Array.isArray(r.rows) && r.rows.length > 0) {
          const val = r.rows[0].rv;
          if (val != null && String(val).trim() !== "") {
            return { found: true, table, date_col: dateCol, review_col: reviewCol, value: String(val) };
          }
        }
      } catch (err) {
        // table or column may not exist — log and continue
        console.debug(`[anm/status] candidate ${table} (${dateCol},${reviewCol}) failed: ${err?.message || err}`);
        // continue to next combo
      }
    }
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
      // run both in parallel
      const [tandurRes, talakRes] = await Promise.all([
        fetchReviewForSite(client, CANDIDATES.tandur, date),
        fetchReviewForSite(client, CANDIDATES.talakondapally, date),
      ]);

      const normalize = (r) => {
        if (!r || !r.found) return { value: null, matched: null };
        return { value: String(r.value).trim() || null, matched: { table: r.table, date_col: r.date_col, review_col: r.review_col } };
      };

      const t = normalize(tandurRes);
      const ta = normalize(talakRes);

      // also compute boolean submitted flags (exact "submitted" string)
      const isSubmitted = (s) => (s == null ? false : String(s).trim().toLowerCase() === "submitted");

      return res.status(200).json({
        tandur: t.value,
        talakondapally: ta.value,
        sites: {
          tandur: t.value,
          talakondapally: ta.value,
        },
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
