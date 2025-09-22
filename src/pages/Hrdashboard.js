// src/pages/Hrdashboard.js
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AppHeader from "../components/AppHeader";
import { Pencil, Trash2 } from "lucide-react";

const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];
const COMPANY_OPTIONS = ["ASF", "AGB", "ASF-FACTORY", "ANM", "AVION", "SRI CHAKRA"];

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function toHumanMonth(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return "-";
  const [y, m] = yyyyMm.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}
function toHumanDateDdMmYyyy(yyyyMmDd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || "")) return "-";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}
function prevMonthYYYYMM() {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

// normalize: strip spaces + non-alnum + uppercase
const normId = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// variants: base, digits-only, digits-without-leading-zeros
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

// ==== shared UI: color the status value ====
const statusClass = (s) => {
  const v = String(s || "").trim().toLowerCase();
  if (v === "present" || v === "p")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "absent" || v === "a")
    return "bg-red-50 text-red-700 border-red-200";
  if (v === "leave" || v === "l")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-white text-gray-800 border-gray-300";
};

export default function Hrdashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Attendance: date + file + parse preview
  const [uploadDate, setUploadDate] = useState(todayIso());
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Already-saved rows for date (from DB)
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Existence check
  const [hasData, setHasData] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  // Monthly / Users / HR / Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);

  // DEFAULT TO PREVIOUS MONTH
  const [reportMonth, setReportMonth] = useState(() => prevMonthYYYYMM());

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [hrName, setHrName] = useState("");
  const [hrUser, setHrUser] = useState(null); // full, exact user for profile

  // Search + pagination (Employees table)
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ANM Farms quick-date for site buttons
  const [anmDate, setAnmDate] = useState(todayIso());
  const [anmSite, setAnmSite] = useState(null);
  const [showAnmPreview, setShowAnmPreview] = useState(false);

  // track whether current date was submitted per site (Tandur/Talakondapally)
  const [anmSubmitted, setAnmSubmitted] = useState({ tandur: false, talakondapally: false });
  useEffect(() => {
    // reset local state when date changes; we'll fetch actual status below
    setAnmSubmitted({ tandur: false, talakondapally: false });
  }, [anmDate]);

  function getAuthIdentity() {
    if (typeof window === "undefined") return { id: null, email: null };
    const ls = window.localStorage;
    return {
      id: ls.getItem("hr_employeeid") || null,
      email: ls.getItem("hr_email") || null,
    };
  }

  // Build lookup maps from EmployeeTable
  const { idToName } = useMemo(() => {
    const n = {};
    for (const u of users || []) {
      for (const key of idVariants(u.employeeid)) {
        if (u.name && !n[key]) n[key] = u.name;
      }
    }
    return { idToName: n };
  }, [users]);

  // Helper: resolve manager name from reporting_to_id
  const resolveManagerName = (rawId) => {
    if (!rawId) return "";
    for (const k of idVariants(rawId)) {
      if (idToName[k]) return idToName[k];
    }
    return "";
  };

  // Load HR name + exact hrUser
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const pickExactById = (list, idRaw) => {
      const want = String(idRaw || "").trim();
      return (Array.isArray(list) ? list : []).find(
        (u) => String(u?.employeeid || "").trim() === want
      ) || null;
    };

    const pickExactByEmail = (list, emailRaw) => {
      const want = String(emailRaw || "").trim().toLowerCase();
      return (Array.isArray(list) ? list : []).find(
        (u) => String(u?.email || "").trim().toLowerCase() === want
      ) || null;
    };

    (async () => {
      try {
        const { id, email } = getAuthIdentity();
        let me = null;

        if (id) {
          const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok) me = pickExactById(j?.data, id);
        }

        if (!me && email) {
          const r = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok) me = pickExactByEmail(j?.data, email);
        }

        if (!cancelled) {
          setHrName(me?.name || "HR");
          setHrUser(me || null);
        }
      } catch {
        if (!cancelled) {
          setHrName("HR");
          setHrUser(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  // AUTH gate
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
  }, [router]);

  const logout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("hr_auth");
        localStorage.removeItem("hr_role");
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        localStorage.removeItem("hr_remember");
        localStorage.removeItem("hr_name");
        localStorage.removeItem("hr_email");
        localStorage.removeItem("hr_employeeid");
      }
      await router.push("/Hlogin");
      if (typeof window !== "undefined") {
        setTimeout(() => window.location.replace("/Hlogin"), 50);
      }
    } catch {
      if (typeof window !== "undefined") window.location.replace("/Hlogin");
    }
  };

  // Load ALL users (EmployeeTable)
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError("");
      const res = await fetch("/api/users");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load users");
      setUsers(Array.isArray(j?.data) ? j.data : []);
    } catch (e) {
      setUsersError(e.message || "Failed to load users");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    loadUsers();
  }, [ready]);

  const dateMax = useMemo(() => todayIso(), []);

  // refresh check + (maybe) rows for date
  const refreshDailyForDate = async (date) => {
    try {
      setDailyLoading(true);
      setPreviewRows([]);
      setHasData(false);
      setExistingCount(0);
      setDailyRows([]);

      const r = await fetch(`/api/attendance/check?date=${encodeURIComponent(date)}`);
      const cj = await r.json().catch(() => ({}));
      const has = !!cj?.hasData;
      const cnt = Number(cj?.count || 0);
      setHasData(has);
      setExistingCount(cnt);

      if (has) {
        const res = await fetch(`/api/attendance/daily?date=${encodeURIComponent(date)}`);
        const j = await res.json().catch(() => ({}));
        setDailyRows(Array.isArray(j?.rows) ? j.rows : []);
      }
    } catch {
      setHasData(false);
      setExistingCount(0);
      setDailyRows([]);
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !uploadDate) return;
    refreshDailyForDate(uploadDate);
  }, [ready, uploadDate]);

  // --- NEW: fetch ANM submitted statuses from DB for the chosen anmDate ---
  const fetchAnmSubmittedStatuses = useCallback(async (date) => {
    try {
      // request to API that returns per-site review/submitted status for the date
      // expected shapes:
      // { tandur: "Submitted", talakondapally: "Pending" }
      // or { sites: { tandur: "Submitted", talakondapally: "Submitted" } }
      const res = await fetch(`/api/attendance/anm/status?date=${encodeURIComponent(date)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to fetch ANM statuses");

      let tandurVal = null;
      let talakVal = null;

      if (j?.sites && typeof j.sites === "object") {
        tandurVal = j.sites.tandur ?? j.sites.tandur_site ?? null;
        talakVal = j.sites.talakondapally ?? j.sites.talakonda ?? j.sites.talakondapally_site ?? null;
      } else {
        tandurVal = j?.tandur ?? j?.tandur_status ?? j?.tandur_review ?? null;
        talakVal = j?.talakondapally ?? j?.talak ?? j?.talak_review ?? null;
      }

      const isSubmitted = (v) => {
        if (v == null) return false;
        return String(v).trim().toLowerCase() === "submitted";
      };

      setAnmSubmitted({
        tandur: isSubmitted(tandurVal),
        talakondapally: isSubmitted(talakVal),
      });
    } catch (e) {
      // if the status fetch fails, keep local submitted flags as false
      console.warn("Failed to fetch ANM submitted statuses:", e?.message || e);
      setAnmSubmitted({ tandur: false, talakondapally: false });
    }
  }, []);

  // call fetchAnmSubmittedStatuses whenever ready or anmDate changes
  useEffect(() => {
    if (!ready || !anmDate) return;
    fetchAnmSubmittedStatuses(anmDate);
  }, [ready, anmDate, fetchAnmSubmittedStatuses]);

  // Parse (preview-only)
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

      setPreviewRows(Array.isArray(j?.rows) ? j.rows : []);
      Swal.fire({
        icon: "success",
        title: "Parsed",
        text: `Found ${j?.count ?? 0} rows for ${toHumanDateDdMmYyyy(uploadDate)}.`,
        confirmButtonColor: "#C1272D",
      });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Preview failed", text: e.message || "Something went wrong" });
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
      const res = await fetch(`/api/users?id=${employeeid}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete employee");

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: `Employee #${employeeid} has been deleted.`,
        confirmButtonColor: "#C1272D",
      });
      loadUsers();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Something went wrong" });
    }
  };

  // Employees search + pagination
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.employeeid, u.name, u.email, u.role, u.company, u.number].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [users, searchQuery]);

  const total = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, Math.min(start, Math.max(1, end - maxButtons + 1)));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const hasPreview = previewRows.length > 0;
  const canOpenPreview = hasPreview || hasData;

  // ANM FARMS — open popup like biometric
  const onAnmClick = (site) => {
    if (!anmDate) {
      Swal.fire({ icon: "warning", title: "Pick a date", text: "Please select the date." });
      return;
    }
    setAnmSite(site);
    setShowAnmPreview(true);
  };

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
        {/* Top Bar */}
        <AppHeader
          currentPath={router.pathname}
          hrName={hrName}
          hrUser={hrUser}
          onLogout={logout}
          onProfileSaved={(updated) => {
            if (updated?.name) setHrName(updated.name);
            if (updated) {
              setHrUser((prev) => ({ ...(prev || {}), ...updated }));
              if (typeof window !== "undefined") {
                if (updated.name) localStorage.setItem("hr_name", updated.name);
                if (updated.email) localStorage.setItem("hr_email", updated.email);
              }
            }
          }}
        />

        {/* Page content */}
        <div className="space-y-8">
          {/* Intro */}
          <div className="bg-white border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{`Welcome, ${hrName || "HR"}`}</h2>
            <p className="text-sm text-gray-600">Manage employees and attendance. Generate monthly sheets for Finance.</p>
            <div className="mt-4">
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center rounded-lg bg-[#C1272D] px-3 py-2 text-sm font-medium text-white hover:bg-[#a02125]"
              >
                + Onboard Employee
              </button>
            </div>
          </div>

          {/* Attendance (ROW 1) */}
          <section className="bg-white border border-gray-200 shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Attendance</h3>
              <p className="text-xs text-gray-500">Upload biometric file or view ANM farms daily attendance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upload + Preview */}
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
                  <div className="mt-1 text-xs text-gray-600">{toHumanDateDdMmYyyy(uploadDate)}</div>

                  {dailyLoading ? (
                    <div className="mt-1 text-xs text-gray-500">Checking existing data…</div>
                  ) : hasData ? (
                    <div className="mt-1 text-xs text-emerald-700">Existing records found for this date: {existingCount}</div>
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
                  disabled={!canOpenPreview}
                  onClick={() => setShowPreview(true)}
                  className={`mt-3 inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
                    canOpenPreview ? "bg-[#C1272D] text-white hover:bg-[#a02125]" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {previewRows.length ? "View & Submit" : hasData ? "Update" : "View & Submit"}
                </button>
              </div>

              {/* ANM FARMS — Daily Views */}
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900">ANM FARMS</h4>
                <p className="text-xs text-gray-500 mb-3">Daily attendance view</p>

                <label className="block text-sm font-medium text-gray-700">Report Date</label>
                <input
                  type="date"
                  value={anmDate}
                  max={dateMax}
                  onChange={(e) => setAnmDate(e.target.value)}
                  className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="mt-1 text-xs text-gray-600">{toHumanDateDdMmYyyy(anmDate)}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAnmClick("tandur")}
                    className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm ${
                      anmSubmitted.tandur
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-[#C1272D] text-white hover:bg-[#a02125]"
                    }`}
                  >
                    {anmSubmitted.tandur ? "Submitted ✓ (Tandur)" : "View & Submit (Tandur)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAnmClick("talakondapally")}
                    className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm  ${
                      anmSubmitted.talakondapally
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-[#C1272D] text-white hover:bg-[#a02125]"
                    }`}
                  >
                    {anmSubmitted.talakondapally ? "Submitted ✓ (Talakondapally)" : "View & Submit (Talakondapally)"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Monthly (ROW 2) */}
          <section className="bg-white border border-gray-200 shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Monthly Summary</h3>
              <p className="text-xs text-gray-500">Generate and submit monthly attendance sheets for Finance</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Head Office</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-600">{toHumanMonth(reportMonth)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/AttendanceSummary?company=ASF&month=${reportMonth}`)}
                  className="mt-3 inline-flex items-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  View & Submit
                </button>
              </div>
            </div>
                    <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Monthly Summary</h3>
              <p className="text-xs text-gray-500">Generate and submit monthly attendance sheets for Finance</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Head Office</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-600">{toHumanMonth(reportMonth)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/AttendanceSummary?company=ASF&month=${reportMonth}`)}
                  className="mt-3 inline-flex items-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  View & Submit
                </button>
              </div>
            </div>
          </section>

          {/* Employees table */}
          <section className="bg-white border border-gray-200 shadow-sm p-3">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Employees</h3>
              <p className="text-xs text-gray-500">Create / edit / remove from EmployeeTable</p>
            </div>

            {/* Search & Page size */}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 w-full md:max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Search by name, email, ID, role, company, phone…"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                    title="Clear"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Scrollable table with sticky header; footer outside scroll */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
              <div className="relative max-h-[80vh] overflow-auto">
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
                          {users.length === 0 ? (
                            <>No employees found. Click <span className="font-medium">Onboard Employee</span> to add one.</>
                          ) : (
                            <>No matches for <span className="font-semibold">“{searchQuery}”</span>.</>
                          )}
                        </td>
                      </tr>
                    ) : (
                      pagedUsers.map((u, i) => (
                        <tr key={u.employeeid || i} className="odd:bg-white even:bg-gray-50 align-top">
                          <td className="px-3 py-2 border-t">{u.employeeid ?? "-"}</td>
                          <td className="px-3 py-2 border-t">{u.name || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.email || "-"}</td>
                          <td className="px-3 py-2 border-t">
                            <span className="rounded bg-gray-100 px-2 py-0.5">{u.role || "-"}</span>
                          </td>
                          <td className="px-3 py-2 border-t">{u.doj || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.number || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.company || "-"}</td>

                          {/* Reporting To: show NAME first, ID below */}
                          <td className="px-3 py-2 border-t whitespace-nowrap">
                            <div className="text-gray-900">{resolveManagerName(u.reporting_to_id) || "—"}</div>
                            <div className="text-[11px] text-gray-500">{u.reporting_to_id || "-"}</div>
                          </td>

                          <td className="px-3 py-2 border-t">{u.designation || "-"}</td>
                          <td className="px-3 py-2 border-t">{u.address || "-"}</td>
                          <td className="px-3 py-2 border-t text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditEmployee(u);
                                  setShowEdit(true);
                                }}
                                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                title="Edit employee"
                                aria-label="Edit employee"
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </button>

                              <button
                                onClick={() => onDelete(u.employeeid)}
                                className="p-2 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                title="Delete employee"
                                aria-label="Delete employee"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer (outside scroll) */}
              <div className="border-t bg-white px-3 py-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{rangeStart}</span>–<span className="font-medium">{rangeEnd}</span> of{" "}
                    <span className="font-medium">{total}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Prev
                    </button>

                    {pageNumbers.map((p) => (
                      <button
                        key={p}
                        className={`px-3 py-2 text-sm rounded-lg border ${
                          p === page ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white hover:bg-gray-50"
                        }`}
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
        {showCreate ? (
          <CreateEmployeeModal
            idToName={idToName}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              Swal.fire({
                icon: "success",
                title: "Employee created",
                text: "The employee has been added.",
                confirmButtonColor: "#C1272D",
              });
              loadUsers();
            }}
          />
        ) : null}

        {showEdit && editEmployee ? (
          <EditEmployeeModal
            idToName={idToName}
            employee={editEmployee}
            onClose={() => {
              setShowEdit(false);
              setEditEmployee(null);
            }}
            onUpdated={() => {
              setShowEdit(false);
              setEditEmployee(null);
              Swal.fire({
                icon: "success",
                title: "Employee updated",
                text: "Changes saved successfully.",
                confirmButtonColor: "#C1272D",
              });
              loadUsers();
            }}
          />
        ) : null}

        {showPreview && (previewRows.length || dailyRows.length) ? (
          <PreviewDailyModal
            date={uploadDate}
            rows={previewRows.length ? previewRows : dailyRows}
            onClose={() => setShowPreview(false)}
            onSaved={async (j) => {
              setShowPreview(false);
              setPreviewRows([]);
              setReportMonth(uploadDate.slice(0, 7));
              Swal.fire({
                icon: "success",
                title: "Saved",
                text: `Saved ${j?.saved ?? 0} rows for ${toHumanDateDdMmYyyy(uploadDate)}.`,
                confirmButtonColor: "#C1272D",
              });
              await refreshDailyForDate(uploadDate);
            }}
          />
        ) : null}

        {showAnmPreview && anmSite ? (
          <AnmPreviewDailyModal
            site={anmSite}
            date={anmDate}
            onClose={() => {
              setShowAnmPreview(false);
              setAnmSite(null);
              // re-check DB status after closing — ensures refresh keeps correct submitted badge
              // (this will overwrite the optimistic state set by onSaved if necessary)
              fetchAnmSubmittedStatuses(anmDate).catch(() => {});
            }}
            onSaved={() => {
              // mark the clicked site as submitted for the chosen date (optimistic)
              setAnmSubmitted((s) => ({ ...s, [anmSite]: true }));
              // still re-fetch authoritative status from DB
              fetchAnmSubmittedStatuses(anmDate).catch(() => {});
            }}
          />
        ) : null}
      </main>
    </>
  );
}

/* ===========================
   Preview Modal (Agasthya biometric)
   =========================== */
function PreviewDailyModal({ date, rows, onClose, onSaved }) {
  // Format helpers (no seconds)
  const toHHMM = (val) => {
    const s = String(val || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return ""; // invalid
    const hh = Math.min(23, Math.max(0, Number(m[1])));
    const mm = Math.min(59, Math.max(0, Number(m[2])));
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const isHHMM = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));

  // --- replace minutesToHoursStr with this ---
  const minutesToHoursStr = (min) => {
    const n = Number(min);
    if (!Number.isFinite(n)) return "";
    // round to nearest minute
    const totalMin = Math.round(n);

    const hh = Math.floor(totalMin / 60);
    let mm = totalMin % 60;

    // if minutes reach 59 or more, carry to next hour
    if (mm >= 59) {
      return String(hh + 1); // show whole hour (no .00 needed)
    }

    // show as H.MM where MM are minutes 00..58 (two digits)
    return `${hh}.${String(mm).padStart(2, "0")}`;
  };



  // Editable data initialized from incoming rows; ensure HH:MM
  const [data, setData] = useState(() =>
    (rows || []).map((r) => ({
      employeeid: String(r.employeeid ?? ""),
      name: String(r.name || ""),
      shift: r.shift || "",
      intime: toHHMM(r.intime || ""),
      outtime: toHHMM(r.outtime || ""),
      workdur_hours: minutesToHoursStr(r.workdur),
      status: r.status || "",
      remarks: r.remarks || "",
      company: String(r.company || ""),
    }))
  );
  const [saving, setSaving] = useState(false);

  // In-modal search
  const [search, setSearch] = useState("");

  const headers = [
    { key: "employeeid", label: "Employee ID", readOnly: true, className: "w-32" },
    { key: "name", label: "Employee Name", className: "w-56" },
    { key: "intime", label: "In Time (HH:MM)", className: "w-40" },
    { key: "outtime", label: "Out Time (HH:MM)", className: "w-40" },
    { key: "workdur_hours", label: "Work Dur (hours)", className: "w-36" },
    { key: "status", label: "Status", className: "w-32" },
    { key: "remarks", label: "Remarks", className: "min-w-[320px]" },
    { key: "company", label: "Company", className: "w-48" },
  ];

  const setCell = (i, key, val) => {
    setData((prev) => {
      const next = [...prev];
      if (key === "intime" || key === "outtime") {
        next[i] = { ...next[i], [key]: toHHMM(val) };
      } else {
        next[i] = { ...next[i], [key]: val };
      }
      return next;
    });
  };

  // Priority ordering: ASF → AGB → ANM → others (alphabetical)
  // Within company: names NOT starting with 'V' first, then 'V' names at bottom; then name ASC; then employeeid ASC
  const PRIORITY = ["ASF", "AGB", "ANM"];
  const rankCompany = (c) => {
    const k = String(c || "").trim().toUpperCase();
    const idx = PRIORITY.indexOf(k);
    return idx === -1 ? PRIORITY.length : idx;
  };
  const startsWithV = (s) => String(s || "").trim().toUpperCase().startsWith("V");

  // Build filtered, sorted, grouped view (stable indices preserved for editing)
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = data
      .map((r, idx) => ({ idx, r }))
      .filter(({ r }) => {
        if (!q) return true;
        const fields = [r.employeeid, r.name, r.company, r.shift, r.status, r.remarks, r.intime, r.outtime].map((v) =>
          String(v || "").toLowerCase()
        );
        return fields.some((s) => s.includes(q));
      });

    filtered.sort((a, b) => {
      const ra = rankCompany(a.r.company);
      const rb = rankCompany(b.r.company);
      if (ra !== rb) return ra - rb;

      // push 'V*' names to bottom within same company
      const av = startsWithV(a.r.name) ? 1 : 0;
      const bv = startsWithV(b.r.name) ? 1 : 0;
      if (av !== bv) return av - bv; // 0 first, then 1

      const na = String(a.r.name || "").toUpperCase();
      const nb = String(b.r.name || "").toUpperCase();
      if (na !== nb) return na.localeCompare(nb);

      return String(a.r.employeeid || "").localeCompare(String(b.r.employeeid || ""));
    });

    // group by company
    const out = [];
    let currentCompany = "__INIT__";
    for (const item of filtered) {
      const comp = String(item.r.company || "—");
      if (comp !== currentCompany) {
        out.push({ type: "group", key: comp });
        currentCompany = comp;
      }
      out.push({ type: "row", idx: item.idx });
    }
    return out;
  }, [data, search]);

  const save = async () => {
    // Validate all HH:MM fields before submitting
    for (const r of data) {
      if (r.intime && !isHHMM(r.intime)) {
        Swal.fire({ icon: "error", title: "Invalid time", text: `Invalid In Time for ${r.name || r.employeeid}. Use HH:MM.` });
        return;
      }
      if (r.outtime && !isHHMM(r.outtime)) {
        Swal.fire({ icon: "error", title: "Invalid time", text: `Invalid Out Time for ${r.name || r.employeeid}. Use HH:MM.` });
        return;
      }
    }

    try {
      setSaving(true);
     // helper: parse a user-entered workdur_hours into minutes (or null)
const parseWorkdurToMinutes = (v) => {
  if (v === "" || v == null) return null;
  const s = String(v).trim();

  // H.MM where MM are minutes (1-2 digits). e.g. "7.52" => 7h 52m
  const mmStyle = s.match(/^(\d+)\.(\d{1,2})$/);
  if (mmStyle) {
    const hh = Number(mmStyle[1]);
    let mm = Number(mmStyle[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

    // if user typed ".5" meaning 5 minutes we already parse 5; if mm >= 60, carry to next hour
    if (mm >= 60) {
      // carry up (e.g. 7.75 => treat minutes 75 as 1h15m => round up to next hour if necessary)
      const extraHours = Math.floor(mm / 60);
      mm = mm % 60;
      return (hh + extraHours) * 60 + mm;
    }

    // If mm is 59 or more (edge), round up to next hour to match UX expectation
    if (mm >= 59) return (hh + 1) * 60;

    return hh * 60 + mm;
  }

  // fallback: try decimal hours (legacy) e.g. "7.88" meaning 7.88 hours
  const dec = parseFloat(s.replace(",", "."));
  if (!Number.isNaN(dec)) {
    return Math.round(dec * 60);
  }

  return null;
};

const payloadRows = data.map((r) => ({
  employeeid: r.employeeid,
  name: r.name || null,
  shift: r.shift || null,
  intime: r.intime || null,
  outtime: r.outtime || null,
  workdur: parseWorkdurToMinutes(r.workdur_hours),
  status: r.status || null,
  remarks: r.remarks || null,
  company: r.company || null,
}));

      const res = await fetch("/api/attendance/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rows: payloadRows }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Save failed");
      onSaved?.(j);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Save failed", text: e.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  const toHumanDateDdMmYyyyLocal = (yyyyMmDd) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || "")) return "-";
    const [y, m, d] = yyyyMmDd.split("-");
    return `${d}/${m}/${y}`;
  };

  const totalRows = data.length;
  const shownRows = items.filter((x) => x.type === "row").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full  bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl m-0 md:m-4 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Preview • {toHumanDateDdMmYyyyLocal(date)}</h3>
            <div className="mt-1 text-xs text-gray-600">Showing {shownRows} of {totalRows} records</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">
            ✕
          </button>
        </div>

        {/* Toolbar: Search */}
        <div className="px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 w-full md:max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Search by ID, name, company, shift, status, remarks…"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                title="Clear"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {/* Body */}
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
                      <tr>
                        <td colSpan={headers.length} className="px-3 py-6 text-center text-gray-500">
                          No matches for “{search}”.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, i) => {
                        if (it.type === "group") {
                          return (
                            <tr key={`g-${it.key}-${i}`}>
                              <td colSpan={headers.length} className="bg-gray-100/70 text-gray-800 px-3 py-2 border-t font-semibold">
                                {it.key || "—"}
                              </td>
                            </tr>
                          );
                        }
                        const r = data[it.idx];
                        return (
                          <tr key={`r-${it.idx}-${i}`} className="odd:bg-white even:bg-gray-50">
                            {headers.map((h) => (
                              <td key={h.key} className="px-3 py-2 border-t align-top">
                                {h.readOnly ? (
                                  <span className="block text-gray-800">{r[h.key] || "-"}</span>
                                ) : h.key === "workdur_hours" ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={r.workdur_hours ?? ""}
                                    onChange={(e) => setCell(it.idx, "workdur_hours", e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                    placeholder="e.g., 7.5"
                                  />
                                ) : h.key === "remarks" ? (
                                  <textarea
                                    rows={2}
                                    value={r.remarks ?? ""}
                                    onChange={(e) => setCell(it.idx, "remarks", e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                    placeholder="Optional notes"
                                  />
                                ) : h.key === "intime" || h.key === "outtime" ? (
                                  <input
                                    type="time"
                                    step="60"
                                    value={r[h.key] || ""}
                                    onChange={(e) => setCell(it.idx, h.key, e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                  />
                                ) : h.key === "status" ? (
                                  <input
                                    type="text"
                                    value={r.status ?? ""}
                                    onChange={(e) => setCell(it.idx, "status", e.target.value)}
                                    className={`w-full rounded border px-2 py-1 ${statusClass(r.status)}`}
                                    placeholder="Present / Absent / Leave"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={r[h.key] ?? ""}
                                    onChange={(e) => setCell(it.idx, h.key, e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                  />
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-6 flex items-center justify-end gap-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!data.length || saving}
            className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   ANM Preview Modal (Tandur / Talakondapally)
   Matches DB columns: SI, name, status (date is NOT shown in table)
   Sorted by SI (ascending) always • Full list scrollable
   =========================== */
function AnmPreviewDailyModal({ site, date, onClose, onSaved }) {
  const siteLabel = site === "tandur" ? "Tandur" : "Talakondapally";

  const [data, setData] = useState([]);   // [{ si, name, status, date }]
  const [orig, setOrig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const normalizeRow = (row) => ({
    si: Number(row?.si ?? row?.SI ?? row?.employeeid ?? 0) || 0,
    name: String(row?.name || ""),
    status: String(row?.status || ""),
    date: String(row?.date || ""), // keep for header/info only
  });

  // numeric sort by SI
  const bySiAsc = useCallback((a, b) => (a.si || 0) - (b.si || 0), []);

  const toHumanDateDdMmYyyyLocal = (yyyyMmDd) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || "")) return "-";
    const [y, m, d] = yyyyMmDd.split("-");
    return `${d}/${m}/${y}`;
  };

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(
        `/api/attendance/anm/daily?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to fetch ANM attendance");

      const rows = Array.isArray(j?.rows) ? j.rows.map(normalizeRow) : [];
      rows.sort(bySiAsc); // ✅ 1,2,3...
      setData(rows);
      setOrig(rows);
    } catch (e) {
      setData([]);
      setOrig([]);
      Swal.fire({ icon: "error", title: "Load error", text: e.message || "Could not fetch data" });
    } finally {
      setLoading(false);
    }
  }, [site, date, bySiAsc]);

  useEffect(() => { reload(); }, [reload]);

  // Search (no date in filter or table)
  const viewRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? [...data]
      : data.filter((r) =>
          [r.name, r.status, String(r.si)].some((v) =>
            String(v || "").toLowerCase().includes(q)
          )
        );
    return [...list].sort(bySiAsc);
  }, [data, search, bySiAsc]);

  // Counts on filtered view
  const counts = useMemo(() => {
    const norm = (s) => String(s || "").trim().toLowerCase();
    let present = 0, absent = 0, leave = 0, other = 0;
    for (const r of viewRows) {
      const s = norm(r.status);
      if (["p", "present"].includes(s)) present++;
      else if (["a", "absent"].includes(s)) absent++;
      else if (["l", "leave"].includes(s)) leave++;
      else other++;
    }
    return { total: viewRows.length, present, absent, leave, other };
  }, [viewRows]);

  // Changed rows (name/status only)
  const changedRows = useMemo(() => {
    const bySi = new Map(orig.map((o) => [o.si, o]));
    return data.filter((r) => {
      const o = bySi.get(r.si);
      if (!o) return false;
      return o.name !== r.name || o.status !== r.status;
    });
  }, [data, orig]);

  const total = data.length;
  const shown = viewRows.length;

  const updateCell = (i, key, val) => {
    setData((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  };

  // Submit (ok even with zero edits)
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

      // mark review/Review = 'Submitted' for this site+date
      try {
        await fetch(`/api/attendance/anm/review?site=${encodeURIComponent(site)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, review: "Submitted" }),
        });
      } catch { /* ignore best-effort */ }

      const snap = [...data].sort(bySiAsc);
      setOrig(snap);
      setData(snap);

      await Swal.fire({
        icon: "success",
        title: "Submitted",
        text: changedRows.length
          ? `Updated ${changedRows.length} ${changedRows.length === 1 ? "row" : "rows"}.`
          : "No edits detected. Data is already up to date.",
        confirmButtonColor: "#C1272D",
      });

      onSaved?.({ saved: changedRows.length, submitted: true });
      onClose?.();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Submit failed", text: e.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (si) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: `Delete row #${si}?`,
      text: "This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/attendance/anm/row?site=${encodeURIComponent(site)}&si=${encodeURIComponent(si)}`,
        { method: "DELETE" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");

      setData((prev) => prev.filter((r) => r.si !== si));
      setOrig((prev) => prev.filter((r) => r.si !== si));
      Swal.fire({ icon: "success", title: "Deleted", text: `Row #${si} removed.` });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Something went wrong" });
    }
  };

  // Close with unsaved check
  const isDirty = useMemo(() => changedRows.length > 0, [changedRows]);
  const handleClose = async () => {
    if (!isDirty) return onClose?.();
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Discard changes?",
      text: "You have unsaved edits. Close without submitting?",
      showCancelButton: true,
      confirmButtonText: "Discard",
      cancelButtonText: "Stay",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (confirm) onClose?.();
  };

  // UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />

      {/* Modal content: fixed height & internal scrolling */}
      <div className="relative w-full md:max-w-5xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl m-0 md:m-4 h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {siteLabel} • {toHumanDateDdMmYyyyLocal(date)}
            </h3>
            <div className="mt-1 text-xs text-gray-600">
              {loading ? "Loading…" : <>Showing {shown} of {total} employees</>}
            </div>
            {!loading && (
              <div className="mt-1 text-xs text-gray-700">
                <span className="mr-3">Total: <span className="font-semibold">{counts.total}</span></span>
                <span className="mr-3">Present: <span className="font-semibold text-emerald-700">{counts.present}</span></span>
                <span className="mr-3">Absent: <span className="font-semibold text-red-600">{counts.absent}</span></span>
                <span className="mr-3">Leave: <span className="font-semibold text-amber-600">{counts.leave}</span></span>
                <span>Other: <span className="font-semibold text-gray-600">{counts.other}</span></span>
              </div>
            )}
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 w-full md:max-w-2xl">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Search by SI, name, or status…"
              disabled={loading}
            />
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body (scrolls) */}
        <div className="px-6 flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="py-8 text-center text-gray-600">
              <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
              Loading attendance…
            </div>
          ) : !data?.length ? (
            <div className="py-8 text-center text-gray-600">
              No rows found for {siteLabel} on {toHumanDateDdMmYyyyLocal(date)}.
            </div>
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
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => updateCell(idx, "name", e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1"
                              placeholder="Name"
                            />
                          </td>
                          <td className="px-3 py-2 border-t align-top">
                            <input
                              type="text"
                              value={r.status}
                              onChange={(e) => updateCell(idx, "status", e.target.value)}
                              className={`w-full rounded border px-2 py-1 ${statusClass(r.status)}`}
                              placeholder="Status (Present/Absent/Leave)"
                            />
                          </td>
                          <td className="px-3 py-2 border-t align-top text-right">
                            <button
                              onClick={() => onDelete(r.si)}
                              className="p-2 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                              title="Delete row"
                              aria-label="Delete row"
                            >
                              Delete
                            </button>
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

        {/* Footer */}
        <div className="px-6 pt-3 pb-6 flex items-center justify-end gap-3 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || saving}
            className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60"
          >
            {saving ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Create / Edit Employee
   =========================== */
function CreateEmployeeModal({ idToName, onClose, onCreated }) {
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
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const managerName = useMemo(() => {
    for (const k of idVariants(reportingToId)) {
      if (idToName?.[k]) return idToName[k];
    }
    return "";
  }, [reportingToId, idToName]);

  const validate = () => {
    if (!employeeId) return "Employee ID is required.";
    if (!name.trim()) return "Full name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Valid email is required.";
    if (!role) return "Role is required.";
    if (!company.trim()) return "Company is required.";
    if (gross === "" || isNaN(Number(gross))) return "Gross salary must be a number.";
    const aadhaarDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaarDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
    const panNorm = String(pan || "").toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid (e.g., ABCDE1234F).";
    if ((role === "HR" || role === "FINANCE") && !password.trim()) return "Password is required for HR/FINANCE.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      Swal.fire({ icon: "error", title: "Validation error", text: err });
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        employeeid: employeeId,
        name,
        email,
        role,
        doj,
        number: phone,
        company,
        grosssalary: String(gross).trim(),
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address,
        designation: String(designation).trim() || null,
        reporting_to_id: String(reportingToId).trim() || null,
      };
      if (role === "HR" || role === "FINANCE") body.password = password;

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create employee");
      onCreated?.();
    } catch (e2) {
      Swal.fire({ icon: "error", title: "Create failed", text: e2.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Employee</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. EMP1001 or 1001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Harini" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="user@agasthya.co.in" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="+91 98765 43210" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="" disabled>Select company…</option>
                {COMPANY_OPTIONS.map((co) => (<option key={co} value={co}>{co}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input type="number" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. 30000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (12 digits)</label>
              <input type="text" value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="000000000000" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input type="text" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ABCDE1234F" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Sr. Executive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting To (Employee ID)</label>
              <input type="text" value={reportingToId} onChange={(e) => setReportingToId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. EMP1002" />
              <div className="mt-1 text-xs text-gray-600">
                {reportingToId ? (managerName ? `Manager: ${managerName}` : "No match found") : ""}
              </div>
            </div>
          </div>

          {(role === "HR" || role === "FINANCE") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Password (required for HR/FINANCE)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Set a password" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Flat / Street / City / State / PIN" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">{submitting ? "Creating…" : "Create Employee"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEmployeeModal({ idToName, employee, onClose, onUpdated }) {
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
  const [gross, setGross] = useState(String(employee?.grosssalary ?? employee?.grossSalary ?? ""));
  const [submitting, setSubmitting] = useState(false);

  const managerName = useMemo(() => {
    for (const k of idVariants(reportingToId)) {
      if (idToName?.[k]) return idToName[k];
    }
    return "";
  }, [reportingToId, idToName]);

  const validate = () => {
    if (!name.trim()) return "Full name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Valid email is required.";
    if (!role) return "Role is required.";
    if (!company.trim()) return "Company is required.";
    const aDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aDigits && aDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
    const panNorm = String(pan || "").toUpperCase();
    if (panNorm && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid (e.g., ABCDE1234F).";
    if (gross !== "" && isNaN(Number(gross))) return "Gross salary must be a number.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      Swal.fire({ icon: "error", title: "Validation error", text: err });
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        employeeid: employee.employeeid,
        name,
        email,
        role,
        doj,
        number: phone,
        company,
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address,
        designation: String(designation).trim() || null,
        reporting_to_id: String(reportingToId).trim() || null,
      };
      if (String(gross).trim() !== "") body.grosssalary = String(gross).trim();

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update employee");
      onUpdated?.();
    } catch (e2) {
      Swal.fire({ icon: "error", title: "Update failed", text: e2.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full  bg-white border border-gray-200 rounded-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Employee #{employee?.employeeid}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input type="date" value={doj || ""} onChange={(e) => setDoj(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={phone || ""} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="" disabled>Select company…</option>
                {COMPANY_OPTIONS.map((co) => (<option key={co} value={co}>{co}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (12 digits)</label>
              <input type="text" value={aadhaar || ""} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="000000000000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input type="text" value={pan || ""} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ABCDE1234F" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Sr. Executive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting To (Employee ID)</label>
              <input type="text" value={reportingToId} onChange={(e) => setReportingToId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. EMP1002" />
              <div className="mt-1 text-xs text-gray-600">
                {reportingToId ? (managerName ? `Manager: ${managerName}` : "No match found") : ""}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input type="number" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. 30000" />
            </div>
            <div className="hidden lg:block" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-3 gap-5">
            <div className="lg:col-span-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea rows={2} value={address || ""} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Flat / Street / City / State / PIN" />
            </div>
            <div className="hidden lg:block" />
            <div className="hidden lg:block" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">{submitting ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
