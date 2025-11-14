import { query } from "@/lib/db";

/**
 * Day-wise attendance model:
 *   public.talakondapally_attendance (
 *     "EmployeeId" INTEGER REFERENCES public.talakondapallyemployees("Employeeid") ON DELETE CASCADE,
 *     name         TEXT,   -- snapshot
 *     date         DATE    NOT NULL,
 *     status       TEXT,   -- 'Present' | 'Absent' | 'Half Day' | null
 *     PRIMARY KEY ("EmployeeId", "date")
 *   )
 *
 * Lock rule (for a given date):
 *   locked = (count(current employees) == count(rows for date with non-null status))
 */

async function ensureAttendanceTable() {
  // 1) Create table if missing (composite PK).
  await query(`
    CREATE TABLE IF NOT EXISTS public.talakondapally_attendance (
      "EmployeeId" INTEGER NOT NULL,
      name         TEXT,
      date         DATE    NOT NULL,
      status       TEXT,
      CONSTRAINT talakonda_attendance_pk PRIMARY KEY ("EmployeeId", "date"),
      CONSTRAINT talakonda_attendance_fk_emp
        FOREIGN KEY ("EmployeeId")
        REFERENCES public.talakondapallyemployees("Employeeid")
        ON DELETE CASCADE
    )
  `);

  // 2) Defensive remediation for legacy layouts (idempotent).
  await query(`
    DO $$
    BEGIN
      -- Ensure date is NOT NULL
      BEGIN
        ALTER TABLE public.talakondapally_attendance
          ALTER COLUMN date SET NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      -- Drop any old constraints if present
      BEGIN
        ALTER TABLE public.talakondapally_attendance DROP CONSTRAINT IF EXISTS talakonda_pkey;
        ALTER TABLE public.talakondapally_attendance DROP CONSTRAINT IF EXISTS talakonda_attendance_EmployeeId_key;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      -- Re-add composite PK if missing
      IF NOT EXISTS (
        SELECT 1
        FROM   pg_index i
        JOIN   pg_class c ON c.oid = i.indrelid
        WHERE  c.relname = 'talakondapally_attendance'
        AND    i.indisprimary = TRUE
      ) THEN
        BEGIN
          ALTER TABLE public.talakondapally_attendance
            ADD CONSTRAINT talakonda_attendance_pk PRIMARY KEY ("EmployeeId", "date");
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END$$;
  `);

  // 3) Helpful index for reads by date
  await query(`
    CREATE INDEX IF NOT EXISTS idx_talakonda_attendance_date
      ON public.talakondapally_attendance (date);
  `);
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // GET /api/talakondapally/attendance?date=YYYY-MM-DD
      const date = (req.query?.date || "").toString().trim();
      if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

      await ensureAttendanceTable();

      // Full roster with status for the requested date
     // IN YOUR HANDLER, inside the GET /api/talakondapally/attendance block:
// CHANGE THIS QUERY:
const r = await query(
  `
  SELECT
    e."Employeeid"    AS employee_id,
    e.employee_name   AS employee_name,
    e.employee_number AS number,
    e.location        AS location,
    e.designation     AS designation,   -- <-- ADD THIS LINE!
    t.status          AS status,
    t.date            AS saved_date
  FROM public.talakondapallyemployees e
  LEFT JOIN public.talakondapally_attendance t
         ON t."EmployeeId" = e."Employeeid" AND t.date = $1
  ORDER BY e."Employeeid" ASC
  `,
  [date]
);

      // Compute lock: all employees have a non-null status on that date
      const totals = await query(
        `
        WITH total_employees AS (
          SELECT COUNT(*)::int AS total
          FROM public.talakondapallyemployees
        ),
        dated_rows AS (
          SELECT
            COUNT(*)::int      AS cnt_all,
            COUNT(status)::int AS cnt_with_status
          FROM public.talakondapally_attendance
          WHERE date = $1
        )
        SELECT t.total, d.cnt_all, d.cnt_with_status
        FROM total_employees t
        CROSS JOIN dated_rows d
        `,
        [date]
      );

      const { total, cnt_all, cnt_with_status } =
        totals.rows[0] || { total: 0, cnt_all: 0, cnt_with_status: 0 };
      const locked = total > 0 && cnt_with_status === total;

      return res.status(200).json({
        data: r.rows,
        date,
        locked,
        stats: { total, cnt_all, cnt_with_status },
      });
    }

    if (req.method === "POST") {
      // POST /api/talakondapally/attendance
      // Body: { date?: string, rows: Array<{ employee_id: number, status: string|null }> }
      let { date, rows } = req.body || {};
      date = (date || todayIso()).toString().trim();
      if (!Array.isArray(rows)) return res.status(400).json({ error: "rows must be an array" });

      await ensureAttendanceTable();

      const saved = [];
      for (const r of rows) {
        const employee_id = Number(r.employee_id);
        if (!employee_id || !Number.isInteger(employee_id)) continue;
        const status = r.status ?? null;

        // Day-wise upsert keyed by (EmployeeId, date)
        await query(
          `
          INSERT INTO public.talakondapally_attendance ("EmployeeId", name, date, status)
          SELECT e."Employeeid", e.employee_name, $1, $3
          FROM public.talakondapallyemployees e
          WHERE e."Employeeid" = $2
          ON CONFLICT ("EmployeeId", "date")
          DO UPDATE SET name   = EXCLUDED.name,
                        status = EXCLUDED.status
          `,
          [date, employee_id, status]
        );

        saved.push({ EmployeeId: employee_id, date, status });
      }

      return res.status(200).json({ date, saved: saved.length, rows: saved });
    }

    if (req.method === "PUT") {
      // PUT /api/talakondapally/attendance
      // Body: { employee_id: number, date?: string, status?: string|null }
      const employee_id = Number((req.body?.employee_id ?? "").toString());
      const date = (req.body?.date || todayIso()).toString().trim();
      const status = req.body?.status ?? null;
      if (!employee_id || !Number.isInteger(employee_id)) {
        return res.status(400).json({ error: "Valid employee_id is required" });
      }

      await ensureAttendanceTable();

      await query(
        `
        INSERT INTO public.talakondapally_attendance ("EmployeeId", name, date, status)
        SELECT e."Employeeid", e.employee_name, $1, $3
        FROM public.talakondapallyemployees e
        WHERE e."Employeeid" = $2
        ON CONFLICT ("EmployeeId", "date")
        DO UPDATE SET name   = EXCLUDED.name,
                      status = EXCLUDED.status
        `,
        [date, employee_id, status]
      );

      return res.status(200).json({ ok: true, employee_id, date, status });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("talakondapally/attendance error:", e);
    return res.status(500).json({ error: e?.detail || e?.message || "Internal server error" });
  }
}
