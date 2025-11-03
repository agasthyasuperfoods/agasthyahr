// FILE: src/pages/TalakondapallyAttendance.js
import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

// ---------- THEME ----------
const PRIMARY_HEX = "#D97706"; // amber-600
const PRIMARY_BTN = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";
// ---------------------------

// ---------- CONSTANT LOCATION (UI-only; not sent to server) ----------
const LOCATION_LABEL = "Talakondapally";
// --------------------------------------------------------------------

// ---------- DESIGNATION LOGIC (Adapted from Tandur) ----------
/* Priority order for Talakondapally roles */
const DESIGNATION_PRIORITY = [
  "farm manager",
  "live stock manager",
  "doctor",
  "supervisor",
  "bmc supervisor",
  "milk supervisor",
  "milker",
  "driver",
  "electrician",
];

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return [yyyy, mm, dd].join("-");
}

const STATUS = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF: "Half Day",
};
const STATUS_OPTIONS = ["", STATUS.PRESENT, STATUS.ABSENT, STATUS.HALF];

/* Normalizes various spellings into a single key */
function normalizeDesignation(raw) {
  if (!raw || typeof raw !== "string") return "unassigned";
  const s = raw.trim().toLowerCase();
  
  if (s.includes("farm manager")) return "farm manager";
  if (s.includes("live stock manager")) return "live stock manager";
  if (s.includes("doctor")) return "doctor";
  if (s.includes("bmc supervisor")) return "bmc supervisor"; // Check *before* generic supervisor
  if (s.includes("milk supervisor")) return "milk supervisor"; // Check *before* generic supervisor
  if (s.includes("supervisor")) return "supervisor";
  if (s.includes("milker")) return "milker";
  if (s.includes("driver")) return "driver";
  if (s.includes("electrician")) return "electrician";
  
  const cleaned = s.replace(/[^a-z0-9]+/g, " ").trim();
  return cleaned.length ? cleaned : "unassigned";
}

/* Gets a clean label for display */
function prettyLabel(canonical) {
  if (!canonical || canonical === "unassigned") return "Unassigned";
  if (canonical === "farm manager") return "Farm Manager";
  if (canonical === "live stock manager") return "Live Stock Manager";
  if (canonical === "doctor") return "Doctor";
  if (canonical === "supervisor") return "Supervisor";
  if (canonical === "bmc supervisor") return "BMC Supervisor";
  if (canonical === "milk supervisor") return "Milk Supervisor";
  if (canonical === "milker") return "Milker";
  if (canonical === "driver") return "Driver";
  if (canonical === "electrician") return "Electrician";
  // Fallback for any others
  return canonical.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/* Assigns colors to each role for the pill/badge */
function designationColorClasses(canonical) {
  switch (canonical) {
    case "farm manager": return "bg-indigo-100 text-indigo-800";
    case "live stock manager": return "bg-blue-100 text-blue-800";
    case "doctor": return "bg-red-100 text-red-800";
    case "supervisor": return "bg-sky-100 text-sky-800";
    case "bmc supervisor": return "bg-cyan-100 text-cyan-800";
    case "milk supervisor": return "bg-teal-100 text-teal-800";
    case "milker": return "bg-emerald-100 text-emerald-800";
    case "driver": return "bg-amber-100 text-amber-800";
    case "electrician": return "bg-yellow-100 text-yellow-800";
    case "unassigned":
    default: return "bg-gray-100 text-gray-700";
  }
}
// ---------- END OF DESIGNATION LOGIC ---------
function determineSubmittedFromApiPayload(j, date) {
  // 1. Trust 'locked' boolean if the API provides it
  if (typeof j?.locked === "boolean") return j.locked;

  const rows = Array.isArray(j?.data) ? j.data : [];
  // 2. If no employees, it's not submitted
  if (rows.length === 0) return false;

  // 3. *** THIS IS THE FIX ***
  //    A day is locked if *ANY* employee has a saved_date (Check 1)
  //    OR if *ANY* employee has an actual status string saved (like "Present" or "Absent"),
  //    which means it has a length greater than 0.
  
  // Check 1: Does any row have a saved_date that matches?
  const anyForDate = rows.some((r) => {
    const saved = r.saved_date || r.date || "";
    return saved.startsWith(date);
  });
  
  // Check 2: Does any row have a status string with length > 0?
  // This will be true for "Present", "Absent", "Half Day"
  // It will be false for 'null', 'undefined', or "" (empty string)
  const anyHaveRealStatus = rows.some((r) => {
    return typeof r.status === "string" && r.status.length > 0;
  });
  
  return anyForDate || anyHaveRealStatus;
}
// --------------------------------------------------------------------

export default function TalakondapallyAttendance() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);

  // From API: [{ employee_id, employee_name, number, designation, status, saved_date }]
  const [employees, setEmployees] = useState([]);
  const [attMap, setAttMap] = useState({}); // { [id]: STATUS }
  const [serverMap, setServerMap] = useState({}); // snapshot for Cancel
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submittedDate, setSubmittedDate] = useState(null);

  // --- New state for grouping ---
  const [selectedGroup, setSelectedGroup] = useState("All");

  // AUTH GUARD (EMP179 only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const authed = localStorage.getItem("auth") === "1";
    const id = localStorage.getItem("employeeid");
    if (!authed || id !== "EMP179") {
      router.replace("/Talakondapallylogin");
      return;
    }
    setName(localStorage.getItem("name") || "EMP179");
    setReady(true);
  }, [router]);

  const logout = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        localStorage.removeItem("name");
        localStorage.removeItem("email");
        localStorage.removeItem("employeeid");
        localStorage.removeItem("role");
        localStorage.removeItem("hr_auth");
        localStorage.removeItem("hr_role");
        localStorage.removeItem("hr_name");
        localStorage.removeItem("hr_email");
        localStorage.removeItem("hr_employeeid");
      }
      router.push("/Talakondapallylogin");
      setTimeout(() => window.location.replace("/Talakondapallylogin"), 50);
    } catch {
      if (typeof window !== "undefined") window.location.replace("/Talakondapallylogin");
    }
  };

  // --------------------------------------------------------------------
  //  THIS FUNCTION MAKES THE "CALL TO THE DB" (with bug fixes)
  // --------------------------------------------------------------------
  const loadForDate = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/talakondapally/attendance?date=${encodeURIComponent(date)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load attendance");

      const rows = Array.isArray(j?.data) ? j.data : [];

      const list = rows.map((r) => ({
        id: r.employee_id,
        employee_name: r.employee_name,
        number: r.number,
        designation: r.designation || "",
        location: LOCATION_LABEL, // Keep location
        saved_date: r.saved_date || r.date || null,
      }));
      setEmployees(list);

      // This sets the UI. 'null' or '""' status from DB becomes 'Present'
      const nextFromServer = {};
      for (const r of rows) nextFromServer[r.employee_id] = r.status || STATUS.PRESENT;
      setServerMap(nextFromServer);
      setAttMap(nextFromServer);

      const locked = determineSubmittedFromApiPayload(j, date); // From DB (using new logic)
      const show = !!locked || (submittedDate === date);      // From DB OR this session
      
      setSubmitted(show);
      setIsEditing(!show); // <-- This respects both DB state and session state

    } catch (e) {
      Swal.fire({ icon: "error", title: "Load failed", text: e.message || "Something went wrong" });
      setEmployees([]);
      setAttMap({});
      setServerMap({});
      setSubmitted(false);
      setIsEditing(true);
    } finally {
      setLoading(false);
    }
  }, [date, submittedDate]);
  // --------------------------------------------------------------------

  useEffect(() => {
    if (!ready) return;
    loadForDate();
  }, [ready, date, loadForDate]);

  const setStatus = (employeeId, status) => {
    setAttMap((prev) => ({ ...prev, [employeeId]: status }));
  };

  const counts = useMemo(() => {
    let present = 0, absent = 0, half = 0;
    for (const e of employees) {
      const st = attMap[e.id];
      if (st === STATUS.PRESENT) present++;
      else if (st === STATUS.ABSENT) absent++;
      else if (st === STATUS.HALF) half++;
    }
    return { total: employees.length, present, absent, half };
  }, [employees, attMap]);

  // --- Memos for grouping (from Tandur) ---
  const groupedByCanonical = useMemo(() => {
    const out = {};
    for (const e of employees) {
      const key = normalizeDesignation(e.designation);
      if (!out[key]) out[key] = [];
      out[key].push(e);
    }
    return out;
  }, [employees]);

  const orderedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedByCanonical);
    const setKeys = new Set(keys);
    const priorityFound = [];
    for (const p of DESIGNATION_PRIORITY) {
      if (setKeys.has(p)) { priorityFound.push(p); setKeys.delete(p); }
    }
    const unassigned = setKeys.has("unassigned");
    if (unassigned) setKeys.delete("unassigned");
    const others = Array.from(setKeys).sort();
    const result = [...priorityFound, ...others];
    if (unassigned) result.push("unassigned");
    return result;
  }, [groupedByCanonical]);

  const designationOptions = useMemo(() => ["All", ...orderedGroupKeys.map(k => prettyLabel(k))], [orderedGroupKeys]);

  const orderedRowsForAll = useMemo(() => {
    const out = [];
    for (const k of orderedGroupKeys) {
      const list = groupedByCanonical[k] || [];
      for (const it of list) out.push(it);
    }
    return out;
  }, [orderedGroupKeys, groupedByCanonical]);

  const selectedCanonical = useMemo(() => {
    if (!selectedGroup || selectedGroup === "All") return "All";
    const found = orderedGroupKeys.find(k => prettyLabel(k) === selectedGroup);
    if (found) return found;
    return normalizeDesignation(selectedGroup);
  }, [selectedGroup, orderedGroupKeys]);
  // --- End of grouping memos ---


  const save = async () => {
    try {
      if (!date) {
        Swal.fire({ icon: "warning", title: "Pick a date", text: "Please choose a date." });
        return;
      }
      const rows = employees.map((e) => ({
        employee_id: e.id,
        status: attMap[e.id] || null, // Sends 'null' if '— Select —' ("") is chosen
      }));
      const res = await fetch("/api/talakondapally/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rows }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Save failed");

      setServerMap({ ...attMap });
      setSubmitted(true);
      setSubmittedDate(date); // This remembers you submitted for this date
      setIsEditing(false); // This locks the page

      Swal.fire({
        icon: "success",
        title: "Submitted",
        text: `Attendance submitted for ${date}.`,
        confirmButtonColor: PRIMARY_HEX,
      });
      
    } catch (e) {
      Swal.fire({ icon: "error", title: "Save failed", text: e.message || "Something went wrong" });
    }
  };

  const startEditing = () => setIsEditing(true);
  const cancelEditing = () => {
    setAttMap({ ...serverMap });
    setIsEditing(false);
  };

  const deleteEmployee = async (emp) => {
    try {
      const confirm = await Swal.fire({
        icon: "warning",
        title: "Delete employee?",
        text: `Remove ${emp.employee_name}? This will also delete their attendance.`,
        showCancelButton: true,
        confirmButtonText: "Delete",
        confirmButtonColor: PRIMARY_HEX,
      });
      if (!confirm.isConfirmed) return;

      const res = await fetch(`/api/talakondapally/employees?id=${emp.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");

      setEmployees((prev) => prev.filter((x) => x.id !== emp.id));
      setAttMap((prev) => {
        const next = { ...prev };
        delete next[emp.id];
        return next;
      });
      setServerMap((prev) => {
        const next = { ...prev };
        delete next[emp.id];
        return next;
      });

      Swal.fire({ icon: "success", title: "Deleted", text: `${emp.employee_name} removed.` });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Something went wrong" });
    }
  };

  const selectRing = (st) =>
    st === STATUS.PRESENT ? "ring-emerald-300" :
    st === STATUS.ABSENT  ? "ring-rose-300"    :
    st === STATUS.HALF    ? "ring-amber-300"   :
                            "ring-gray-200";

  // --- Memos for rendering (from Tandur) ---
  const readOnlyRows = useMemo(() => {
    const rows = (selectedCanonical === "All" ? orderedRowsForAll : (groupedByCanonical[selectedCanonical] || []));
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan="5" className="px-4 py-4 text-gray-500 text-center">
            {selectedCanonical === "All" ? "No employees for this date." : "No employees in this group."}
          </td>
        </tr>
      );
    }
    
    return rows.map(e => {
      const canonical = normalizeDesignation(e.designation);
      const displayStatus = attMap[e.id] || STATUS.PRESENT;
      return (
        <tr key={e.id} className="border-t border-gray-100">
          <td className="px-4 py-2 text-gray-900">{e.employee_name}</td>
          <td className="px-4 py-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
              ${displayStatus === STATUS.PRESENT ? "bg-emerald-100 text-emerald-700" :
                displayStatus === STATUS.ABSENT  ? "bg-rose-100 text-rose-700"    :
                displayStatus === STATUS.HALF    ? "bg-amber-100 text-amber-700"   :
                                                   "bg-gray-100 text-gray-700" }`}>
              {displayStatus}
            </span>
          </td>
          <td className="px-4 py-2 text-gray-700">{e.number || "—"}</td>
          <td className="px-4 py-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${designationColorClasses(canonical)}`}>
              {e.designation ? e.designation : prettyLabel(canonical)}
            </span>
          </td>
          <td className="px-4 py-2 text-gray-700">{LOCATION_LABEL}</td>
        </tr>
      );
    });
  }, [selectedCanonical, orderedRowsForAll, groupedByCanonical, attMap]);

  const editModeBlocks = useMemo(() => {
    if (loading) return <div className="bg-white border border-gray-200 rounded-xl p-4 text-gray-600">Loading employees…</div>;
    if (employees.length === 0) return <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600">No employees yet. Tap <b>+ Add</b> to add one.</div>;

    const renderCard = (e) => {
      const st = attMap[e.id] || STATUS.PRESENT;
      const ring = selectRing(st);
      const canonical = normalizeDesignation(e.designation);
      return (
        <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-900">{e.employee_name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                <span>{e.number || "—"}</span>
                <span>•</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${designationColorClasses(canonical)}`}>{e.designation ? e.designation : prettyLabel(canonical)}</span>
                <span>•</span>
                <span>{LOCATION_LABEL}</span>
              </div>
            </div>
            <button onClick={() => deleteEmployee(e)} disabled={!isEditing} className="text-xs rounded-lg border border-rose-300 text-rose-700 px-2 py-1 hover:bg-rose-50 disabled:opacity-50">Delete</button>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <div className={`rounded-lg border border-gray-300 px-3 py-2 ring-2 ${ring} ${!isEditing ? "bg-gray-50" : ""}`}>
              <select value={st} onChange={(ev) => setStatus(e.id, ev.target.value)} disabled={!isEditing} className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:text-gray-500">
                {STATUS_OPTIONS.map(opt => <option key={opt || "none"} value={opt}>{opt || "— Select —"}</option>)}
              </select>
            </div>
          </div>
        </div>
      );
    };

    if (selectedCanonical === "All") {
      return orderedGroupKeys.map(key => {
        const group = groupedByCanonical[key] || [];
        if (!group.length) return null;
        return (
          <div key={key}>
            <h3 className="text-sm font-semibold text-gray-800 mb-2 px-1">{prettyLabel(key)}</h3>
            <div className="space-y-3">
              {group.map(renderCard)}
            </div>
          </div>
        );
      });
    }

    const rows = (groupedByCanonical[selectedCanonical] || []);
    if (rows.length === 0) {
      return <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600">No employees in this group.</div>
    }
    return rows.map(renderCard);
  }, [loading, employees, orderedGroupKeys, groupedByCanonical, selectedCanonical, attMap, isEditing]); // Removed deleteEmployee from deps
  // --- End of rendering memos ---


  // This conditional return MUST come AFTER all hooks
  if (!ready) {
    return (
      <>
        <Head><title>Talakondapally Attendance</title></Head>
        <div className="min-h-screen flex items-center justify-center text-gray-600">
          <span className="inline-block h-6 w-6 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          Loading…
        </div>
      </>
    );
  }

  const readOnly = submitted && !isEditing;

  return (
    <>
      <Head>
        <title>Talakondapally Attendance</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-10 w-28 shrink-0">
                <Image src="/logo.png" alt="Agasthya Super Foods" fill className="object-contain" priority />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (!readOnly) setShowAdd(true); }}
                disabled={readOnly}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${readOnly ? "bg-gray-200 text-gray-500 cursor-not-allowed" : `${PRIMARY_BTN} text-white`}`}
              >
                + Add
              </button>
              <button
                onClick={logout}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Date row + Refresh */}
          <div className="px-4 pb-2 flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayIso()}
              className={`flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`}
            />
            <button
              onClick={loadForDate}
              className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
          
          {/* Filter row + Submitted pill */}
          <div className="px-4 pb-3 flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="group-filter" className="sr-only">Filter by designation</label>
              <select
                id="group-filter"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`}
              >
                {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {submitted ? (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                Submitted for {date}
              </span>
            ) : null}
          </div>

          {/* Quick counts */}
          <div className="px-4 pb-3 text-xs text-gray-700 flex items-center gap-3 overflow-x-auto">
            <span>Total: <b>{counts.total}</b></span>
            <span className="text-emerald-700">Present: <b>{counts.present}</b></span>
            <span className="text-rose-700">Absent: <b>{counts.absent}</b></span>
            <span className="text-amber-700">Half Day: <b>{counts.half}</b></span>
          </div>
        </header>

        {/* READ-ONLY TABLE WHEN LOCKED */}
        {readOnly ? (
          <>
            <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3">
              This date is locked. Use <b>Update attendance</b> to enable editing.
            </div>
            <section className="p-4 pb-24">
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Number</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Designation</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readOnlyRows}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          // EDIT MODE CARDS
          <section className="p-4 pb-24 space-y-3">
            {editModeBlocks}
          </section>
        )}

      <footer
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }} // iOS safe-area
      >
        {readOnly ? (
          <button
            onClick={startEditing}
            disabled={loading || employees.length === 0}
            className={`w-full rounded-xl ${PRIMARY_BTN} text-white py-3 font-medium disabled:opacity-60`}
          >
            Update attendance
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={loading || employees.length === 0}
              className={`flex-1 rounded-xl ${PRIMARY_BTN} text-white py-3 font-medium disabled:opacity-60`}
            >
              {submitted ? "Save changes" : "Submit attendance"}
            </button>
            {submitted ? (
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        )}
      </footer>

      </main>

      {showAdd && isEditing ? (
        <AddEmployeeModal
          onClose={() => { setShowAdd(false); setSelectedGroup("All"); }}
          onAdded={() => {
            setShowAdd(false);
            loadForDate();
            setSelectedGroup("All");
          }}
          disabled={!isEditing}
        />
      ) : null}
    </>
  );
}

function AddEmployeeModal({ onClose, onAdded, disabled }) {
  const [employeeid, setEmployeeid] = useState("");
  const [employee_name, setEmployeeName] = useState("");
  const [number, setNumber] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!employee_name.trim()) {
      Swal.fire({ icon: "warning", title: "Name required", text: "Please enter employee name." });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        employee_name,
        number: number || null,
        designation: designation || null,
      };
      if (employeeid && Number(employeeid) > 0) payload.employeeid = Number(employeeid);

      const res = await fetch("/api/talakondapally/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to add employee");

      Swal.fire({
        icon: "success",
        title: "Added",
        text: "Employee added successfully.",
        confirmButtonColor: PRIMARY_HEX,
      });
      onAdded?.();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Add failed", text: e.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-white rounded-t-2xl md:rounded-2xl p-5 m-0 md:m-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Add Employee</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Employee ID</label>
            <input
              type="number"
              min="1"
              value={employeeid}
              onChange={(e) => setEmployeeid(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`}
              placeholder="Leave blank to auto-generate"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              type="text"
              value={employee_name}
              onChange={(e) => setEmployeeName(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`}
              placeholder="e.g. Ramesh"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Number</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`}
              placeholder="e.g. TKP-023"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`}
              placeholder="e.g. Doctor, Milker, Supervisor"
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || disabled}
              className={`rounded-lg ${PRIMARY_BTN} text-white px-4 py-2 text-sm font-medium disabled:opacity-60`}
            >
              {saving ? "Adding…" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}