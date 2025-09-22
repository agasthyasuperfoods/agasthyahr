// /pages/employees.js (full updated code)
import AppHeader from "@/components/AppHeader";
import ProfileModal from "@/components/ProfileModal";
import Swal from "sweetalert2";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

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
// Extended to include Tandur and Talakondapally farm names
function mapCompany(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const norm = s.toUpperCase();
  if (norm === "AGB") return "Agasthya Global Brands";
  if (norm === "ANM") return "Agasthya Nutro Mlik";
  if (norm === "ASF") return "AGASTHYA SUPERFOODS";
  if (norm === "ASF-FACTORY" || norm === "ASF - FACTORY") return "Agasthya Superfoods Factory";
  // ANM Farm special mappings:
  if (norm === "TANDUR" || norm === "TANDUR_ATTENDANCE" || norm === "TANDUR_FARM") return "Tandur Farm";
  if (norm === "TALAKONDAPALLY" || norm === "TALAKONDAPALLY_ATTENDANCE" || norm === "TALAKONDA" || norm === "TALAKONDA_ATTENDANCE") return "Talakondapally Farm";
  return s; // fall-through
}
// Read stored identity (employee id / email) for profile fetch
function getAuthIdentity() {
  if (typeof window === "undefined") return { id: null, email: null };
  const ls = window.localStorage;
  return {
    id: ls.getItem("hr_employeeid") || null,
    email: ls.getItem("hr_email") || null,
  };
}

/** ---------- main component ---------- */
export default function Employees({ initialDate }) {
  // ----- Header wiring (adds the props AppHeader needs) -----
  const router = useRouter();
  const [hrName, setHrName] = useState("HR");

  // Profile modal state
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        const j = await res.json().catch(() => ({}));
        if (!cancelled) setHrName(j?.name || j?.hrName || "HR");
      } catch {
        if (!cancelled) setHrName("HR");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openProfile = async () => {
    try {
      const { id, email } = getAuthIdentity();
      let me = null;

      // Try by employee id
      if (id) {
        const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`);
        const j = await r.json().catch(() => ({}));
        if (r.ok && Array.isArray(j?.data) && j.data.length) me = j.data[0];
      }

      // Fallback by email
      if (!me && email) {
        const r = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
        const j = await r.json().catch(() => ({}));
        if (r.ok && Array.isArray(j?.data) && j.data.length) me = j.data[0];
      }

      // Last resort: /api/me if it returns your user object
      if (!me) {
        const r = await fetch("/api/me");
        const j = await r.json().catch(() => ({}));
        if (r.ok && j && (j.employeeid || j.email)) me = j;
      }

      if (!me) throw new Error("Your profile could not be found");

      setProfileUser(me);
      setShowProfile(true);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Profile", text: e.message || "Unable to load profile" });
    }
  };

  const logout = async () => {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    try {
      localStorage.removeItem("token");
      // Clear any HR-specific flags if you use them
      localStorage.removeItem("hr_auth");
      localStorage.removeItem("hr_role");
      localStorage.removeItem("hr_employeeid");
      localStorage.removeItem("hr_email");
    } catch {}
    router.replace("/Hlogin");
  };

  // ----- Page state -----
  const [date, setDate] = useState(initialDate || todayIso());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | Present | Absent | Leave | WFH | OD | NoOut
  const dense = true; // enforced dense mode

  // refresh key to re-fetch after edits
  const [refreshKey, setRefreshKey] = useState(0);

  // edit modal state
  const [editRow, setEditRow] = useState(null);

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
        if (!abort) {
          setErr(e.message || "Failed to load attendance");
          setRows([]);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [date, refreshKey]);

  /** derived, filtered rows */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sFilter = statusFilter;
    return (rows || []).filter((r) => {
      const hay = `${r.employeeid ?? ""} ${r.name ?? ""} ${r.shift ?? ""} ${r.status ?? ""} ${r.remarks ?? ""} ${r.company ?? ""}`.toLowerCase();
      const passQ = q ? hay.includes(q) : true;

      let passStatus = true;
      const st = String(r.status || "").toLowerCase();

      if (sFilter === "Present") passStatus = st.includes("present");
      else if (sFilter === "Absent") passStatus = st.includes("absent") || st.includes("leave");
      else if (sFilter === "Leave") passStatus = st.includes("leave");
      else if (sFilter === "WFH") passStatus = st.includes("wfh");
      else if (sFilter === "OD") passStatus = st.includes("od");
      else if (sFilter === "NoOut")
        passStatus = /no\s*outpunch/i.test(String(r.remarks || "")) || (st.includes("present") && !r.outtime);

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
    const present = filtered.filter((r) => String(r.status || "").toLowerCase().includes("present")).length;
    const absent = filtered.filter((r) => {
      const st = String(r.status || "").toLowerCase();
      return st.includes("absent") || st.includes("leave");
    }).length;
    const total = present + absent;
    return { total, present, absent };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        currentPath={router.pathname}
        hrName={hrName}
        onProfileClick={openProfile}
        onLogout={logout}
      />

      <main className=" mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Top Card: Controls + KPIs */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 md:gap-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Attendance Daily • {toHumanDate(date)}
              </h3>
              <p className="text-xs text-gray-500">
                Segmented by Company • Source: AttendanceDaily
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                title="Pick date"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, status, remarks…"
                className="h-10 w-64 rounded-lg border border-gray-300 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
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
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <Kpi label="Total Employees" value={kpis.total} />
            <Kpi label="Present" value={kpis.present} />
            <Kpi label="Absent" value={kpis.absent} />
          </div>
        </section>

        {/* Data State */}
        <section className="mt-6 md:mt-8">
          {loading ? (
            <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              Loading attendance…
            </div>
          ) : err ? (
            <div className="text-sm text-red-600 bg-white border border-red-200 rounded-xl p-6 shadow-sm">
              {err}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              No records for this date.
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {groups.map(([company, items]) => (
                <CompanyCard
                  key={company}
                  company={company}
                  items={items}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {editRow ? (
        <EditAttendanceModal
          date={date}
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : null}

      {/* Profile modal */}
      {showProfile && profileUser ? (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => {
            setShowProfile(false);
            if (updated?.name) setHrName(updated.name);
            Swal.fire({
              icon: "success",
              title: "Profile updated",
              text: "Your changes have been saved.",
              confirmButtonColor: "#C1272D",
            });
          }}
        />
      ) : null}
    </div>
  );
}

/** ---------- subcomponents ---------- */
function Kpi({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

function CompanyCard({ company, items, onEdit }) {
  // per-company stats
  const present = items.filter((r) => String(r.status || "").toLowerCase().includes("present")).length;
  const absentIncLeave = items.filter((r) => {
    const st = String(r.status || "").toLowerCase();
    return st.includes("absent") || st.includes("leave");
  }).length;

  // review status (for farm tables you described, rows may have a `review` column)
  const totalRows = items.length;
  const submittedCount = items.filter((r) => String(r.review || "").toLowerCase() === "submitted").length;
  const allSubmitted = totalRows > 0 && submittedCount === totalRows;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-gray-50/70 px-5 py-3.5 flex items-center justify-between border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-900">{company}</div>
        <div className="flex items-center gap-3">
          {/* Review badge for farm/attendance tables */}
 

          <div className="flex items-center gap-2.5 text-xs">
            <span className="rounded-full bg-emerald-600 text-white px-3 py-1 font-medium">
              Present: {present}
            </span>
            <span className="rounded-full bg-red-600 text-white px-3 py-1 font-medium">
              Absent: {absentIncLeave}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full text-xs">
          <thead className="sticky top-0 bg-white shadow-sm">
            <tr className="text-left text-gray-700">
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
          <tbody className="divide-y divide-gray-100">
            {items.map((r, i) => (
              <tr
                key={`${r.employeeid}-${i}`}
                className="bg-white hover:bg-gray-50 transition-colors"
              >
                <Td>{safe(r.employeeid)}</Td>
                <Td>{safe(r.name)}</Td>
                <Td>
                  <Badge>{safe(r.shift)}</Badge>
                </Td>
                <Td>{parseTime(r.intime)}</Td>
                <Td>{parseTime(r.outtime)}</Td>
                <Td>{minutesToHHMM(r.workdur)}</Td>
                <Td>
                  <StatusPill status={r.status} />
                </Td>
                <Td className="align-top">{safe(r.remarks)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-4 py-3 border-b border-gray-200 font-medium ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-900 px-2.5 py-0.5 border border-gray-200">
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
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${tone}`}>
      {label}
    </span>
  );
}

/* ===========================
   Edit Attendance Modal
   =========================== */
function EditAttendanceModal({ date, row, onClose, onSaved }) {
  const [name, setName] = useState(row?.name || "");
  const [shift, setShift] = useState(row?.shift || "");
  const [intime, setIntime] = useState(row?.intime || "");
  const [outtime, setOuttime] = useState(row?.outtime || "");
  const [workdur, setWorkdur] = useState(
    row?.workdur == null ? "" : String(row.workdur) // minutes as number string
  );
  const [status, setStatus] = useState(row?.status || "");
  const [remarks, setRemarks] = useState(row?.remarks || "");
  const [company, setCompany] = useState(row?.company || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const validate = () => {
    if (!row?.employeeid) return "Missing employee ID.";
    if (intime && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(intime.trim())) return "In Time must be HH:MM or HH:MM:SS.";
    if (outtime && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(outtime.trim())) return "Out Time must be HH:MM or HH:MM:SS.";
    if (workdur !== "" && isNaN(Number(workdur))) return "Work duration must be minutes (number).";
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr("");
    try {
      setSaving(true);
      const payloadRow = {
        employeeid: String(row.employeeid),
        name: name || null,
        shift: shift || null,
        intime: intime || null,
        outtime: outtime || null,
        workdur: workdur === "" ? null : Number(workdur), // minutes
        status: status || null,
        remarks: remarks || null,
        company: company || null,
      };
      const res = await fetch("/api/attendance/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rows: [payloadRow] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Save failed");
      onSaved?.(j);
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-3xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Update Attendance • #{row?.employeeid}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        {err ? <div className="mb-4 text-sm text-red-600">{err}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Employee ID</label>
            <input value={row?.employeeid ?? ""} readOnly disabled className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Shift</label>
            <input value={shift} onChange={(e) => setShift(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="General / Night / ..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Company</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ASF / AGB / ANM / Tandur / Talakondapally ..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">In Time</label>
            <input value={intime} onChange={(e) => setIntime(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="HH:MM or HH:MM:SS" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Out Time</label>
            <input value={outtime} onChange={(e) => setOuttime(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="HH:MM or HH:MM:SS" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Work Duration (minutes)</label>
            <input type="number" value={workdur} onChange={(e) => setWorkdur(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. 450 for 7.5 hours" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="">—</option>
              <option>Present</option>
              <option>Absent</option>
              <option>Leave</option>
              <option>WFH</option>
              <option>OD</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Optional notes" />
          </div>
        </div>

        <div className="pt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
