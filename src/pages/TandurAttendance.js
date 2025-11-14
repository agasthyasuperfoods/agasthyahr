import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

/* THEME */
const PRIMARY_HEX = "#D97706";
const PRIMARY_BTN = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";

/* PRIORITY: exact order requested */
const DESIGNATION_PRIORITY = [
  "farm manager",
  "supervisor",
  "veterinary assistant",
  "bihar labour",
  "jharkhand labour",
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS = { PRESENT: "Present", ABSENT: "Absent", HALF: "Half Day" };
const STATUS_OPTIONS = ["", STATUS.PRESENT, STATUS.ABSENT, STATUS.HALF];

function determineSubmittedFromApiPayload(j, date) {
  if (typeof j?.locked === "boolean") return j.locked;
  const rows = Array.isArray(j?.data) ? j.data : [];
  if (rows.length === 0) return false;
  const allForDate = rows.every((r) => (r.saved_date || r.date || "") === date);
  const allHaveStatus = rows.every((r) => typeof r.status === "string" && r.status.length > 0);
  return allForDate && allHaveStatus;
}

// Normalize and strip numbers from designation string
function normalizeDesignation(raw) {
  if (!raw || typeof raw !== "string") return "unassigned";
  let s = raw.trim().toLowerCase();
  s = s.replace(/[0-9]+/g, '').trim();
  if ((s.includes("farm") && s.includes("manager")) || s === "manager" || s.includes("farm-manager") || s.includes("farmmanager"))
    return "farm manager";
  if (s.includes("supervisor")) return "supervisor";
  if (s.includes("vet") || s.includes("veterinary") || s.includes("veterinary assistant") || s.includes("veterinarian"))
    return "veterinary assistant";
  if (s.includes("bihar")) return "bihar labour";
  if (s.includes("jharkhand") || s.includes("jhar")) return "jharkhand labour";
  const cleaned = s.replace(/[^a-z ]+/g, "").trim();
  return cleaned.length ? cleaned : "unassigned";
}

function prettyLabel(canonical) {
  if (!canonical || canonical === "unassigned") return "Unassigned";
  if (canonical === "farm manager") return "Farm Manager";
  if (canonical === "supervisor") return "Supervisor";
  if (canonical === "veterinary assistant") return "Veterinary Assistant";
  if (canonical === "bihar labour") return "Bihar Labour";
  if (canonical === "jharkhand labour") return "Jharkhand Labour";
  return canonical.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function TandurAttendance() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [attMap, setAttMap] = useState({});
  const [serverMap, setServerMap] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedDate, setSubmittedDate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("All");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const authed = localStorage.getItem("auth") === "1";
    const id = localStorage.getItem("employeeid");
    if (!authed || id !== "EMP175") {
      router.replace("/Tandurlogin");
      return;
    }
    setReady(true);
  }, [router]);

  const loadForDate = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tandur/attendance?date=${encodeURIComponent(date)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load attendance");
      const rows = Array.isArray(j?.data) ? j.data : [];
      const list = rows.map((r) => ({
        id: r.employee_id ?? r.employeeid ?? r.Employeeid ?? null,
        employee_name: (r.employee_name ?? r.name ?? "").toString().trim(),
        designation: (r.designation ?? "") || "",
        saved_date: r.saved_date || r.date || null,
      }));
      setEmployees(list);

      const nextFromServer = {};
      for (const r of rows) {
        const id = r.employee_id ?? r.employeeid ?? r.Employeeid ?? null;
        if (id == null) continue;
        nextFromServer[id] = r.status || STATUS.PRESENT;
      }
      setServerMap(nextFromServer);
      setAttMap(nextFromServer);

      const locked = determineSubmittedFromApiPayload(j, date);
      const show = !!locked || (submittedDate === date);
      setSubmitted(show);
      setIsEditing(!locked);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Load failed", text: err.message || "Something went wrong" });
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

  const setStatus = (employeeId, status) => setAttMap(prev => ({ ...prev, [employeeId]: status }));
  const selectRing = (st) => st === STATUS.PRESENT ? "ring-emerald-300" : st === STATUS.ABSENT ? "ring-rose-300" : st === STATUS.HALF ? "ring-amber-300" : "ring-gray-200";

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

  const save = async () => {
    try {
      if (!date) { Swal.fire({ icon: "warning", title: "Pick a date", text: "Please choose a date." }); return; }
      const rows = employees.map(e => ({ employee_id: e.id, status: attMap[e.id] || null }));
      const res = await fetch("/api/tandur/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, rows }) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || "Save failed");

      setServerMap({ ...attMap });
      setSubmitted(true);
      setSubmittedDate(date);
      setIsEditing(false);
      Swal.fire({ icon: "success", title: "Submitted", text: `Attendance submitted for ${date}.`, confirmButtonColor: PRIMARY_HEX });

      await loadForDate();
      setSubmitted(true);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message || "Something went wrong" });
    }
  };

  const startEditing = () => setIsEditing(true);
  const cancelEditing = () => { setAttMap({ ...serverMap }); setIsEditing(false); };

  const deleteEmployee = async (emp) => {
    try {
      const confirm = await Swal.fire({
        icon: "warning", title: "Delete employee?", text: `Remove ${emp.employee_name}? This will also delete their attendance.`, showCancelButton: true, confirmButtonText: "Delete", confirmButtonColor: PRIMARY_HEX
      });
      if (!confirm.isConfirmed) return;
      const res = await fetch(`/api/tandur/employees?id=${emp.id}`, { method: "DELETE" });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      setEmployees(prev => prev.filter(x => x.id !== emp.id));
      setAttMap(prev => { const next = { ...prev }; delete next[emp.id]; return next; });
      setServerMap(prev => { const next = { ...prev }; delete next[emp.id]; return next; });
      Swal.fire({ icon: "success", title: "Deleted", text: `${emp.employee_name} removed.` });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Delete failed", text: err.message || "Something went wrong" });
    }
  };

  const readOnlyRows = useMemo(() => {
    const rows = (selectedCanonical === "All" ? orderedRowsForAll : (groupedByCanonical[selectedCanonical] || []));
    return rows.map(e => {
      const canonical = normalizeDesignation(e.designation);
      return (
        <tr key={e.id} className="border-t border-gray-100">
          <td className="px-4 py-2 text-gray-900">{e.employee_name}</td>
          <td className="px-4 py-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              (attMap[e.id] || STATUS.PRESENT) === STATUS.PRESENT ? "bg-emerald-100 text-emerald-700" :
              (attMap[e.id] || STATUS.PRESENT) === STATUS.ABSENT  ? "bg-rose-100 text-rose-700" :
              (attMap[e.id] || STATUS.PRESENT) === STATUS.HALF    ? "bg-amber-100 text-amber-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {attMap[e.id] || STATUS.PRESENT}
            </span>
          </td>
          <td className="px-4 py-2 text-gray-700">{prettyLabel(canonical)}</td>
        </tr>
      );
    });
  }, [selectedCanonical, orderedRowsForAll, groupedByCanonical, attMap]);

  const editModeBlocks = useMemo(() => {
    if (loading) return <div className="bg-white border border-gray-200 rounded-xl p-4 text-gray-600">Loading employees…</div>;
    if (employees.length === 0) return <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600">No employees yet. Tap <b>+ Add</b> to add one.</div>;
    if (selectedCanonical === "All") {
      return orderedGroupKeys.map(key => {
        const group = groupedByCanonical[key] || [];
        if (!group.length) return null;
        return (
          <div key={key} className="space-y-2">
            <div className="grid gap-3">
              {group.map(e => {
                const st = attMap[e.id] || STATUS.PRESENT;
                const ring = selectRing(st);
                const canonical = normalizeDesignation(e.designation);
                return (
                  <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{e.employee_name}</div>
                        <div className="text-xs text-gray-500">{prettyLabel(canonical)}</div>
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
              })}
            </div>
          </div>
        );
      });
    }
    const rows = (groupedByCanonical[selectedCanonical] || []);
    return rows.map(e => {
      const st = attMap[e.id] || STATUS.PRESENT;
      const ring = selectRing(st);
      const canonical = normalizeDesignation(e.designation);
      return (
        <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-900">{e.employee_name}</div>
              <div className="text-xs text-gray-500">{prettyLabel(canonical)}</div>
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
    });
  }, [loading, employees, orderedGroupKeys, groupedByCanonical, selectedCanonical, attMap, isEditing, deleteEmployee]);

  if (!ready) {
    return <>
      <Head><title>Tandur Attendance</title></Head>
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <span className="inline-block h-6 w-6 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" /> Loading…
      </div>
    </>;
  }

  const readOnly = submitted && !isEditing;
  const pillLabelDate = submittedDate === date ? submittedDate : date;

  return (
    <>
      <Head><title>Tandur Attendance</title></Head>
      <main className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="relative h-10 w-28 shrink-0">
              <Image src="/logo.png" alt="Agasthya Super Foods" fill className="object-contain" priority />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdd(true)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${PRIMARY_BTN} text-white`}
              >+ Add</button>
              <button onClick={() => { try { if (typeof window !== "undefined") { localStorage.removeItem("auth"); localStorage.removeItem("employeeid"); localStorage.removeItem("name"); } router.push("/Tandurlogin"); setTimeout(() => window.location.replace("/Tandurlogin"), 50); } catch { if (typeof window !== "undefined") window.location.replace("/Tandurlogin"); }}} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">Logout</button>
            </div>
          </div>
          <div className="px-4 pb-1 flex items-center gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} className={`flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`} />
            <button onClick={loadForDate} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">Refresh</button>
            <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="px-4 pb-3">
            {submitted ? (
              <div className="mt-1">
                <span className="text-xs inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                  Submitted for {pillLabelDate}
                </span>
              </div>
            ) : null}
            <div className="mt-2 text-xs text-gray-700 flex items-center gap-3 overflow-x-auto">
              <span>Total: <b>{counts.total}</b></span>
              <span className="text-emerald-700">Present: <b>{counts.present}</b></span>
              <span className="text-rose-700">Absent: <b>{counts.absent}</b></span>
              <span className="text-amber-700">Half Day: <b>{counts.half}</b></span>
            </div>
          </div>
        </header>
        {readOnly ? (
          <section className="p-4 pb-24">
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Status</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Designation</th>
                  </tr>
                </thead>
                <tbody>{readOnlyRows}</tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="p-4 space-y-3">
            <div className="space-y-3">{editModeBlocks}</div>
          </section>
        )}
        <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3">
          {readOnly ? (
            <button onClick={() => setIsEditing(true)} disabled={loading || employees.length === 0} className={`w-full rounded-xl ${PRIMARY_BTN} text-white py-3 font-medium`}>Update attendance</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={save} disabled={loading || employees.length === 0} className={`flex-1 rounded-xl ${PRIMARY_BTN} text-white py-3 font-medium`}>{submitted ? "Save changes" : "Submit attendance"}</button>
              {submitted ? <button onClick={() => { setAttMap({ ...serverMap }); setIsEditing(false); }} className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium hover:bg-gray-50">Cancel</button> : null}
            </div>
          )}
        </div>
      </main>
      {showAdd ? (
        <AddEmployeeModal
          onClose={() => { setShowAdd(false); setSelectedGroup("All"); }}
          onAdded={() => { setShowAdd(false); loadForDate(); setSelectedGroup("All"); }}
          disabled={false}
        />
      ) : null}
    </>
  );
}


/* AddEmployeeModal stays as in your previous version -- it's unchanged */

function AddEmployeeModal({ onClose, onAdded, disabled }) {
  const [employeeid, setEmployeeid] = useState("");
  const [employee_name, setEmployeeName] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!employee_name.trim()) {
      Swal.fire({ icon: "warning", title: "Name required", text: "Please enter employee name." }); return; }
    try {
      setSaving(true);
      const payload = { employee_name, designation: designation || null };
      if (employeeid && Number(employeeid) > 0) payload.employeeid = Number(employeeid);
      const res = await fetch("/api/tandur/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || "Failed to add employee");
      Swal.fire({ icon: "success", title: "Added", text: "Employee added successfully.", confirmButtonColor: PRIMARY_HEX });
      onAdded?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Add failed", text: err.message || "Something went wrong" });
    } finally { setSaving(false); }
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
          <div><label className="block text-sm font-medium text-gray-700">Employee ID (optional)</label><input type="number" min="1" value={employeeid} onChange={(e)=>setEmployeeid(e.target.value)} className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`} placeholder="Leave blank to auto-generate" disabled={disabled} /></div>
          <div><label className="block text-sm font-medium text-gray-700">Full name</label><input type="text" value={employee_name} onChange={(e)=>setEmployeeName(e.target.value)} className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`} placeholder="e.g. Ramesh" disabled={disabled} /></div>
          <div><label className="block text-sm font-medium text-gray-700">Designation (optional)</label><input type="text" value={designation} onChange={(e)=>setDesignation(e.target.value)} className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${PRIMARY_OUTLINE}`} placeholder="e.g. Farm Manager, Bihar Labour, Supervisor" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Use consistent labels to map into the priority groups automatically.</p></div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || disabled} className={`rounded-lg ${PRIMARY_BTN} text-white px-4 py-2 text-sm font-medium`}>{saving ? "Adding…" : "Add Employee"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
