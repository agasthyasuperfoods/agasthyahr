import { useEffect, useMemo, useState } from "react";

/** ---------- small utils ---------- */
function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function toHumanDate(yyyyMmDd) {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(yyyyMmDd || "");
  if (!m) return "-";
  const [y, mth, d] = yyyyMmDd.split("-");
  return `${d}/${mth}/${y}`;
}
function minutesToHHMM(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function parseTime(t) {
  if (!t) return "—";
  const s = String(t).trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(s) ? s.slice(0, 5) : s;
}
function safe(val) {
  const s = String(val ?? "").trim();
  return s === "" ? "—" : s;
}
function normId(s) {
  return String(s ?? "").trim().toUpperCase();
}

// Company alias mapping (display-only)
function mapCompany(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const norm = s.toUpperCase();
  if (norm === "AGB") return "Agasthya Global Brands";
  if (norm === "ANM") return "Agasthya Nutro Mlik";
  if (norm === "ASF") return "AGASTHYA SUPERFOODS";
  if (norm === "ASF-FACTORY" || norm === "ASF - FACTORY") return "Agasthya Superfoods Factory";
  return s; // fall through: show as-is for other companies
}

/** ---------- main component ---------- */
export default function CompanyAttendanceView({ initialDate }) {
  const [date, setDate] = useState(initialDate || todayIso());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | Present | Absent | Leave | WFH | OD | NoOut
  const dense = true; // always dense

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setRows([]);
        const res = await fetch(`/api/attendance/daily?date=${encodeURIComponent(date)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load attendance");
        if (!abort) setRows(Array.isArray(j?.rows) ? j.rows : []);
      } catch (e) {
        if (!abort) { setErr(e.message || "Failed to load attendance"); setRows([]); }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [date]);

  /** derived, filtered rows */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sFilter = statusFilter;
    return (rows || []).filter(r => {
      const hay = `${r.employeeid ?? ""} ${r.name ?? ""} ${r.shift ?? ""} ${r.status ?? ""} ${r.remarks ?? ""} ${r.company ?? ""}`.toLowerCase();
      const passQ = q ? hay.includes(q) : true;

      let passStatus = true;
      const st = String(r.status || "").toLowerCase();

      if (sFilter === "Present") passStatus = st.includes("present");
      else if (sFilter === "Absent") passStatus = st.includes("absent") || st.includes("leave");
      else if (sFilter === "Leave") passStatus = st.includes("leave");
      else if (sFilter === "WFH") passStatus = st.includes("wfh");
      else if (sFilter === "OD") passStatus = st.includes("od");
      else if (sFilter === "NoOut") passStatus = /no\s*outpunch/i.test(String(r.remarks || "")) || (st.includes("present") && !r.outtime);

      return passQ && passStatus;
    });
  }, [rows, search, statusFilter]);

  /** group by mapped company */
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = mapCompany(r.company) || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    // sort each group by employeeid (numeric-aware) then name
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const ad = Number(String(a.employeeid || "").replace(/\D/g, "")) || 0;
        const bd = Number(String(b.employeeid || "").replace(/\D/g, "")) || 0;
        if (ad !== bd) return ad - bd;
        return normId(a.name).localeCompare(normId(b.name));
      });
    }
    // sort groups alphabetically (keep Unassigned last)
    const ordered = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Unassigned") return 1;
      if (b[0] === "Unassigned") return -1;
      return a[0].localeCompare(b[0]);
    });
    return ordered;
  }, [filtered]);

  /** KPIs — Total = Present + Absent (Leave folded into Absent) */
  const kpis = useMemo(() => {
    const present = filtered.filter(r => String(r.status || "").toLowerCase().includes("present")).length;
    const absent  = filtered.filter(r => {
      const st = String(r.status || "").toLowerCase();
      return st.includes("absent") || st.includes("leave");
    }).length;
    const total = present + absent;
    return { total, present, absent };
  }, [filtered]);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Attendance Daily • {toHumanDate(date)}</h3>
          <p className="text-xs text-gray-500">Segmented by Company • Source: AttendanceDaily</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Pick date"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, status, remarks…"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-56"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Status filter"
          >
            <option>ALL</option>
            <option>Present</option>
            <option>Absent</option>
            <option>Leave</option>
            <option>WFH</option>
            <option>OD</option>
            <option>NoOut</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total Employees" value={kpis.total} />
        <Kpi label="Present" value={kpis.present} />
        <Kpi label="Absent" value={kpis.absent} />
      </div>

      {/* states */}
      {loading ? (
        <div className="mt-6 text-sm text-gray-600">Loading attendance…</div>
      ) : err ? (
        <div className="mt-6 text-sm text-red-600">{err}</div>
      ) : groups.length === 0 ? (
        <div className="mt-6 text-sm text-gray-600">No records for this date.</div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(([company, items]) => (
            <CompanyCard key={company} company={company} items={items} />
          ))}
        </div>
      )}
    </section>
  );
}

/** ---------- subcomponents ---------- */
function Kpi({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function CompanyCard({ company, items }) {
  // per-company stats
  const present = items.filter(r => String(r.status || "").toLowerCase().includes("present")).length;
  const absentIncLeave = items.filter(r => {
    const st = String(r.status || "").toLowerCase();
    return st.includes("absent") || st.includes("leave");
  }).length;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">{company}</div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5">Present: {present}</span>
          <span className="rounded-full bg-red-600 text-white px-2.5 py-0.5">Absent: {absentIncLeave}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-xs">
          <thead className="bg-white sticky top-0">
            <tr className="text-left text-gray-600">
              <Th>Employee ID</Th>
              <Th>Name</Th>
              <Th>Shift</Th>
              <Th>In</Th>
              <Th>Out</Th>
              <Th>Work (h:mm)</Th>
              <Th>Status</Th>
              <Th className="min-w-[320px]">Remarks</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={`${r.employeeid}-${i}`} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                <Td>{safe(r.employeeid)}</Td>
                <Td>{safe(r.name)}</Td>
                <Td><Badge>{safe(r.shift)}</Badge></Td>
                <Td>{parseTime(r.intime)}</Td>
                <Td>{parseTime(r.outtime)}</Td>
                <Td>{minutesToHHMM(r.workdur)}</Td>
                <Td>
                  <StatusPill status={r.status} />
                </Td>
                <Td>{safe(r.remarks)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 border-b ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 border-t align-top ${className}`}>{children}</td>;
}
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-900 px-2.5 py-0.5 border border-gray-300">
      {children || "—"}
    </span>
  );
}
function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  let tone = "bg-gray-600 text-white";
  let label = status || "—";
  if (s.includes("present")) {
    tone = "bg-emerald-600 text-white";
  } else if (s.includes("absent") || s.includes("leave")) {
    tone = "bg-red-600 text-white";
    label = "Absent";
  } else if (s.includes("wfh")) {
    tone = "bg-indigo-600 text-white";
  } else if (s.includes("od")) {
    tone = "bg-blue-600 text-white";
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${tone}`}>{label}</span>;
}
