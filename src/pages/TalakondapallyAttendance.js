// FILE: src/pages/TalakondapallyAttendance.js
import Head from "next/head";
import Image from "next/image";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import MobileFooterMenu from "@/components/MobileFooterMenu";
import { FiCalendar, FiRefreshCw, FiUserPlus } from "react-icons/fi";

// ---------- THEME ----------
const PRIMARY_HEX = "#D97706"; // amber-600
const PRIMARY_BTN = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";
// ---------------------------

// ---------- DESIGNATION SORT ORDER ----------
const DESIGNATION_ORDER = {
  "HOD Operations": 1,
  "HOD - Operations": 1,
  "Farm Manager": 2,
  "Jr Accountant F&A": 3,
  "Live Stock Manager": 4,
  "Live stock manager": 4,
  "Cattle Feed Manager": 5,
  "Cattle feed manager": 5,
  "Farm Supervisor": 6,
  "Supervisor": 6,
  "Garden Supervisor": 7,
  "BMC Supervisor": 8,
  "BMC Operator": 9,
  "Sr Vet Assistant": 10,
  "Jr Vet Assistant": 11,
  "Vet Assistant": 11,
  "Vet Doctor": 12,
  "Doctor": 12,
  "Electrecian": 13,
  "Poojari": 14,
  "Milk Supervisor": 15,
  "Milker": 17,
  "Milk Van Driver": 30,
  "Tractor Driver": 31,
  "Water Men": 32,
  "Water men": 32,
  "Farm Worker": 34,
  "Farm worker": 34,
  "Labour": 34,
};

const DESIGNATION_OPTIONS_FOR_DROPDOWN = [
  "HOD Operations",
  "Farm Manager",
  "Jr Accountant F&A",
  "Live Stock Manager",
  "Cattle Feed Manager",
  "Supervisor",
  "Garden Supervisor",
  "BMC Supervisor",
  "BMC Operator",
  "Sr Vet Assistant",
  "Jr Vet Assistant",
  "Vet Assistant",
  "Vet Doctor",
  "Doctor",
  "Electrecian",
  "Poojari",
  "Milk Supervisor",
  "Milker",
  "Milk Van Driver",
  "Tractor Driver",
  "Water Men",
  "Farm Worker",
  "Labour",
  "Other"
];
const LOCATION_LABEL = "Talakondapally";

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

function determineSubmittedFromApiPayload(j, date) {
  if (typeof j?.locked === "boolean") return j.locked;
  const rows = Array.isArray(j?.data) ? j.data : [];
  if (rows.length === 0) return false;
  const allForDate = rows.every((r) => (r.saved_date || r.date || "") === date);
  const allHaveStatus = rows.every((r) => typeof r.status === "string" && r.status.length > 0);
  return allForDate && allHaveStatus;
}

export default function TalakondapallyAttendance() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [attMap, setAttMap] = useState({});
  const [serverMap, setServerMap] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submittedDate, setSubmittedDate] = useState(null);

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
        designation: r.designation || "",
        saved_date: r.saved_date || r.date || null,
      }));

      // SORT BY DESIGNATION ORDER, then name
      list.sort((a, b) => {
        const cleanA = (a.designation || "").trim();
        const cleanB = (b.designation || "").trim();
        const orderA = DESIGNATION_ORDER[cleanA] || 999;
        const orderB = DESIGNATION_ORDER[cleanB] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.employee_name.localeCompare(b.employee_name);
      });
      setEmployees(list);

      const nextFromServer = {};
      for (const r of rows) nextFromServer[r.employee_id] = r.status || STATUS.PRESENT;
      setServerMap(nextFromServer);
      setAttMap(nextFromServer);

      const locked = determineSubmittedFromApiPayload(j, date);
      const show = !!locked || (submittedDate === date);
      setSubmitted(show);
      setIsEditing(!locked);
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

  const save = async () => {
    try {
      if (!date) {
        Swal.fire({ icon: "warning", title: "Pick a date", text: "Please choose a date." });
        return;
      }
      const rows = employees.map((e) => ({
        employee_id: e.id,
        status: attMap[e.id] || null,
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
      setSubmittedDate(date);
      setIsEditing(false);
      Swal.fire({ icon: "success", title: "Submitted", text: `Attendance submitted for ${date}.`, confirmButtonColor: PRIMARY_HEX });
      await loadForDate();
      setSubmitted(true);
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
      setAttMap((prev) => { const next = { ...prev }; delete next[emp.id]; return next; });
      setServerMap((prev) => { const next = { ...prev }; delete next[emp.id]; return next; });
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
      <main className="min-h-screen bg-gray-50 pb-14">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* logo + location on top-left */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 relative flex-shrink-0">
                  {/* replace /logo.png with your actual logo path if different */}
                  <Image src="/logo.png" alt="Agasthya Superfoods" width={48} height={48} className="rounded-full object-contain" />
                </div>
              </div>
            </div>

            {/* compact action icons (calendar + date input, refresh icon, add icon) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5">
                <FiCalendar className="text-gray-500" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={todayIso()}
                  className={`text-sm outline-none bg-transparent ${PRIMARY_OUTLINE}`}
                />
              </div>

              <button
                onClick={() => loadForDate()}
                aria-label="Refresh"
                title="Refresh"
                className="rounded-lg p-2 border border-gray-200 bg-white hover:bg-gray-50"
              >
                <FiRefreshCw />
              </button>

              {/* Add is now always clickable (not disabled for read-only) */}
              <button
                onClick={() => setShowAdd(true)}
                aria-label="Add employee"
                title="Add employee"
                className={`rounded-lg p-2 ${PRIMARY_BTN} text-white`}
              >
                <FiUserPlus />
              </button>
            </div>
          </div>

          <div className="px-4 pb-3 text-xs text-gray-700 flex items-center gap-3 overflow-x-auto">
            <span>Total: <b>{counts.total}</b></span>
            <span className="text-emerald-700">Present: <b>{counts.present}</b></span>
            <span className="text-rose-700">Absent: <b>{counts.absent}</b></span>
            <span className="text-amber-700">Half Day: <b>{counts.half}</b></span>
          </div>

          {/* Update attendance button above table */}
          {readOnly ? (
            <div className="px-4 pb-2">
              <button
                onClick={startEditing}
                disabled={loading || employees.length === 0}
                className={`w-full rounded-xl ${PRIMARY_BTN} text-white py-3 font-medium disabled:opacity-60`}
              >
                Update attendance
              </button>
            </div>
          ) : null}
        </header>

        {/* Main table and cards */}
        {readOnly ? (
          <>
            <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3">
              This date is locked. Use <b>Update attendance</b> to enable editing.
            </div>
            <section className="p-4">
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-700">Designation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-4 text-gray-500">No employees for this date.</td>
                      </tr>
                    ) : (
                      employees.map((e) => (
                        <tr key={e.id} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-900">{e.employee_name}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                ${(attMap[e.id] || STATUS.PRESENT) === STATUS.PRESENT ? "bg-emerald-100 text-emerald-700" :
                                 (attMap[e.id] || STATUS.PRESENT) === STATUS.ABSENT  ? "bg-rose-100 text-rose-700"    :
                                 (attMap[e.id] || STATUS.PRESENT) === STATUS.HALF    ? "bg-amber-100 text-amber-700"   :
                                                                                        "bg-gray-100 text-gray-700" }`}
                            >
                              {attMap[e.id] || STATUS.PRESENT}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{e.designation || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="p-4 pb-24 space-y-3">
            <div className="space-y-3">
              {loading ? (
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-gray-600">Loading employees…</div>
              ) : employees.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600">
                  No employees yet. Tap <b>“+ Add”</b> to add one.
                </div>
              ) : (
                employees.map((e) => {
                  const st = attMap[e.id] || STATUS.PRESENT;
                  const ring = selectRing(st);
                  return (
                    <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{e.employee_name}</div>
                          <div className="text-xs text-gray-500">{e.designation || "—"}</div>
                        </div>
                        <button
                          onClick={() => deleteEmployee(e)}
                          disabled={!isEditing}
                          className="text-xs rounded-lg border border-rose-300 text-rose-700 px-2 py-1 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">Status</label>
                        <div className={`rounded-lg border border-gray-300 px-3 py-2 ring-2 ${ring} ${!isEditing ? "bg-gray-50" : ""}`}>
                          <select
                            value={st}
                            onChange={(ev) => setStatus(e.id, ev.target.value)}
                            disabled={!isEditing}
                            className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:text-gray-500"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt || "none"} value={opt}>
                                {opt || "— Select —"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        <MobileFooterMenu />
      </main>

      {showAdd ? (
        <AddEmployeeModalBottom
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            loadForDate();
          }}
          disabled={!isEditing}
          designationOptions={DESIGNATION_OPTIONS_FOR_DROPDOWN}
        />
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------------------
   AddEmployeeModalBottom - bottom sheet modal that covers footer
   - anchored to bottom: 0 and overlays the footer (covers it)
   - overlay present and modal z-index above footer
   - constrained height with overflow-auto
   - custom upward-opening dropdown is rendered as a full fixed panel
     with reduced header/padding and no extra outer border for a cleaner look.
-----------------------------------------------------------------------------*/

function AddEmployeeModalBottom({ onClose, onAdded, disabled, designationOptions = [] }) {
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState(designationOptions[0] || "");
  const [customDesignation, setCustomDesignation] = useState("");
  const [saving, setSaving] = useState(false);

  // dropdown related state
  const [showDD, setShowDD] = useState(false);
  const ddTriggerRef = useRef(null);

  useEffect(() => {
    setDesignation(designationOptions[0] || "");
  }, [designationOptions]);

  const isOther = designation === "Other";

  const onSubmit = async (ev) => {
    ev?.preventDefault();
    if (disabled) return;
    if (!employeeId.trim() || !name.trim()) {
      Swal.fire({ icon: "warning", title: "Missing fields", text: "Please provide employee id and name." });
      return;
    }
    const finalDesignation = isOther ? (customDesignation.trim() || "Other") : designation;
    try {
      setSaving(true);
      const res = await fetch('/api/talakondapally/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId.trim(), employee_name: name.trim(), designation: finalDesignation })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Add failed');
      Swal.fire({ icon: 'success', title: 'Added', text: `${name} added successfully.` });
      setName(''); setEmployeeId(''); setDesignation(designationOptions[0] || ''); setCustomDesignation('');
      onAdded && onAdded();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Add failed', text: e.message || 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  // When dropdown is visible we render it as a fixed full-panel overlay
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* overlay (covers whole screen, including footer) */}
        <div className="absolute inset-0 bg-black/40 z-40" onClick={() => {
          // close dropdown first if open, otherwise close modal
          if (showDD) setShowDD(false);
          else onClose && onClose();
        }} />

        {/* bottom sheet modal (anchored to bottom: covers footer) */}
        <form
          onSubmit={onSubmit}
          className="relative z-50 w-full max-w-md bg-white rounded-t-xl shadow-xl overflow-auto max-h-[86vh] mb-0"
          role="dialog"
          aria-modal="true"
          style={{ marginBottom: 0 }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-transparent">
            <div className="text-sm font-medium text-gray-800">Add employee</div>
            <button
              type="button"
              onClick={() => onClose && onClose()}
              aria-label="Close"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-3">
            <div>
              <label className="block text-xs text-gray-600">Employee ID</label>
              <input
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={disabled || saving}
                placeholder="EMP123"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={disabled || saving}
                placeholder="Full name"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none"
              />
            </div>

            {/* --- DESIGNATION FIELD (opens a fixed full panel) --- */}
            <div className="relative">
              <label className="block text-xs text-gray-600">Designation</label>

              {/* Trigger button */}
              <button
                ref={ddTriggerRef}
                type="button"
                disabled={disabled || saving}
                onClick={() => setShowDD((p) => !p)}
                className="w-full text-left mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {designation || "Select designation"}
              </button>

              {/* If showDD is true, render a fixed full-panel dropdown that escapes modal clipping */}
              {showDD && (
                <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-none">
                  {/* transparent backdrop for dropdown; clicking closes dropdown */}
                  <div
                    className="absolute inset-0"
                    onClick={() => setShowDD(false)}
                    aria-hidden
                  />

                  {/* the dropdown panel: aligned to modal width, reduced padding, NO outer border for cleaner look */}
                  <div
                    className="relative w-full max-w-md mx-4 pointer-events-auto"
                    style={{ marginBottom: '8vh' }}
                  >
                    <div className="bg-white rounded-lg shadow-xl max-h-[82vh] overflow-auto">
                      {/* compact header inside dropdown */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="text-sm font-medium">Select designation</div>
                        <button
                          type="button"
                          onClick={() => setShowDD(false)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-600 text-sm"
                        >
                          ✕
                        </button>
                      </div>

                      {/* options list — larger clickable rows, reduced extra borders */}
                      <div>
                        {designationOptions.map((d) => (
                          <div
                            key={d}
                            onClick={() => { setDesignation(d); setShowDD(false); }}
                            className="px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
                          >
                            {d}
                          </div>
                        ))}

                        {/* Ensure "Other" option exists and is selectable */}
                        {!designationOptions.includes("Other") && (
                          <div
                            onClick={() => { setDesignation("Other"); setShowDD(false); }}
                            className="px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
                          >
                            Other
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Custom designation input when "Other" is selected */}
            {designation === "Other" && (
              <input
                value={customDesignation}
                onChange={(e) => setCustomDesignation(e.target.value)}
                disabled={disabled || saving}
                placeholder="Custom designation"
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none"
              />
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onClose && onClose()}
                className="mr-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disabled || saving}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
