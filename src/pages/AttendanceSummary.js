'use client';

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AppHeader from "@/components/AppHeader";

/* ----------------- Utils ----------------- */
function prevMonthYYYYMM() {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}
function humanMonth(yyyyMm) {
  if (!/^\d{4}-\d{2}$/.test(String(yyyyMm))) return "-";
  const [y, m] = String(yyyyMm).split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}
const normId = (s) => String(s ?? "").trim().replace(/\s+/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function justDate(isoOrDateish) {
  const v = String(isoOrDateish || "");
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const tSplit = v.split("T")[0];
  const spSplit = tSplit.split(" ")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(spSplit) ? spSplit : "";
}
function ddmmyyyy(yyyyMmDd) {
  const d = justDate(yyyyMmDd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "-";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}
const toNumOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function daysInMonth(yyyyMm) {
  if (!/^\d{4}-\d{2}$/.test(String(yyyyMm))) return 0;
  const [y, m] = String(yyyyMm).split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
const companyKey = (empId) => `hr_company_${String(empId || "anon")}`;
function statusToLeaveUnits(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  if (!s) return 0;
  if (s.includes("half") || s.includes("0.5") || s === "hl" || s === "l/2" || s.includes("1/2")) return 0.5;
  if (s === "l") return 1;
  if (s.includes("leave")) return 1;
  const tokens = ["cl", "sl", "el", "pl", "al", "ml", "ul"];
  if (tokens.some((t) => s === t || s.endsWith(` ${t}`))) return 1;
  return 0;
}

/* ----------------- Page ----------------- */
export default function AttendanceSummary() {
  const router = useRouter();

  // include location in viewer state
  const [hr, setHr] = useState({ id: "", name: "HR", company: "", location: "" });
  const [meLoading, setMeLoading] = useState(true);

  // Default to previous month, but hydrate from ?month later
  const [month, setMonth] = useState(prevMonthYYYYMM());

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [missingDays, setMissingDays] = useState(0);

  const [emps, setEmps] = useState([]);
  const [empsLoading, setEmpsLoading] = useState(true);

  const [leavesMap, setLeavesMap] = useState({});
  const [leavesLoading, setLeavesLoading] = useState(true);

  // NEW: late login auto-adjust map
  const [lateAdjMap, setLateAdjMap] = useState({});
  const [lateAdjLoading, setLateAdjLoading] = useState(true);

  const [draft, setDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editBackup, setEditBackup] = useState({});
  const [submitting, setSubmitting] = useState(false);

  /* ---------- Resolve current user + authoritative company + location ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let me = {};
        try {
          const r = await fetch("/api/me", { credentials: "include" });
          me = (await r.json().catch(() => ({}))) || {};
        } catch {}
        let id =
          me.employeeid ||
          (typeof window !== "undefined" ? localStorage.getItem("hr_employeeid") : "") ||
          "";

        // Prefer me.company/me.location if present, else fetch from EmployeeTable
        let resolvedCompany = (me.company || "").trim();
        let resolvedLocation = (me.location || "").trim();

        if (id) {
          try {
            const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { credentials: "include" });
            const j = await r.json().catch(() => ({}));
            if (r.ok && Array.isArray(j?.data) && j.data.length) {
              const u = j.data[0] || {};
              const dbCompany = (u?.company || "").trim();
              const dbLocation = (u?.location || "").trim();
              if (!resolvedCompany && dbCompany) resolvedCompany = dbCompany;
              if (!resolvedLocation && dbLocation) resolvedLocation = dbLocation;
            }
          } catch {}
        }

        /* ---------- SPECIAL ACCESS RULES ---------- */
        const nid = normId(id);
        if (nid === "EMP12") {
          // EMP12 sees all HO employees (location-only)
          resolvedLocation = "HO";
          resolvedCompany = ""; // clear company filter so location-only applies
        } else if (nid === "EMP72") {
          // EMP72 sees all ANM employees (company-only)
          resolvedCompany = "ANM";
          resolvedLocation = ""; // clear location so company-only applies
        }

        // Only default to ASF if still empty and not EMP12 rule
        if (!resolvedCompany && nid !== "EMP12") {
          const cookieOrLs = (typeof window !== "undefined" ? localStorage.getItem(companyKey(id)) : "") || "";
          resolvedCompany = cookieOrLs.trim() || "ASF";
        }

        const resolvedName = me.name || "HR";

        try {
          // persist company (can be empty string for EMP12)
          localStorage.setItem(companyKey(id), resolvedCompany);
          document.cookie = `hr_company_${encodeURIComponent(id)}=${encodeURIComponent(resolvedCompany)}; Path=/; Max-Age=31536000; SameSite=Lax`;
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("hr-company-changed", { detail: { company: resolvedCompany, by: id } }));
          }
        } catch {}

        if (!cancelled) setHr({ id, name: resolvedName, company: resolvedCompany, location: resolvedLocation });
      } catch {
        if (!cancelled) setHr({ id: "", name: "HR", company: "ASF", location: "" });
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Only listen for company change (location is not cross-tab synced here)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e) => {
      if (!hr.id) return;
      if (e.key === companyKey(hr.id)) {
        setHr((h) => ({ ...h, company: String(e.newValue || "").trim() }));
      }
    };
    const onCustom = (e) => {
      const det = e?.detail || {};
      if (!hr.id) return;
      if (det.by && det.by !== hr.id) return;
      const next = String(det.company || "").trim();
      if (next || next === "") setHr((h) => ({ ...h, company: next }));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("hr-company-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("hr-company-changed", onCustom);
    };
  }, [hr.id]);

  /* ---------- Hydrate from URL: ?month=YYYY-MM and optional ?company=XYZ ---------- */
  useEffect(() => {
    if (!router.isReady) return;
    const m = Array.isArray(router.query.month) ? router.query.month[0] : router.query.month;
    if (typeof m === "string" && /^\d{4}-\d{2}$/.test(m)) {
      setMonth(m);
    }
  }, [router.isReady, router.query.month]);

  useEffect(() => {
    if (!router.isReady || meLoading) return;
    const c = Array.isArray(router.query.company) ? router.query.company[0] : router.query.company;
    const nextCompany = (typeof c === "string" ? c.trim() : "");
    if (nextCompany && hr.company !== nextCompany) {
      const by = hr.id;
      try {
        localStorage.setItem(companyKey(by), nextCompany);
        document.cookie = `hr_company_${encodeURIComponent(by)}=${encodeURIComponent(nextCompany)}; Path=/; Max-Age=31536000; SameSite=Lax`;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("hr-company-changed", { detail: { company: nextCompany, by } }));
        }
      } catch {}
      setHr((prev) => ({ ...prev, company: nextCompany }));
    }
  }, [router.isReady, router.query.company, meLoading, hr.id, hr.company]);

  /* ---------- Data fetchers ---------- */
  const fetchEmps = async () => {
    if (!hr.company && !hr.location) { setEmps([]); return; }
    try {
      setEmpsLoading(true);
      const url =
        `/api/users` +
        `?${new URLSearchParams({
          ...(hr.company ? { company: hr.company } : {}),
          ...(hr.location ? { location: hr.location } : {}),
        }).toString()}`;
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load employees");
      const list = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      setEmps(list);
    } catch {
      setEmps([]);
    } finally {
      setEmpsLoading(false);
    }
  };
  useEffect(() => { if (!meLoading) fetchEmps(); }, [meLoading, hr.company, hr.location]);

  const fetchSummary = async () => {
    if (!hr.company && !hr.location) { setRows([]); setComplete(false); setMissingDays(0); return; }
    try {
      setLoading(true);
      const url =
        `/api/attendance/summary` +
        `?${new URLSearchParams({
          month,
          ...(hr.company ? { company: hr.company } : {}),
          ...(hr.location ? { location: hr.location } : {}),
        }).toString()}`;
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load");
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setComplete(!!j.is_complete);
      setMissingDays(Number(j.total_missing_days || 0));
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message || "Failed to load summary" });
      setRows([]); setComplete(false); setMissingDays(0);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (!meLoading) fetchSummary(); }, [meLoading, month, hr.company, hr.location]);

  const fetchLeaves = async () => {
    if (!hr.company && !hr.location) { setLeavesMap({}); setLeavesLoading(false); return; }
    try {
      setLeavesLoading(true);
      const url =
        `/api/attendance/daily` +
        `?${new URLSearchParams({
          month,
          ...(hr.company ? { company: hr.company } : {}),
          ...(hr.location ? { location: hr.location } : {}),
        }).toString()}`;
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load monthly attendance");
      const list = Array.isArray(j?.rows) ? j.rows : [];
      const acc = {};
      for (const row of list) {
        const id = normId(row.employeeid);
        if (!id) continue;
        acc[id] = (acc[id] || 0) + statusToLeaveUnits(row.status);
      }
      setLeavesMap(acc);
    } catch {
      setLeavesMap({});
    } finally {
      setLeavesLoading(false);
    }
  };
  useEffect(() => { if (!meLoading) fetchLeaves(); }, [meLoading, month, hr.company, hr.location]);

  // NEW: late login adjustments (0.5 for every 3 late days > 10:15), excluding Sundays & holidays
  const fetchLateAdj = async () => {
    if (!hr.company && !hr.location) { setLateAdjMap({}); setLateAdjLoading(false); return; }
    try {
      setLateAdjLoading(true);
      const url =
        `/api/attendance/late` +
        `?${new URLSearchParams({
          month,
          ...(hr.company ? { company: hr.company } : {}),
          // threshold: "10:15", // uncomment to override default
        }).toString()}`;
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load late adjustments");
      setLateAdjMap(j.map || {}); // keys are upper-cased employeeids
    } catch {
      setLateAdjMap({});
    } finally {
      setLateAdjLoading(false);
    }
  };
  useEffect(() => { if (!meLoading) fetchLateAdj(); }, [meLoading, month, hr.company, hr.location]);

  /* ---------- Lookup map (includes carry-forward) ---------- */
  const empMap = useMemo(() => {
    const m = {};
    for (const u of emps || []) {
      const key = normId(u.employeeid ?? u.id);
      if (!key) continue;
      const leavesCfNum = Number(u.leaves_cf);
      m[key] = {
        name: u.name ?? "",
        doj: justDate(u.doj ?? ""),
        designation: u.designation ?? "",
        grosssalary: u.grossSalary ?? u.grosssalary ?? u.gross_salary ?? "",
        company: (u.company ?? "").trim(),
        probationYes: String(u.probation ?? "").trim().toLowerCase() === "yes",
        // <- carry-forward leaves from EmployeeTable."Leaves_cf"
        leaves_cf: Number.isFinite(leavesCfNum) ? leavesCfNum : null,
      };
    }
    return m;
  }, [emps]);

  /* ---------- Month-driven (calendar) Actual Working Days ---------- */
  const actualWorkingDays = useMemo(() => daysInMonth(month), [month]);

  /* ---------- Merge server rows with lookups ---------- */
  const mergedRows = useMemo(() => {
    const scoped = (rows || []).map((r) => {
      const aux = empMap[normId(r.employeeid)] || {};
      const probationYes = aux.probationYes || String(r.probation ?? "").trim().toLowerCase() === "yes";
      const salaryTxt = r.salary_per_month ?? aux.grosssalary ?? null;
      const salaryNum = Number(String(salaryTxt || "").replace(/[, ]/g, ""));
      return {
        ...r,
        name: r.name ?? aux.name ?? "",
        doj: justDate(r.doj ?? aux.doj ?? ""),
        designation: r.designation ?? aux.designation ?? "",
        salary_per_month: Number.isFinite(Number(r.salary_per_month))
          ? Number(r.salary_per_month)
          : Number.isFinite(salaryNum) ? salaryNum : salaryTxt,
        current_month_eligibility: probationYes ? 0 : 2,
        // NOTE: compute from month for determinism
        actual_working_days: actualWorkingDays,
        _resolved_company: (r.company ?? aux.company ?? "").trim(),
        // expose master carry-forward (for reference/fallback)
        _master_leaves_cf: aux.leaves_cf,
      };
    });

    const cmp = (hr.company || "").trim().toLowerCase();
    return cmp ? scoped.filter((r) => String(r._resolved_company || "").trim().toLowerCase() === cmp) : scoped;
  }, [rows, empMap, hr.company, actualWorkingDays]);

  // include lateAdjLoading in the overall status
  const anyLoading = loading || empsLoading || leavesLoading || lateAdjLoading;
  const readyToSubmit = !meLoading && !anyLoading && mergedRows.length > 0;

  const getDefaultLeaves = (r) => {
    const key = normId(r.employeeid);
    const computed = Number(leavesMap[key] || 0);
    if (Number.isFinite(computed)) return computed;
    const fromRow = Number(r.leaves_taken);
    return Number.isFinite(fromRow) ? fromRow : 0;
  };

  // NEW: default for Leaves C/f from EmployeeTable."Leaves_cf"
  const getCarryForwardDefault = (r) => {
    const aux = empMap[normId(r.employeeid)] || {};
    const fromEmp = Number(aux.leaves_cf);
    if (Number.isFinite(fromEmp)) return fromEmp;
    const fromRow = Number(r.leaves_cf_new);
    if (Number.isFinite(fromRow)) return fromRow;
    return 0;
  };

  // NEW: default for Late Logins adjustment (from API)
  const getLateAdjDefault = (r) => {
    const key = normId(r.employeeid);
    if (key && lateAdjMap[key] != null) {
      const n = Number(lateAdjMap[key]);
      if (Number.isFinite(n)) return n;
    }
    const fromRow = Number(r.late_adj_days);
    return Number.isFinite(fromRow) ? fromRow : 0;
  };

  /* ---------- Inline edit orchestration ---------- */
  const startEdit = (row) => {
    const id = row.employeeid;
    setDraft((d) => {
      const exists = d[id];
      const init = exists || {
        leaves_taken: String(getDefaultLeaves(row)),
        late_adj_days: String(getLateAdjDefault(row)), // <- prefills from API
        lop_days: String(row.lop_days ?? ""),
        // prefill from EmployeeTable master if present
        leaves_cf_new: String(getCarryForwardDefault(row)),
      };
      setEditBackup((b) => ({ ...b, [id]: { ...init } }));
      return { ...d, [id]: init };
    });
    setEditingId(id);
  };

  const cancelEdit = (id) => {
    setDraft((d) => {
      const next = { ...d };
      if (editBackup[id]) next[id] = { ...editBackup[id] };
      return next;
    });
    setEditBackup((b) => {
      const n = { ...b };
      delete n[id];
      return n;
    });
    setEditingId(null);
  };

  const saveEdit = (id) => {
    setEditBackup((b) => {
      const n = { ...b };
      delete n[id];
      return n;
    });
    setEditingId(null);
  };

  const handleDraftChange = (employeeid, key, value) => {
    setDraft((d) => ({
      ...d,
      [employeeid]: { ...(d[employeeid] || {}), [key]: value },
    }));
  };

  /* ---------- Submit orchestration ---------- */
 const submitAll = async () => {
  if (!readyToSubmit || submitting) return;

  // Only submit for ASF -> asfho
  const isASF = String(hr.company || "").trim().toUpperCase() === "ASF";
  if (!isASF) {
    Swal.fire({
      icon: "info",
      title: "Not ASF",
      text: "Submission is enabled only for ASF (asfho) right now."
    });
    return;
  }

  try {
    setSubmitting(true);
    const ok = await Swal.fire({
      icon: "question",
      title: `Submit ${humanMonth(month)} to Finance?`,
      text: "These rows will be saved to the ASFHO table.",
      showCancelButton: true,
      confirmButtonText: "Submit",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);

    if (!ok) { setSubmitting(false); return; }

    const rowsPayload = mergedRows.map((r) => {
      const d = draft[r.employeeid] || {
        leaves_taken: String(getDefaultLeaves(r)),
        late_adj_days: String(getLateAdjDefault(r)),
        lop_days: String(r.lop_days ?? ""),
        leaves_cf_new: String(getCarryForwardDefault(r)),
      };

      const leavesTaken = Number(d.leaves_taken || 0);
      const lateAdj     = Number(d.late_adj_days || 0);
      const lop         = Number(d.lop_days || 0);

      // Integer working_days for DB:
      const workingDays = Math.max(
        0,
        Math.floor(actualWorkingDays - (leavesTaken + lateAdj + lop))
      );

      return {
        employeeid: r.employeeid,
        name: r.name || "",
        doj: justDate(r.doj) || null,
        designation: r.designation || null,
        gross_salary: Number.isFinite(Number(r.salary_per_month))
          ? Number(r.salary_per_month)
          : null,

        actual_working_days: actualWorkingDays,
        current_month_eligibility: Number(r.current_month_eligibility || 0),
        leaves_taken: leavesTaken,
        late_adj_days: lateAdj,
        lop_days: lop,
        leaves_cf: Number(d.leaves_cf_new || 0),
        working_days: workingDays,
      };
    });

    const resp = await fetch("/api/finance/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        month,
        company: hr.company, // must be "ASF"
        rows: rowsPayload,
      }),
    });

    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(j?.error || "Submit failed");

    await Swal.fire({
      icon: "success",
      title: "Submitted",
      text: `Saved ${j.saved} row(s) to ASFHO.`,
      confirmButtonColor: "#C1272D",
    });
  } catch (e) {
    Swal.fire({ icon: "error", title: "Submit failed", text: e.message || "Something went wrong" });
  } finally {
    setSubmitting(false);
  }
};

  /* ---------- Columns ---------- */
  const cols = [
    { key: "sno", label: "Sl no", w: "w-16" },
    { key: "name", label: "Name", w: "min-w-[220px]" },
    { key: "employeeid", label: "EMP ID", w: "w-28" },
    { key: "doj", label: "Date of Joining", w: "w-40" },
    { key: "designation", label: "Designation", w: "min-w-[220px]" },
    { key: "salary_per_month", label: "Gross Salary", w: "w-40", align: "text-right" },
    { key: "actual_working_days", label: "Actual Working Days", w: "w-40", align: "text-center" },
    { key: "current_month_eligibility", label: "Current Month Leave Eligibility", w: "w-48", align: "text-center" },
    { key: "leaves_taken", label: "Leaves Taken in this month", w: "w-40", align: "text-center", editable: true },
    { key: "late_adj_days", label: "Late Logins adj in leaves", w: "w-44", align: "text-center", editable: true },
    { key: "lop_days", label: "LOP", w: "w-24", align: "text-center", editable: true },
    { key: "leaves_cf_new", label: "Leaves C/f", w: "w-28", align: "text-center", editable: true },
    { key: "present_days", label: "Working Days", w: "w-28", align: "text-center" },
    { key: "_actions", label: "Actions", w: "w-32", align: "text-right" },
  ];

  /* ---------- Render ---------- */
  return (
    <>
      <Head>
        <title>Attendance Summary</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <AppHeader
          currentPath="/AttendanceSummary"
          hrName={hr.name || "HR"}
          hrCompany={hr.company || ""}
          onProfileSaved={(u) => {
            const nextCompany = String(u?.company || "").trim();
            const by = hr.id;
            try {
              localStorage.setItem(companyKey(by), nextCompany);
              document.cookie = `hr_company_${encodeURIComponent(by)}=${encodeURIComponent(nextCompany)}; Path=/; Max-Age=31536000; SameSite=Lax`;
              window.dispatchEvent(new CustomEvent("hr-company-changed", { detail: { company: nextCompany, by } }));
            } catch {}
            setHr((prev) => ({ ...prev, name: u?.name || prev.name, company: nextCompany }));
          }}
        />

        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">Attendance Summary</h1>
              <p className="text-sm text-gray-600">
                {hr.company ? <>Company: <span className="font-medium">{hr.company}</span> • </> : null}
                {hr.location ? <>Location: <span className="font-medium">{hr.location}</span> • </> : null}
                Period: {humanMonth(month)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  const v = e.target.value;
                  setMonth(v);
                  // keep URL in sync
                  router.replace({ pathname: router.pathname, query: { ...router.query, month: v } }, undefined, { shallow: true });
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button onClick={fetchSummary} disabled={meLoading} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60">
                Refresh
              </button>
              <button
                onClick={submitAll}
                disabled={!readyToSubmit || submitting}
                title={!readyToSubmit ? "Data still loading" : ""}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${readyToSubmit && !submitting ? "bg-[#C1272D] hover:bg-[#a02125]" : "bg-gray-300 cursor-not-allowed"}`}
              >
                {submitting ? "Submitting…" : "Submit to Finance"}
              </button>
            </div>
          </div>

          {!(loading || empsLoading || leavesLoading || lateAdjLoading) && !mergedRows.length ? (
            <div className="text-sm text-gray-600 border border-gray-200 bg-white rounded-xl p-6">
              No data for {humanMonth(month)}.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 bg-white rounded-2xl shadow-sm">
              <div className="relative max-h-[75vh] overflow-auto">
                <table className="min-w-[1280px] w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10">
                    <tr>
                      {cols.map((c) => (
                        <th key={c.key} className={`px-3 py-2 border-b ${c.w || ""} ${c.align || ""}`}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(loading || empsLoading || leavesLoading || lateAdjLoading) ? (
                      <tr>
                        <td colSpan={cols.length} className="px-3 py-8 text-center text-gray-500">
                          <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                          Loading…
                        </td>
                      </tr>
                    ) : (
                      mergedRows.map((r, i) => {
                        const id = r.employeeid;
                        const isEditing = editingId === id;
                        const d = draft[id] || {
                          leaves_taken: String(getDefaultLeaves(r)),
                          late_adj_days: String(getLateAdjDefault(r)), // <- display prefilled value
                          lop_days: String(r.lop_days ?? ""),
                          // <- here we show EmployeeTable carry-forward by default
                          leaves_cf_new: String(getCarryForwardDefault(r)),
                        };
                        const leavesTakenNum = Number.isFinite(Number(d.leaves_taken)) ? Number(d.leaves_taken) : 0;
                        const workingDays = Math.max(0, actualWorkingDays - leavesTakenNum);

                        return (
                          <tr key={id || i} className="odd:bg-white even:bg-gray-50">
                            {cols.map((c) => {
                              if (c.key === "sno") return <td key={c.key} className={`px-3 py-2 border-t ${c.align || ""}`}>{i + 1}</td>;
                              if (c.key === "_actions") {
                                return (
                                  <td key={c.key} className={`px-3 py-2 border-t ${c.align || ""}`}>
                                    {!isEditing ? (
                                      <button
                                        onClick={() => startEdit(r)}
                                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                      >
                                        Edit
                                      </button>
                                    ) : (
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => saveEdit(id)}
                                          className="inline-flex items-center rounded-md bg-[#C1272D] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#a02125]"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => cancelEdit(id)}
                                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                );
                              }

                              if (c.editable) {
                                const value = d[c.key] ?? "";
                                return (
                                  <td key={c.key} className={`px-3 py-1.5 border-t ${c.align || ""}`}>
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        step={c.key === "leaves_taken" ? "0.5" : "1"}
                                        value={value}
                                        onChange={(e) => handleDraftChange(id, c.key, e.target.value)}
                                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
                                        placeholder="0"
                                      />
                                    ) : (
                                      <span>{value === "" ? "-" : value}</span>
                                    )}
                                  </td>
                                );
                              }

                              let val = r[c.key];
                              if (c.key === "doj") val = ddmmyyyy(val);
                              if (c.key === "salary_per_month") {
                                if (val == null || val === "") val = "-";
                                else if (typeof val === "number" && Number.isFinite(val)) val = val.toLocaleString();
                                else if (!Number.isNaN(Number(val))) val = Number(val).toLocaleString();
                                else val = String(val);
                              }
                              if (c.key === "actual_working_days") val = actualWorkingDays;
                              if (c.key === "leaves_taken") val = d.leaves_taken === "" ? "-" : d.leaves_taken;
                              if (c.key === "leaves_cf_new") val = d.leaves_cf_new === "" ? "-" : d.leaves_cf_new;
                              if (c.key === "late_adj_days") val = d.late_adj_days === "" ? "-" : d.late_adj_days;
                              if (c.key === "present_days") val = workingDays;

                              return <td key={c.key} className={`px-3 py-2 border-t ${c.align || ""}`}>{val ?? "-"}</td>;
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-600">
            {readyToSubmit ? (
              <span className="text-emerald-700">You can submit when your inline edits are complete.</span>
            ) : (
              <span className="text-amber-700">Loading data…</span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
