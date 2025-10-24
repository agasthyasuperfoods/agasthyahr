// src/pages/Hrdashboard.js
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AppHeader from "../components/AppHeader";
import { Pencil, Trash2 } from "lucide-react";

/**
 * Full HR Dashboard (single file)
 * - Includes NATURE'S WELLNESS and SRI CHAKRA MILK (SCM) support
 * - Robust preview parser that normalizes many Excel export shapes
 * - Groups preview rows by company, sorts inside each company by numeric part of employeeid
 * - Computes Work (h:mm) when In/Out present, allows override via input
 */

// Constants
const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];
const COMPANY_OPTIONS = [
  "ASF",
  "AGB",
  "ASF-FACTORY",
  "ANM",
  "AVION",
  "SRI CHAKRA MILK",
  "NATURE'S WELLNESS",
];

// helper date functions
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function prevMonthYYYYMM() {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}
function toHumanDate(yyyyMmDd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || "")) return "-";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}
function toHumanMonth(yyyyMm) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm || "")) return "-";
  const [y, m] = yyyyMm.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
}

// normalize Employee ID for lookup
const normId = (s) =>
  String(s ?? "").trim().replace(/\s+/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const idVariants = (raw) => {
  const base = normId(raw);
  const digits = base.replace(/[^0-9]/g, "");
  const noZeros = digits.replace(/^0+/, "") || (digits ? "0" : "");
  const set = new Set();
  if (base) set.add(base);
  if (digits) set.add(digits);
  if (noZeros) set.add(noZeros);
  return Array.from(set);
};

// TIME helpers: parse HH:MM -> minutes, minutes -> H:MM string
const parseHHMMToMinutes = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};
const minutesToHumanHMM = (mins) => {
  if (mins == null || !Number.isFinite(mins)) return "";
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = Math.abs(total % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};

// statusClass used earlier
const statusClass = (s) => {
  const v = String(s || "").trim().toLowerCase();
  if (v === "present" || v === "p") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "absent" || v === "a") return "bg-red-50 text-red-700 border-red-200";
  if (v === "leave" || v === "l") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-white text-gray-800 border-gray-300";
};

export default function Hrdashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  // Auth / HR
  const [hrName, setHrName] = useState("");
  const [hrUser, setHrUser] = useState(null);

  // Attendance preview/upload
  const [uploadDate, setUploadDate] = useState(todayIso());
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // existing rows for date
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);

  // ANM
  const [anmDate, setAnmDate] = useState(todayIso());
  const [anmSite, setAnmSite] = useState(null);
  const [showAnmPreview, setShowAnmPreview] = useState(false);
  const [anmSubmitted, setAnmSubmitted] = useState({ tandur: false, talakondapally: false });

  // Paysheet month default previous month
  const [reportMonth, setReportMonth] = useState(() => prevMonthYYYYMM());

  // page/search
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  // default 50 rows
  const [pageSize, setPageSize] = useState(50);

  // auth ready
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hrAuth = localStorage.getItem("hr_auth") === "1";
    const role = localStorage.getItem("hr_role");
    const ok = hrAuth || role === "HR";
    if (!ok) {
      router.replace("/Hlogin");
      return;
    }
    setReady(true);
    // set hrName if stored
    const name = localStorage.getItem("hr_name") || "";
    setHrName(name);
    const userObj = localStorage.getItem("hr_user");
    if (userObj) {
      try { setHrUser(JSON.parse(userObj)); } catch {}
    }
  }, [router]);

  // load users
  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUsersError("");
      const res = await fetch("/api/users");
      const j = await res.json().catch(() => ({}));
      // server returns { data: [...] } or array; be flexible
      const arr = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : j?.data || []);
      setUsers(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setUsersError(e.message || "Failed to load users");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    loadUsers();
    fetchAnmSubmittedStatuses(anmDate).catch(() => {});
  }, [ready, loadUsers]); // eslint-disable-line

  // idToName map for manager resolution
  const { idToName } = useMemo(() => {
    const n = {};
    for (const u of users || []) {
      for (const k of idVariants(u.employeeid)) {
        if (u.name && !n[k]) n[k] = u.name;
      }
    }
    return { idToName: n };
  }, [users]);

  const resolveManagerName = (rawId) => {
    if (!rawId) return "";
    for (const k of idVariants(rawId)) {
      if (idToName[k]) return idToName[k];
    }
    return "";
  };

  const dateMax = useMemo(() => todayIso(), []);

  // refresh daily
  const refreshDailyForDate = async (date) => {
    try {
      setDailyLoading(true);
      setPreviewRows([]);
      setHasData(false);
      setExistingCount(0);
      setDailyRows([]);

      const res = await fetch(`/api/attendance/check?date=${encodeURIComponent(date)}`);
      const cj = await res.json().catch(() => ({}));
      const has = !!cj?.hasData;
      const cnt = Number(cj?.count || 0);
      setHasData(has);
      setExistingCount(cnt);

      if (has) {
        const r2 = await fetch(`/api/attendance/daily?date=${encodeURIComponent(date)}`);
        const j2 = await r2.json().catch(() => ({}));
        setDailyRows(Array.isArray(j2?.rows) ? j2.rows : []);
      }
    } catch (e) {
      setHasData(false);
      setExistingCount(0);
      setDailyRows([]);
      console.warn("refreshDailyForDate error:", e?.message || e);
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !uploadDate) return;
    refreshDailyForDate(uploadDate);
  }, [ready, uploadDate]);

  // fetch ANM submitted statuses
  const fetchAnmSubmittedStatuses = useCallback(async (date) => {
    try {
      const r = await fetch(`/api/attendance/anm/status?date=${encodeURIComponent(date)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed fetching ANM statuses");
      const sites = j?.sites || {};
      const tand = sites?.tandur ?? j?.tandur ?? null;
      const tal = sites?.talakondapally ?? j?.talakondapally ?? j?.talak ?? null;
      const isSubmitted = (v) => v != null && String(v).trim().toLowerCase() === "submitted";
      setAnmSubmitted({ tandur: isSubmitted(tand), talakondapally: isSubmitted(tal) });
    } catch (e) {
      console.warn("fetchAnmSubmittedStatuses:", e?.message || e);
      setAnmSubmitted({ tandur: false, talakondapally: false });
    }
  }, []);

  useEffect(() => {
    if (!ready || !anmDate) return;
    fetchAnmSubmittedStatuses(anmDate);
  }, [ready, anmDate, fetchAnmSubmittedStatuses]);

  // Parse preview upload
  const onParse = async (e) => {
    e.preventDefault();
    if (!uploadDate) {
      Swal.fire({ icon: "warning", title: "Pick a date", text: "Please select the attendance date." });
      return;
    }
    if (uploadDate > dateMax) {
      Swal.fire({ icon: "warning", title: "Invalid date", text: "Future dates are not allowed." });
      return;
    }
    if (!file) {
      Swal.fire({ icon: "warning", title: "No file", text: "Choose a .xlsx, .xls or .csv file." });
      return;
    }
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      form.append("report_date", uploadDate);
      const res = await fetch("/api/attendance/preview", { method: "POST", body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Preview failed");
      // Expect server returns rows as array of objects; our PreviewDailyModal will normalize them further
      setPreviewRows(Array.isArray(j?.rows) ? j.rows : []);
      Swal.fire({ icon: "success", title: "Parsed", text: `Found ${j?.count ?? (Array.isArray(j?.rows) ? j.rows.length : 0)} rows for ${toHumanDate(uploadDate)}.` });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Preview failed", text: err?.message || "Something went wrong" });
    } finally {
      setUploading(false);
    }
  };

  // Delete employee
  const onDelete = async (employeeid) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: "Delete employee?",
      text: `This will permanently delete #${employeeid}.`,
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (!ok) return;
    try {
      const res = await fetch(`/api/users?id=${employeeid}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete");
      Swal.fire({ icon: "success", title: "Deleted", text: `Employee #${employeeid} deleted.` });
      await loadUsers();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e?.message || "Something went wrong" });
    }
  };

  // Employees filtering/pagination
  const filteredUsers = useMemo(() => {
    const qRaw = String(searchQuery || "").trim();
    if (!qRaw) return users;
    const q = qRaw.toLowerCase();

    return users.filter((u) => {
      // If query is an ID or numeric, match using idVariants
      try {
        const empIdVariants = idVariants(u.employeeid);
        // check id variants against query
        for (const v of empIdVariants) {
          if (String(v || "").toLowerCase().includes(q)) return true;
        }
      } catch (e) { /* ignore */ }

      // also check common fields
      const fields = [u.employeeid, u.name, u.email, u.role, u.company, u.number];
      return fields.some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [users, searchQuery]);

  const total = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedUsers = useMemo(() => {
    const s = (page - 1) * pageSize;
    return filteredUsers.slice(s, s + pageSize);
  }, [filteredUsers, page, pageSize]);

  // UI ready guard
  if (!ready) {
    return (
      <>
        <Head>
          <title>HR • Agasthya Super Foods</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center text-gray-600">
          <span className="inline-block h-6 w-6 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>HR Dashboard • Agasthya Super Foods</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <AppHeader
          currentPath={router.pathname}
          hrName={hrName}
          hrUser={hrUser}
          onLogout={async () => {
            if (typeof window !== "undefined") {
              localStorage.removeItem("hr_auth");
              localStorage.removeItem("hr_role");
              localStorage.removeItem("hr_name");
              localStorage.removeItem("hr_email");
              localStorage.removeItem("hr_employeeid");
            }
            await router.push("/Hlogin");
            if (typeof window !== "undefined") window.location.replace("/Hlogin");
          }}
        />

        <div className="space-y-8 p-4 md:p-8">
          {/* Intro */}
          <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{`Welcome, ${hrName || "HR"}`}</h2>
            <p className="text-sm text-gray-600">Manage employees and attendance. Generate monthly paysheets for Finance.</p>
            <div className="mt-4">
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center rounded-lg bg-[#C1272D] px-3 py-2 text-sm font-medium text-white hover:bg-[#a02125]"
              >
                + Onboard Employee
              </button>
            </div>
          </div>

          {/* Attendance & ANM */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Attendance</h3>
              <p className="text-xs text-gray-500">Upload biometric file or view ANM farms (Tandur/Talakondapally)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upload */}
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Agasthya Biometric</h4>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">Report Date</label>
                  <input
                    type="date"
                    value={uploadDate}
                    max={dateMax}
                    onChange={(e) => {
                      setUploadDate(e.target.value);
                      setPreviewRows([]);
                    }}
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="mt-1 text-xs text-gray-600">{toHumanDate(uploadDate)}</div>

                  {dailyLoading ? (
                    <div className="mt-1 text-xs text-gray-500">Checking existing data…</div>
                  ) : hasData ? (
                    <div className="mt-1 text-xs text-emerald-700">Existing records found: {existingCount}</div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No existing records for this date yet.</div>
                  )}
                </div>

                <form onSubmit={onParse} className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full max-w-xs text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex items-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </form>

                <button
                  type="button"
                  disabled={!previewRows.length && !dailyRows.length}
                  onClick={() => setShowPreview(true)}
                  className={`mt-3 inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
                    (previewRows.length || dailyRows.length) ? "bg-[#C1272D] text-white hover:bg-[#a02125]" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {previewRows.length ? "View & Submit" : hasData ? "Update" : "View & Submit"}
                </button>
              </div>

              {/* ANM farms */}
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900">ANM FARMS</h4>
                <p className="text-xs text-gray-500 mb-3">Daily attendance view for Tandur & Talakondapally</p>
                <label className="block text-sm font-medium text-gray-700">Report Date</label>
                <input
                  type="date"
                  value={anmDate}
                  max={dateMax}
                  onChange={(e) => setAnmDate(e.target.value)}
                  className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="mt-1 text-xs text-gray-600">{toHumanDate(anmDate)}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!anmDate) { Swal.fire({ icon: "warning", title: "Pick a date", text: "Please select the date." }); return; }
                      setAnmSite("tandur");
                      setShowAnmPreview(true);
                    }}
                    className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm ${anmSubmitted.tandur ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-[#C1272D] text-white hover:bg-[#a02125]"}`}
                  >
                    {anmSubmitted.tandur ? "Submitted ✓ (Tandur)" : "View & Submit (Tandur)"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!anmDate) { Swal.fire({ icon: "warning", title: "Pick a date", text: "Please select the date." }); return; }
                      setAnmSite("talakondapally");
                      setShowAnmPreview(true);
                    }}
                    className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm ${anmSubmitted.talakondapally ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-[#C1272D] text-white hover:bg-[#a02125]"}`}
                  >
                    {anmSubmitted.talakondapally ? "Submitted ✓ (Talakondapally)" : "View & Submit (Talakondapally)"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Monthly Paysheet cards (ASF, Tandur, Talakondapally) */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Monthly Paysheet</h3>
              <p className="text-xs text-gray-500">Choose month and site → View / Export to Excel</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <PaysheetCard company="ASF" name="Head Office (ASF)" reportMonth={reportMonth} setReportMonth={setReportMonth} router={router} />
              <PaysheetCard company="TANDUR" name="Tandur" reportMonth={reportMonth} setReportMonth={setReportMonth} router={router} />
              <PaysheetCard company="TALAKONDAPALLY" name="Talakondapally" reportMonth={reportMonth} setReportMonth={setReportMonth} router={router} />
            </div>
          </section>

          {/* Employees table */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Employees</h3>
                <p className="text-xs text-gray-500">Create / edit / remove employees</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, id, email..."
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
              <div className="relative max-h-[60vh] overflow-auto">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2 border-b">Employee ID</th>
                      <th className="px-3 py-2 border-b">Full name</th>
                      <th className="px-3 py-2 border-b">Email</th>
                      <th className="px-3 py-2 border-b">Role</th>
                      <th className="px-3 py-2 border-b">DOJ</th>
                      <th className="px-3 py-2 border-b">Phone</th>
                      <th className="px-3 py-2 border-b">Company</th>
                      <th className="px-3 py-2 border-b">Reporting To</th>
                      <th className="px-3 py-2 border-b">Designation</th>
                      <th className="px-3 py-2 border-b">Address</th>
                      <th className="px-3 py-2 border-b text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                          <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                          Loading employees…
                        </td>
                      </tr>
                    ) : usersError ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-red-600">{usersError}</td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                          {users.length === 0 ? <>No employees. Click <span className="font-medium">Onboard Employee</span> to add one.</> : <>No matches for <span className="font-semibold">“{searchQuery}”</span>.</>}
                        </td>
                      </tr>
                    ) : (
                      pagedUsers.map((u) => (
                        <tr key={u.employeeid} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2 border-t">{u.employeeid ?? "-"}</td>
                          <td className="px-3 py-2 border-t">{u.name || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.email || "-"}</td>
                          <td className="px-3 py-2 border-t"><span className="rounded bg-gray-100 px-2 py-0.5">{u.role || "-"}</span></td>
                          <td className="px-3 py-2 border-t">{u.doj || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.number || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.company || "-"}</td>
                          <td className="px-3 py-2 border-t whitespace-nowrap">
                            <div className="text-gray-900">{resolveManagerName(u.reporting_to_id) || "—"}</div>
                            <div className="text-[11px] text-gray-500">{u.reporting_to_id || "-"}</div>
                          </td>
                          <td className="px-3 py-2 border-t">{u.designation || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.address || "-"}</td>
                          <td className="px-3 py-2 border-t text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => { setEditEmployee(u); setShowEdit(true); }}
                                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                title="Edit employee"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onDelete(u.employeeid)}
                                className="p-2 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                title="Delete employee"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t bg-white px-3 py-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{total === 0 ? 0 : (page - 1) * pageSize + 1}</span>–<span className="font-medium">{Math.min(total, page * pageSize)}</span> of <span className="font-medium">{total}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Prev
                    </button>

                    {Array.from({ length: Math.max(1, Math.ceil(total / pageSize)) }, (_, i) => i + 1).slice(0, 7).map((p) => (
                      <button
                        key={p}
                        className={`px-3 py-2 text-sm rounded-lg border ${p === page ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white hover:bg-gray-50"}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </section>
        </div>

        {/* Modals */}
        {showCreate && (
          <CreateEmployeeModal
            idToName={idToName}
            onClose={() => setShowCreate(false)}
            onCreated={async () => { setShowCreate(false); await loadUsers(); Swal.fire({ icon: "success", title: "Employee created" }); }}
          />
        )}

        {showEdit && editEmployee && (
          <EditEmployeeModal
            idToName={idToName}
            employee={editEmployee}
            onClose={() => { setShowEdit(false); setEditEmployee(null); }}
            onUpdated={async () => { setShowEdit(false); setEditEmployee(null); await loadUsers(); Swal.fire({ icon: "success", title: "Employee updated" }); }}
          />
        )}

        {showPreview && (previewRows.length || dailyRows.length) && (
          <PreviewDailyModal
            date={uploadDate}
            rows={previewRows.length ? previewRows : dailyRows}
            onClose={() => setShowPreview(false)}
            onSaved={async (j) => {
              setShowPreview(false);
              setPreviewRows([]);
              setReportMonth(uploadDate.slice(0, 7));
              Swal.fire({ icon: "success", title: "Saved", text: `Saved ${j?.saved ?? 0} rows for ${toHumanDate(uploadDate)}.` });
              await refreshDailyForDate(uploadDate);
            }}
          />
        )}

        {showAnmPreview && anmSite && (
          <AnmPreviewDailyModal
            site={anmSite}
            date={anmDate}
            onClose={() => { setShowAnmPreview(false); setAnmSite(null); fetchAnmSubmittedStatuses(anmDate).catch(() => {}); }}
            onSaved={() => { setAnmSubmitted((s) => ({ ...s, [anmSite]: true })); fetchAnmSubmittedStatuses(anmDate).catch(() => {}); }}
          />
        )}
      </main>
    </>
  );
}

/* -------------------------
   Paysheet Card
   - Note: Nature's Wellness intentionally not shown as a paysheet card.
   ------------------------- */
function PaysheetCard({ company, name, reportMonth, setReportMonth, router }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{name}</h4>
      <div className="flex items-center gap-3">
        <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <span className="text-sm text-gray-600">{toHumanMonth(reportMonth)}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => router.push(`/Paysheet?company=${company}&month=${reportMonth}`)} className="inline-flex items-center rounded-lg bg-[#C1272D] px-3 py-2 text-sm font-medium text-white hover:bg-[#a02125]">View</button>

        <button type="button" onClick={() => router.push(`/Paysheet?company=${company}&month=${reportMonth}&action=export_excel`)} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">Export to Excel</button>
      </div>
    </div>
  );
}

/* ===========================
   PreviewDailyModal
   - Edits intime/outtime/status/remarks/workdur
   - Computes work minutes from intime/outtime and shows human H:MM
   - Groups rows by company and sorts inside group by numeric part of employeeid
   - Normalizes many incoming column names and handles NW / SCM -> SRI CHAKRA MILK mapping
   - SEARCH: matches idVariants(employeeid) and raw SI-like fields so "186" will match "EMP186"
   =========================== */
/* ===========================
   PreviewDailyModal
   - Edits intime/outtime/status/remarks/workdur
   - Computes work minutes from intime/outtime and shows human H:MM
   - Groups rows by company and sorts inside group by numeric part of employeeid
   - Normalizes many incoming column names and handles NW / SCM -> SRI CHAKRA MILK mapping
   - SEARCH: matches idVariants(employeeid) and raw SI-like fields so "186" will match "EMP186"
   =========================== */
function PreviewDailyModal({ date, rows, onClose, onSaved }) {
  // helper: map multiple known company variants to canonical names
  const normalizeCompany = (raw) => {
    if (raw === null || raw === undefined) return "";
    const s = String(raw || "").trim();
    if (!s) return "";
    const u = s.toUpperCase();

    // NW / NATURE variants
    if (/\bNATURE'?S?\b/.test(u) || /\bNAT\b/.test(u) || /\bNW\b/.test(u) || /^NATURES?$/i.test(s)) {
      return "NATURE'S WELLNESS";
    }

    // SRI CHAKRA MILK and variants, SCM short code
    if (/SRI\s*CHAKRA\s*MILK|SRI\s*CHAKRA|SRICHAKRA|SRICH?AKRA/i.test(s)) return "SRI CHAKRA MILK";
    if (/^\s*SCM\s*$/i.test(s) || /\bSCM\b/i.test(u)) return "SRI CHAKRA MILK";

    // ASF / ASF-FACTORY
    if (/ASF-?FACTORY|FACTORY/i.test(s)) return "ASF-FACTORY";
    if (/\bASF\b/i.test(u) && !/FACTORY/i.test(u)) return "ASF";

    if (/\bAGB\b/i.test(u)) return "AGB";
    if (/\bANM\b/i.test(u)) return "ANM";
    if (/\bAVION\b/i.test(u)) return "AVION";

    // fallback
    return String(raw).trim();
  };

  // Accept many column names and normalize row object
  const normalizeRow = (raw) => {
    if (!raw) raw = {};

    // Employee id candidates (many possible column names)
    const possibleId =
      raw.employeeid ??
      raw.empid ??
      raw.EmpID ??
      raw.EmpId ??
      raw.EMPID ??
      raw.si ??
      raw.SI ??
      raw.Sno ??
      raw.SNo ??
      raw['SI/EMP ID'] ??
      raw['SI'] ??
      raw['Emp No'] ??
      raw['EmpID'] ??
      "";

    let employeeid = String(possibleId ?? "").trim();

    // If empty and there is an SI-like numeric column, prefix EMP
    if (!employeeid) {
      const siCand =
        raw.SI ??
        raw.si ??
        raw.Sno ??
        raw.SNo ??
        raw['SNo'] ??
        raw['S No'] ??
        raw['SI/EMP ID'] ??
        raw['Emp No'] ??
        "";
      const sVal = String(siCand || "").trim();
      if (/^\d+$/.test(sVal)) {
        employeeid = `EMP${Number(sVal)}`;
      }
    } else if (/^\d+$/.test(employeeid)) {
      // numeric only: 186 -> EMP186
      employeeid = `EMP${Number(employeeid)}`;
    } else {
      // If contains digits but no letters, extract digits
      const digits = (String(employeeid).match(/(\d+)/) || [null, null])[1];
      if (digits && !/[A-Z]/i.test(employeeid)) {
        employeeid = `EMP${Number(digits)}`;
      } else {
        // cleanup common patterns: uppercase and trim
        employeeid = String(employeeid).trim().toUpperCase();
      }
    }

    const name = String(raw.name ?? raw.Name ?? raw['Employee Name'] ?? raw['Emp Name'] ?? raw.NAME ?? "").trim();
    const shift = String(raw.shift ?? raw.Shift ?? raw['Shift Name'] ?? "").trim();

    const intimeRaw = raw.intime ?? raw.InTime ?? raw['In Time'] ?? raw['IN TIME'] ?? raw['IN_TIME'] ?? raw['Time In'] ?? raw['IN'] ?? raw['Time_In'] ?? "";
    const outtimeRaw = raw.outtime ?? raw.OutTime ?? raw['Out Time'] ?? raw['OUT TIME'] ?? raw['OUT_TIME'] ?? raw['Time Out'] ?? raw['OUT'] ?? raw['Time_Out'] ?? "";

    // helper to coerce various time forms (07:30, 7:30, 07:30:00, 730, Excel decimal)
    const parseToHHMM = (val) => {
      if (val === null || val === undefined || val === "") return "";
      const s = String(val).trim();
      const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (m) {
        const hh = String(Math.max(0, Math.min(23, Number(m[1])))).padStart(2, "0");
        const mm = String(Math.max(0, Math.min(59, Number(m[2])))).padStart(2, "0");
        return `${hh}:${mm}`;
      }
      const m2 = s.match(/^(\d{3,4})$/);
      if (m2) {
        const num = m2[1];
        if (num.length === 3) return `${'0' + num[0]}:${num.slice(1)}`;
        return `${num.slice(0, num.length - 2).padStart(2, '0')}:${num.slice(-2)}`;
      }
      const asNum = Number(s);
      // Excel time serials (0 < n < 1)
      if (!Number.isNaN(asNum) && asNum > 0 && asNum < 1) {
        const totalMin = Math.round(asNum * 24 * 60);
        const hh = Math.floor(totalMin / 60);
        const mm = totalMin % 60;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
      return "";
    };

    const intime = parseToHHMM(intimeRaw);
    const outtime = parseToHHMM(outtimeRaw);

    const status = String(raw.status ?? raw.Status ?? raw.attendance ?? raw.Attendance ?? "").trim();
    const remarks = String(raw.remarks ?? raw.Remarks ?? raw.note ?? raw.Note ?? "").trim();

    // Collect possible company/site fields from many column names
    const companyRaw =
      raw.company ??
      raw.Company ??
      raw.site ??
      raw.Site ??
      raw.branch ??
      raw.Branch ??
      raw.location ??
      raw.Location ??
      raw['Company'] ??
      raw['Company Name'] ??
      raw['Branch Name'] ??
      raw['Site'] ??
      "";

    let company = normalizeCompany(companyRaw);

    // If company still empty, try dept/group/other columns
    if (!company || company === "") {
      const extra = String(raw.dept ?? raw.department ?? raw.dept_name ?? raw.group ?? raw.Division ?? raw.DEPARTMENT ?? raw['Business Unit'] ?? raw['BU'] ?? "").trim();
      if (extra) {
        if (/SCM\b/i.test(extra) || /^SCM$/i.test(extra)) {
          company = "SRI CHAKRA MILK";
        }
        if (/\bNATURE'?S?\b|\bNW\b/i.test(extra)) {
          company = "NATURE'S WELLNESS";
        }
      }
    }

    if (!company) company = "";

    // Work duration conversions
    let workdur = raw.workdur ?? raw.work_dur ?? raw.WorkDur ?? raw['Work Duration'] ?? raw['work_hours'] ?? raw.WorkHours ?? null;
    let workdur_hours = "";
    if (typeof workdur === "number") {
      workdur_hours = minutesToHumanHMM(workdur);
    } else if (workdur != null && String(workdur || "").trim()) {
      workdur_hours = String(workdur).trim();
    } else {
      workdur_hours = "";
    }

    return {
      employeeid,
      name,
      shift,
      intime,
      outtime,
      workdur_hours,
      status,
      remarks,
      company,
      _raw: raw,
    };
  };

  // Initialize state from rows using normalizeRow
  const [data, setData] = useState(() => (rows || []).map((r) => normalizeRow(r)));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setData((rows || []).map((r) => normalizeRow(r)));
  }, [rows]);

  const headers = [
    { key: "employeeid", label: "Employee ID", readOnly: true, className: "w-32" },
    { key: "name", label: "Employee Name", className: "w-56" },
    { key: "intime", label: "In Time (HH:MM)", className: "w-40" },
    { key: "outtime", label: "Out Time (HH:MM)", className: "w-40" },
    { key: "workdur_hours", label: "Work (h:mm)", className: "w-36" },
    { key: "status", label: "Status", className: "w-32" },
    { key: "remarks", label: "Remarks", className: "min-w-[220px]" },
    { key: "company", label: "Company", className: "w-48" },
  ];

const setCell = (i, key, val) => {
  setData((prev) => {
    const next = [...prev];
    const updated = { ...next[i], [key]: val };
    // Mark manual override when user edits the workdur input
    if (key === "workdur_hours") {
      updated._manualWork = (String(val || "").trim() !== "");
    }
    // If user edits intime/outtime, clear manual override so computed shows again
    if (key === "intime" || key === "outtime") {
      // leave manual flag only if user explicitly set workdur after editing times
      updated._manualWork = next[i]._manualWork || false; // preserve if already set
      // but we'll keep it; below in render we treat computed prioritized unless _manualWork true
    }
    next[i] = updated;
    return next;
  });
};

  const numericId = (empid) => {
    if (!empid && empid !== 0) return null;
    const s = String(empid).trim();
    const m = s.match(/(\d+)(?!.*\d)/);
    if (m) {
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  // items filtered & grouped by company, sorted by numeric employee id inside each company
  const items = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const filtered = data
      .map((r, idx) => ({ idx, r }))
      .filter(({ r }) => {
        if (!q) return true;

        // id variants
        const idMatches = idVariants(r.employeeid || "").some((v) => String(v || "").toLowerCase().includes(q));

        // raw SI-like fields
        const rawCandidate = r._raw || {};
        const siFields = [
          rawCandidate.si, rawCandidate.SI, rawCandidate.Sno, rawCandidate.SNo,
          rawCandidate['SNo'], rawCandidate['S No'], rawCandidate['SI/EMP ID'], rawCandidate['SI']
        ];
        const rawMatch = siFields.some((v) => {
          if (v == null || v === "") return false;
          return String(v).toLowerCase().includes(q);
        });

        // fallback text match
        const textMatch = [r.name, r.shift, r.status, r.remarks, r.company, r.intime, r.outtime].some((v) =>
          String(v || "").toLowerCase().includes(q)
        );

        return idMatches || rawMatch || textMatch;
      });

    // sort
    filtered.sort((a, b) => {
      const ca = String(a.r.company || "").toUpperCase();
      const cb = String(b.r.company || "").toUpperCase();
      if (ca !== cb) return ca.localeCompare(cb);

      const na = numericId(a.r.employeeid);
      const nb = numericId(b.r.employeeid);

      if (na != null && nb != null) {
        if (na !== nb) return na - nb;
        return String(a.r.employeeid || "").localeCompare(String(b.r.employeeid || ""));
      }
      if (na != null && nb == null) return -1;
      if (na == null && nb != null) return 1;

      const cmpId = String(a.r.employeeid || "").localeCompare(String(b.r.employeeid || ""));
      if (cmpId !== 0) return cmpId;

      return String(a.r.name || "").localeCompare(String(b.r.name || ""));
    });

    // group
    const out = [];
    let current = "__INIT__";
    for (const it of filtered) {
      const comp = String(it.r.company || "—");
      if (comp !== current) {
        out.push({ type: "group", key: comp });
        current = comp;
      }
      out.push({ type: "row", idx: it.idx });
    }
    return out;
  }, [data, search]);

  const isHHMM = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));
  const parseWorkInputToMinutes = (v) => {
    if (v === "" || v == null) return null;
    const s = String(v).trim();
    const mmStyle = s.match(/^(\d+):(\d{1,2})$/);
    if (mmStyle) {
      const hh = Number(mmStyle[1]);
      const mm = Number(mmStyle[2]);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      if (mm >= 60) {
        const extra = Math.floor(mm / 60);
        return (hh + extra) * 60 + (mm % 60);
      }
      return hh * 60 + mm;
    }
    const dotStyle = s.match(/^(\d+)\.(\d{1,2})$/);
    if (dotStyle) {
      const hh = Number(dotStyle[1]);
      let mm = Number(dotStyle[2]);
      if (mm >= 60) {
        const extra = Math.floor(mm / 60);
        mm = mm % 60;
        return (hh + extra) * 60 + mm;
      }
      return hh * 60 + mm;
    }
    const dec = parseFloat(s.replace(",", "."));
    if (!Number.isNaN(dec)) return Math.round(dec * 60);
    return null;
  };

  const save = async () => {
    for (const r of data) {
      if (r.intime && !isHHMM(r.intime)) { Swal.fire({ icon: "error", title: "Invalid time", text: `Invalid In Time for ${r.name || r.employeeid}. Use HH:MM.` }); return; }
      if (r.outtime && !isHHMM(r.outtime)) { Swal.fire({ icon: "error", title: "Invalid time", text: `Invalid Out Time for ${r.name || r.employeeid}. Use HH:MM.` }); return; }
    }

    setSaving(true);
    try {
      const payloadRows = data.map((r) => {
        const inMin = parseHHMMToMinutes(r.intime);
        const outMin = parseHHMMToMinutes(r.outtime);
        let workMinutes = null;
        if (typeof inMin === "number" && typeof outMin === "number") {
          if (outMin < inMin) workMinutes = (outMin + 24 * 60) - inMin;
          else workMinutes = outMin - inMin;
        } else {
          workMinutes = parseWorkInputToMinutes(r.workdur_hours);
        }
        return {
          employeeid: r.employeeid || null,
          name: r.name || null,
          shift: r.shift || null,
          intime: r.intime || null,
          outtime: r.outtime || null,
          workdur: workMinutes,
          status: r.status || null,
          remarks: r.remarks || null,
          company: r.company || null,
        };
      });

      const res = await fetch("/api/attendance/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rows: payloadRows }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Save failed");
      onSaved?.(j);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Save failed", text: e?.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  const totalRows = data.length;
  const shownRows = items.filter((x) => x.type === "row").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl m-0 md:m-4 max-h-[88vh] flex flex-col">
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Preview • {toHumanDate(date)}</h3>
            <div className="mt-1 text-xs text-gray-600">Showing {shownRows} of {totalRows} records</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 w-full md:max-w-md">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, name, company..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            {search && <button onClick={() => setSearch("")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">Clear</button>}
          </div>
        </div>

        <div className="px-6 py-4 overflow-hidden flex-1 flex flex-col">
          {!data?.length ? (
            <div className="py-8 text-center text-gray-600">No rows parsed.</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden flex-1 min-h-0">
              <div className="overflow-auto max-h-[68vh]">
                <table className="min-w-[1250px] w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-left text-gray-600">
                      {headers.map((h) => (
                        <th key={h.key} className={`px-3 py-2 border-b ${h.className || ""}`}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-gray-500">No matches for “{search}”.</td></tr>
                    ) : items.map((it, i) => {
                      if (it.type === "group") {
                        return <tr key={`g-${it.key}-${i}`}><td colSpan={headers.length} className="bg-gray-100/70 text-gray-800 px-3 py-2 border-t font-semibold">{it.key || "—"}</td></tr>;
                      }
                      const r = data[it.idx];
                      const inMin = parseHHMMToMinutes(r.intime);
                      const outMin = parseHHMMToMinutes(r.outtime);
                      const computedWork = (typeof inMin === "number" && typeof outMin === "number") ? (outMin < inMin ? (outMin + 24 * 60 - inMin) : (outMin - inMin)) : null;
                      return (
                        <tr key={`r-${it.idx}-${i}`} className="odd:bg-white even:bg-gray-50">
                          {headers.map((h) => (
                            <td key={h.key} className="px-3 py-2 border-t align-top">
                              {h.readOnly ? <span className="block text-gray-800">{r[h.key] || "-"}</span> :
                                h.key === "workdur_hours" ? (
                                  <div className="flex items-center gap-2">
                                    <input type="text" value={r.workdur_hours ?? (computedWork != null ? minutesToHumanHMM(computedWork) : "")} onChange={(e) => setCell(it.idx, "workdur_hours", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1" placeholder="e.g., 7:30 or 7.30 or 7.5" />
                                    <div className="text-xs text-gray-500">{computedWork != null ? `${minutesToHumanHMM(computedWork)} (calc)` : ""}</div>
                                  </div>
                                ) : h.key === "remarks" ? (
                                  <textarea rows={2} value={r.remarks ?? ""} onChange={(e) => setCell(it.idx, "remarks", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1" placeholder="Optional notes" />
                                ) : h.key === "intime" || h.key === "outtime" ? (
                                  <input type="time" step="60" value={r[h.key] || ""} onChange={(e) => setCell(it.idx, h.key, e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1" />
                                ) : h.key === "status" ? (
                                  <input type="text" value={r.status ?? ""} onChange={(e) => setCell(it.idx, "status", e.target.value)} className={`w-full rounded border px-2 py-1 ${statusClass(r.status)}`} placeholder="Present / Absent / Leave" />
                                ) : (
                                  <input type="text" value={r[h.key] ?? ""} onChange={(e) => setCell(it.idx, h.key, e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1" />
                                )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pt-3 pb-6 flex items-center justify-end gap-3 border-t border-gray-200">
          <button onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={!data.length || saving} className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}


/* ===========================
   ANM Preview Modal (Tandur / Talakondapally)
   =========================== */
function AnmPreviewDailyModal({ site, date, onClose, onSaved }) {
  const siteLabel = site === "tandur" ? "Tandur" : "Talakondapally";
  const [data, setData] = useState([]); // {si,name,status,date}
  const [orig, setOrig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const normalizeRow = (row) => ({
    si: Number(row?.si ?? row?.SI ?? row?.employeeid ?? 0) || 0,
    name: String(row?.name || ""),
    status: String(row?.status || ""),
    date: String(row?.date || ""),
  });

  const bySiAsc = (a, b) => (a.si || 0) - (b.si || 0);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`/api/attendance/anm/daily?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to fetch ANM attendance");
      const rows = Array.isArray(j?.rows) ? j.rows.map(normalizeRow) : [];
      rows.sort(bySiAsc);
      setData(rows);
      setOrig(rows);
    } catch (e) {
      setData([]);
      setOrig([]);
      Swal.fire({ icon: "error", title: "Load error", text: e?.message || "Could not fetch data" });
    } finally {
      setLoading(false);
    }
  }, [site, date]);

  useEffect(() => { reload(); }, [reload]);

  const viewRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const list = !q ? [...data] : data.filter((r) => [r.name, r.status, String(r.si)].some((v) => String(v || "").toLowerCase().includes(q)));
    return list.sort(bySiAsc);
  }, [data, search]);

  const changedRows = useMemo(() => {
    const map = new Map(orig.map((o) => [o.si, o]));
    return data.filter((r) => { const o = map.get(r.si); return o ? (o.name !== r.name || o.status !== r.status) : true; });
  }, [data, orig]);

  const submit = async () => {
    try {
      setSaving(true);
      if (changedRows.length > 0) {
        for (const r of changedRows) {
          const res = await fetch(`/api/attendance/anm/row?site=${encodeURIComponent(site)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ si: r.si, name: r.name, status: r.status }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || `Failed to update SI ${r.si}`);
        }
      }
      // mark review as Submitted
      try {
        await fetch(`/api/attendance/anm/review?site=${encodeURIComponent(site)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, review: "Submitted" }),
        });
      } catch { /*ignore best-effort*/ }

      setOrig([...data].sort(bySiAsc));
      await Swal.fire({ icon: "success", title: "Submitted", text: changedRows.length ? `Updated ${changedRows.length} rows.` : "No edits detected." });
      onSaved?.({ saved: changedRows.length, submitted: true });
      onClose?.();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Submit failed", text: e?.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (si) => {
    const ok = await Swal.fire({ icon: "warning", title: `Delete row #${si}?`, text: "This cannot be undone.", showCancelButton: true, confirmButtonText: "Delete", cancelButtonText: "Cancel", confirmButtonColor: "#C1272D" }).then((r) => r.isConfirmed);
    if (!ok) return;
    try {
      const res = await fetch(`/api/attendance/anm/row?site=${encodeURIComponent(site)}&si=${encodeURIComponent(si)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      setData((prev) => prev.filter((r) => r.si !== si));
      setOrig((prev) => prev.filter((r) => r.si !== si));
      Swal.fire({ icon: "success", title: "Deleted", text: `Row #${si} removed.` });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e?.message || "Something went wrong" });
    }
  };

  const isDirty = changedRows.length > 0;
  const handleClose = async () => {
    if (!isDirty) return onClose?.();
    const confirm = await Swal.fire({ icon: "warning", title: "Discard changes?", text: "You have unsaved edits. Close without submitting?", showCancelButton: true, confirmButtonText: "Discard", cancelButtonText: "Stay", confirmButtonColor: "#C1272D" }).then((r) => r.isConfirmed);
    if (confirm) onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-5xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl m-0 md:m-4 h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{siteLabel} • {toHumanDate(date)}</h3>
            <div className="mt-1 text-xs text-gray-600">{loading ? "Loading…" : `Showing ${viewRows.length} of ${data.length} employees`}</div>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 w-full md:max-w-2xl">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Search by SI, name, or status…" disabled={loading} />
            <button onClick={reload} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50" disabled={loading}>Refresh</button>
          </div>
        </div>

        <div className="px-6 flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="py-8 text-center text-gray-600"><span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />Loading attendance…</div>
          ) : !data?.length ? (
            <div className="py-8 text-center text-gray-600">No rows found for {siteLabel} on {toHumanDate(date)}.</div>
          ) : (
            <div className="border border-gray-200 rounded-xl flex-1 min-h-0">
              <div className="h-full overflow-y-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2 border-b w-24">SI</th>
                      <th className="px-3 py-2 border-b">Name</th>
                      <th className="px-3 py-2 border-b w-56">Status</th>
                      <th className="px-3 py-2 border-b w-32 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRows.map((r) => {
                      const idx = data.findIndex((x) => x.si === r.si);
                      return (
                        <tr key={r.si} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2 border-t align-top">{r.si}</td>
                          <td className="px-3 py-2 border-t align-top">
                            <input type="text" value={r.name} onChange={(e) => { const v = e.target.value; setData((prev) => { const next = [...prev]; next[idx] = { ...next[idx], name: v }; return next; }); }} className="w-full rounded border border-gray-300 px-2 py-1" placeholder="Name" />
                          </td>
                          <td className="px-3 py-2 border-t align-top">
                            <input type="text" value={r.status} onChange={(e) => { const v = e.target.value; setData((prev) => { const next = [...prev]; next[idx] = { ...next[idx], status: v }; return next; }); }} className={`w-full rounded border px-2 py-1 ${statusClass(r.status)}`} placeholder="Status (Present/Absent/Leave)" />
                          </td>
                          <td className="px-3 py-2 border-t align-top text-right">
                            <button onClick={() => onDelete(r.si)} className="p-2 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pt-3 pb-6 flex items-center justify-end gap-3 border-t border-gray-200 shrink-0">
          <button onClick={handleClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading || saving} className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60">{saving ? "Submitting…" : "Submit"}</button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   CreateEmployeeModal & EditEmployeeModal
   - Enhanced: when ReportingToId changes, auto-fetch manager name from API.
   - Falls back to idToName map if API doesn't return a match.
   - Aadhaar/PAN optional validations kept.
   =========================== */

function CreateEmployeeModal({ idToName = {}, onClose, onCreated }) {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [doj, setDoj] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [gross, setGross] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [designation, setDesignation] = useState("");
  const [reportingToId, setReportingToId] = useState("");
  const [reportingToName, setReportingToName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Try local lookup first + best-effort API lookup (debounced simplistic)
  useEffect(() => {
    if (!reportingToId) { setReportingToName(""); return; }
    const local = (() => {
      for (const k of idVariants(reportingToId)) {
        if (idToName?.[k]) return idToName[k];
      }
      return "";
    })();
    setReportingToName(local || "");
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/users?id=${encodeURIComponent(String(reportingToId).trim())}`);
        const j = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok && Array.isArray(j?.data) && j.data.length > 0 && j.data[0].name) {
          setReportingToName(j.data[0].name);
        } else {
          if (!local) setReportingToName("");
        }
      } catch {
        // network failure -> keep local result
      }
    })();
    return () => { mounted = false; };
  }, [reportingToId, idToName]);

  const validateLocal = () => {
    if (!employeeId || !String(employeeId).trim()) return "Employee ID is required.";
    if (!name || !name.trim()) return "Full name is required.";
    // if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return "Valid email is required.";
    if (!company || !String(company).trim()) return "Company is required.";
    if (gross !== "" && isNaN(Number(gross))) return "Gross salary must be a number.";
    const aadDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaar && aadDigits.length !== 12) return "Aadhaar must be exactly 12 digits when provided.";
    const panNorm = String(pan || "").toUpperCase();
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid (e.g., ABCDE1234F).";
    if ((role === "HR" || role === "FINANCE") && !password.trim()) return "Password is required for HR/FINANCE.";
    return null;
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    const err = validateLocal();
    if (err) {
      Swal.fire({ icon: "error", title: "Validation error", text: err });
      return;
    }

    try {
      setSubmitting(true);

      // duplicate check by employee id (best-effort)
      try {
        const checkRes = await fetch(`/api/users?id=${encodeURIComponent(String(employeeId).trim())}`);
        const checkJson = await checkRes.json().catch(() => ({}));
        if (checkRes.ok && Array.isArray(checkJson?.data) && checkJson.data.length > 0) {
          Swal.fire({ icon: "error", title: "User ID already exists", text: `Employee ID ${employeeId} already exists.` });
          setSubmitting(false);
          return;
        }
      } catch {
        // if check call fails, proceed and let server handle duplicates
      }

      const body = {
        employeeid: String(employeeId).trim(),
        name: String(name).trim(),
        email: String(email).trim(),
        role,
        doj: doj || null,
        number: phone || null,
        company: company || null,
        grosssalary: gross === "" ? null : String(gross).trim(),
        adhaarnumber: aadhaar ? String(aadhaar).replace(/\D/g, "") : null,
        pancard: pan ? String(pan).toUpperCase() : null,
        address: address || null,
        designation: designation ? String(designation).trim() : null,
        reporting_to_id: reportingToId ? String(reportingToId).trim() : null,
      };
      if (role === "HR" || role === "FINANCE") body.password = String(password || "");

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to create employee");

      Swal.fire({ icon: "success", title: "Employee created", text: `Employee ${body.employeeid} added.` });
      onCreated?.(j);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Create failed", text: e?.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} aria-hidden="true" />
      <div className="relative w-full md:max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Employee</h3>
          <button onClick={() => onClose?.()} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. EMP1001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Harini" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="user@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input value={doj} onChange={(e) => setDoj(e.target.value)} type="date" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="+91 98765 43210" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">Select company…</option>
                {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input value={gross} onChange={(e) => setGross(e.target.value)} type="number" step="0.01" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g., 30000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (optional)</label>
              <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="12 digits" />
              <div className="mt-1 text-xs text-gray-500">If provided, must be 12 digits.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN (optional)</label>
              <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ABCDE1234F" />
              <div className="mt-1 text-xs text-gray-500">If provided, must match PAN format.</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g., Sr. Executive" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting To (Employee ID)</label>
              <input value={reportingToId} onChange={(e) => setReportingToId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. EMP1002" />
              <div className="mt-1 text-xs text-gray-600">{reportingToId ? (reportingToName ? `Manager: ${reportingToName}` : "No match found") : ""}</div>
            </div>
          </div>

          {(role === "HR" || role === "FINANCE") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Password (required for HR/FINANCE)</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Set a password" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Flat / Street / City / State / PIN" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={() => onClose?.()} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">{submitting ? "Creating…" : "Create Employee"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEmployeeModal({ idToName = {}, employee = {}, onClose, onUpdated }) {
  const [name, setName] = useState(employee?.name || "");
  const [email, setEmail] = useState(employee?.email || "");
  const [role, setRole] = useState(employee?.role || "EMPLOYEE");
  const [doj, setDoj] = useState(employee?.doj || "");
  const [phone, setPhone] = useState(employee?.number || "");
  const [company, setCompany] = useState(employee?.company || "");
  const [aadhaar, setAadhaar] = useState(employee?.adhaarnumber || "");
  const [pan, setPan] = useState(employee?.pancard || "");
  const [address, setAddress] = useState(employee?.address || "");
  const [designation, setDesignation] = useState(employee?.designation || "");
  const [reportingToId, setReportingToId] = useState(employee?.reporting_to_id || "");
  const [reportingToName, setReportingToName] = useState("");
  const [gross, setGross] = useState(String(employee?.grosssalary ?? employee?.grossSalary ?? ""));
  const [submitting, setSubmitting] = useState(false);

  // lookup manager name locally and from API
  useEffect(() => {
    if (!reportingToId) { setReportingToName(""); return; }
    const local = (() => {
      for (const k of idVariants(reportingToId)) {
        if (idToName?.[k]) return idToName[k];
      }
      return "";
    })();
    setReportingToName(local || "");
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/users?id=${encodeURIComponent(String(reportingToId).trim())}`);
        const j = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok && Array.isArray(j?.data) && j.data.length > 0 && j.data[0].name) {
          setReportingToName(j.data[0].name);
        } else {
          if (!local) setReportingToName("");
        }
      } catch {
        // ignore network issues
      }
    })();
    return () => { mounted = false; };
  }, [reportingToId, idToName]);

  const managerName = useMemo(() => reportingToName || (() => {
    for (const k of idVariants(reportingToId)) {
      if (idToName?.[k]) return idToName[k];
    }
    return "";
  })(), [reportingToName, reportingToId, idToName]);

  const validateLocal = () => {
    if (!name || !name.trim()) return "Full name is required.";
    // if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return "Valid email is required.";
    if (!company || !String(company).trim()) return "Company is required.";
    const aadDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaar && aadDigits.length !== 12) return "Aadhaar must be exactly 12 digits when provided.";
    const panNorm = String(pan || "").toUpperCase();
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid (e.g., ABCDE1234F).";
    if (gross !== "" && isNaN(Number(gross))) return "Gross salary must be a number.";
    return null;
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const err = validateLocal();
    if (err) {
      Swal.fire({ icon: "error", title: "Validation error", text: err });
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        employeeid: employee.employeeid,
        name: String(name).trim(),
        email: String(email).trim(),
        role,
        doj: doj || null,
        number: phone || null,
        company: company || null,
        adhaarnumber: aadhaar ? String(aadhaar).replace(/\D/g, "") : null,
        pancard: pan ? String(pan).toUpperCase() : null,
        address: address || null,
        designation: designation ? String(designation).trim() : null,
        reporting_to_id: reportingToId ? String(reportingToId).trim() : null,
      };
      if (gross !== "") body.grosssalary = String(gross).trim();

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to update employee");

      Swal.fire({ icon: "success", title: "Employee updated", text: `Employee ${employee.employeeid} updated.` });
      onUpdated?.(j);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Update failed", text: e?.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} aria-hidden="true" />
      <div className="relative w-full md:max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Employee #{employee?.employeeid}</h3>
          <button onClick={() => onClose?.()} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input value={doj} onChange={(e) => setDoj(e.target.value)} type="date" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">Select company…</option>
                {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (optional)</label>
              <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN (optional)</label>
              <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting To (Employee ID)</label>
              <input value={reportingToId} onChange={(e) => setReportingToId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
              <div className="mt-1 text-xs text-gray-600">{reportingToId ? (managerName ? `Manager: ${managerName}` : "No match found") : ""}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input value={gross} onChange={(e) => setGross(e.target.value)} type="number" step="0.01" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={() => onClose?.()} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">{submitting ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
