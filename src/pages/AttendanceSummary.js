import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Swal from "sweetalert2";
import AppHeader from "@/components/AppHeader";

/* ---------------- Utilities ---------------- */
function prevMonthYYYYMM() {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}
function humanMonth(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(String(yyyyMm))) return "-";
  const [y, m] = yyyyMm.split("-");
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

/* per-user company key */
const companyKey = (empId) => `hr_company_${String(empId || "anon")}`;

export default function AttendanceSummary() {
  const [hr, setHr] = useState({ id: "", name: "HR", company: "" });
  const [meLoading, setMeLoading] = useState(true);

  const [month, setMonth] = useState(prevMonthYYYYMM());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [missingDays, setMissingDays] = useState(0);

  const [emps, setEmps] = useState([]);
  const [empsLoading, setEmpsLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    leaves_taken: "", late_adj_days: "", lop_days: "", leaves_cf_new: "", present_days: "",
  });
  const [savingRow, setSavingRow] = useState(false);

  /* ✅ Resolve current user and authoritative company */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Server says who I am
        let me = {};
        try {
          const r = await fetch("/api/me", { credentials: "include" });
          me = (await r.json().catch(() => ({}))) || {};
        } catch {}

        // 2) Find id (server cookie or LS)
        let id =
          me.employeeid ||
          (typeof window !== "undefined" ? localStorage.getItem("hr_employeeid") : "") ||
          "";

        // 3) Prefer DB company (from /api/me if present)
        let resolvedCompany = (me.company || "").trim();

        // 4) If still missing or generic default, fetch DB by id
        if ((!resolvedCompany || resolvedCompany === "ASF") && id) {
          try {
            const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { credentials: "include" });
            const j = await r.json().catch(() => ({}));
            if (r.ok && Array.isArray(j?.data) && j.data.length) {
              const dbCompany = (j.data[0]?.company || "").trim();
              if (dbCompany) resolvedCompany = dbCompany;
            }
          } catch {}
        }

        // 5) Namespaced LS fallback
        if (!resolvedCompany && id && typeof window !== "undefined") {
          resolvedCompany = (localStorage.getItem(companyKey(id)) || "").trim();
        }

        // 6) Final default
        if (!resolvedCompany) resolvedCompany = "ASF";

        const resolvedName = me.name || "HR";

        // Persist namespaced + broadcast for THIS user only
        try {
          localStorage.setItem(companyKey(id), resolvedCompany);
          document.cookie = `hr_company_${encodeURIComponent(id)}=${encodeURIComponent(resolvedCompany)}; Path=/; Max-Age=31536000; SameSite=Lax`;
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("hr-company-changed", { detail: { company: resolvedCompany, by: id } }));
          }
        } catch {}

        if (!cancelled) setHr({ id, name: resolvedName, company: resolvedCompany });
      } catch {
        if (!cancelled) setHr({ id: "", name: "HR", company: "ASF" });
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Only accept cross-tab changes for THIS user
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
      if (det.by && det.by !== hr.id) return; // ignore other users
      const next = String(det.company || "").trim();
      if (next) setHr((h) => ({ ...h, company: next }));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("hr-company-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("hr-company-changed", onCustom);
    };
  }, [hr.id]);

  /* ---------------- Fetch EmployeeTable for this company ---------------- */
  const fetchEmps = async () => {
    if (!hr.company) { setEmps([]); return; }
    try {
      setEmpsLoading(true);
      const r = await fetch(`/api/users?company=${encodeURIComponent(hr.company)}`, { credentials: "include" });
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
  useEffect(() => {
    if (!meLoading) fetchEmps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading, hr.company]);

  /* ---------------- Fetch Attendance Summary ---------------- */
  const fetchSummary = async () => {
    if (!hr.company) { setRows([]); setComplete(false); setMissingDays(0); return; }
    try {
      setLoading(true);
      const url = `/api/attendance/summary?month=${encodeURIComponent(month)}&company=${encodeURIComponent(hr.company)}`;
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
  useEffect(() => {
    if (meLoading) return;
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading, month, hr.company]);

  /* ---------------- Merge + rules ---------------- */
  const empMap = useMemo(() => {
    const m = {};
    for (const u of emps || []) {
      const key = normId(u.employeeid ?? u.id);
      if (!key) continue;
      m[key] = {
        name: u.name ?? "",
        doj: justDate(u.doj ?? ""),
        designation: u.designation ?? "",
        grosssalary: u.grossSalary ?? u.grosssalary ?? u.gross_salary ?? "",
        company: (u.company ?? "").trim(),
        probationYes: String(u.probation ?? "").trim().toLowerCase() === "yes",
      };
    }
    return m;
  }, [emps]);

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
        _resolved_company: (r.company ?? aux.company ?? "").trim(),
      };
    });

    const cmp = (hr.company || "").trim().toLowerCase();
    return scoped.filter((r) => String(r._resolved_company || "").trim().toLowerCase() === cmp);
  }, [rows, empMap, hr.company]);

  const anyLoading = loading || empsLoading;
  const allDaysSubmitted = useMemo(() => {
    if (anyLoading) return false;
    if (Number(missingDays || 0) > 0) return false;
    return !mergedRows.some((r) => Number(r?.missing_days || 0) > 0);
  }, [anyLoading, missingDays, mergedRows]);

  const readyToSubmit = !meLoading && !anyLoading && mergedRows.length > 0 && allDaysSubmitted;

  /* ---------------- Inline edit ---------------- */
  const startEdit = (row) => {
    setEditingId(row.employeeid);
    setEditDraft({
      leaves_taken: String(row.leaves_taken ?? ""),
      late_adj_days: String(row.late_adj_days ?? ""),
      lop_days: String(row.lop_days ?? ""),
      leaves_cf_new: String(row.leaves_cf_new ?? ""),
      present_days: String(row.present_days ?? ""),
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ leaves_taken: "", late_adj_days: "", lop_days: "", leaves_cf_new: "", present_days: "" });
  };
  const saveEdit = async (employeeid) => {
    try {
      setSavingRow(true);
      const updates = {
        leaves_taken: toNumOrNull(editDraft.leaves_taken),
        late_adj_days: toNumOrNull(editDraft.late_adj_days),
        lop_days: toNumOrNull(editDraft.lop_days),
        leaves_cf_new: toNumOrNull(editDraft.leaves_cf_new),
        present_days: toNumOrNull(editDraft.present_days),
      };
      for (const [k, v] of Object.entries(updates)) {
        if (v != null && v < 0) {
          Swal.fire({ icon: "error", title: "Invalid value", text: `${k.replaceAll("_", " ")} cannot be negative.` });
          setSavingRow(false);
          return;
        }
      }
      const res = await fetch("/api/attendance/summary/update", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, employeeid, updates }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Update failed");
      await fetchSummary();
      cancelEdit();
      Swal.fire({ icon: "success", title: "Saved", text: "Row updated successfully.", confirmButtonColor: "#C1272D" });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Update failed", text: e.message || "Something went wrong" });
    } finally {
      setSavingRow(false);
    }
  };

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
    { key: "present_days", label: "Working Days", w: "w-28", align: "text-center", editable: true },
    { key: "_actions", label: "Actions", w: "w-32", align: "text-right" },
  ];

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
          hrCompany={hr.company || ""}   // <- single source of truth for the badge
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
                Company: <span className="font-medium">{hr.company || "—"}</span> • Period: {humanMonth(month)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button onClick={fetchSummary} disabled={meLoading} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60">
                Refresh
              </button>
              <button
                onClick={async () => {
                  if (!readyToSubmit) return;
                  try {
                    const ok = await Swal.fire({
                      icon: "question",
                      title: `Submit ${humanMonth(month)} to Finance?`,
                      text: "This will freeze the snapshot for the month.",
                      showCancelButton: true,
                      confirmButtonText: "Submit",
                      confirmButtonColor: "#C1272D",
                    }).then((r) => r.isConfirmed);
                    if (!ok) return;
                    const r = await fetch("/api/attendance/submit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ month, company: hr.company || undefined }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error(j?.error || "Submit failed");
                    Swal.fire({ icon: "success", title: "Submitted", text: `Saved ${j.saved} rows to ${hr.company || "your company"}.`, confirmButtonColor: "#C1272D" });
                  } catch (e) {
                    Swal.fire({ icon: "error", title: "Submit failed", text: e.message || "Something went wrong" });
                  }
                }}
                disabled={!readyToSubmit}
                title={!readyToSubmit ? "Enabled only when all days are complete" : ""}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${readyToSubmit ? "bg-[#C1272D] hover:bg-[#a02125]" : "bg-gray-300 cursor-not-allowed"}`}
              >
                Submit to Finance
              </button>
            </div>
          </div>

          {!(loading || empsLoading) && !mergedRows.length ? (
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
                    {loading || empsLoading ? (
                      <tr>
                        <td colSpan={cols.length} className="px-3 py-8 text-center text-gray-500">
                          <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                          Loading…
                        </td>
                      </tr>
                    ) : (
                      mergedRows.map((r, i) => {
                        const isEditing = editingId === r.employeeid;
                        return (
                          <tr key={r.employeeid || i} className="odd:bg-white even:bg-gray-50">
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
                                          onClick={() => saveEdit(r.employeeid)}
                                          disabled={savingRow}
                                          className="inline-flex items-center rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                                        >
                                          {savingRow ? "Saving…" : "Save"}
                                        </button>
                                        <button
                                          onClick={cancelEdit}
                                          disabled={savingRow}
                                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                );
                              }
                              if (c.editable && isEditing) {
                                const k = c.key;
                                return (
                                  <td key={c.key} className={`px-3 py-1.5 border-t ${c.align || ""}`}>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={editDraft[k]}
                                      onChange={(e) => setEditDraft((d) => ({ ...d, [k]: e.target.value }))}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
                                      placeholder="0"
                                    />
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
              <span className="text-emerald-700">✓ All days are complete. You can submit.</span>
            ) : (
              <span className="text-amber-700">Month incomplete. Missing entries across employees: {missingDays}.</span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
