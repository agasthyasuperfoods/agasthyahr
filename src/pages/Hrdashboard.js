// src/pages/Hrdashboard.js
import { useEffect, useMemo, useState } from "react";
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

  // Search + pagination (Employees table)
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function getAuthIdentity() {
    if (typeof window === "undefined") return { id: null, email: null };
    const ls = window.localStorage;
    return {
      id: ls.getItem("hr_employeeid") || null,
      email: ls.getItem("hr_email") || null,
    };
  }

  // Build lookup maps from EmployeeTable (cover EMP1001 / 1001 / 0001001 etc.)
  const { idToName, idToCompany } = useMemo(() => {
    const n = {};
    const c = {};
    for (const u of users || []) {
      for (const key of idVariants(u.employeeid)) {
        if (u.name && !n[key]) n[key] = u.name;
        if (u.company && !c[key]) c[key] = u.company;
      }
    }
    return { idToName: n, idToCompany: c };
  }, [users]);

  // Helper: resolve manager name from reporting_to_id
  const resolveManagerName = (rawId) => {
    if (!rawId) return "";
    for (const k of idVariants(rawId)) {
      if (idToName[k]) return idToName[k];
    }
    return "";
  };

  // Load HR name
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const { id, email } = getAuthIdentity();
        if (!id && !email) {
          setHrName("HR");
          return;
        }
        let me = null;
        if (id) {
          const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok && Array.isArray(j?.data) && j.data.length) me = j.data[0];
        }
        if (!me && email) {
          const r = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok && Array.isArray(j?.data) && j.data.length) me = j.data[0];
        }
        if (!cancelled) setHrName(me?.name || "HR");
      } catch {
        if (!cancelled) setHrName("HR");
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
          onLogout={logout}
          onProfileSaved={(updated) => {
            if (updated?.name) setHrName(updated.name);
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

          {/* Attendance */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Attendance</h3>
              <p className="text-xs text-gray-500">Upload biometric file, review the parsed data, edit if needed, then save</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upload + Preview */}
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Upload Attendance</h4>

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

              {/* Monthly Review */}
              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Monthly Review</h4>
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
      </main>
    </>
  );
}

/* ===========================
   Preview Modal (search + priority grouping)
   =========================== */
function PreviewDailyModal({ date, rows, onClose, onSaved }) {
  const minutesToHoursStr = (min) => {
    const n = Number(min);
    if (!Number.isFinite(n)) return "";
    return String(Math.round((n / 60) * 100) / 100);
  };
  const hoursStrToMinutes = (hStr) => {
    if (hStr === "" || hStr == null) return null;
    const n = parseFloat(String(hStr).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 60);
  };

  // Editable data initialized from incoming rows
  const [data, setData] = useState(() =>
    (rows || []).map((r) => ({
      employeeid: String(r.employeeid ?? ""),
      name: String(r.name || ""),
      shift: r.shift || "",
      intime: r.intime || "",
      outtime: r.outtime || "",
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
    { key: "shift", label: "Shift", className: "w-28" },
    { key: "intime", label: "In Time (HH:MM or HH:MM:SS)", className: "w-40" },
    { key: "outtime", label: "Out Time (HH:MM or HH:MM:SS)", className: "w-40" },
    { key: "workdur_hours", label: "Work Dur (hours)", className: "w-36" },
    { key: "status", label: "Status", className: "w-32" },
    { key: "remarks", label: "Remarks", className: "min-w-[320px]" },
    { key: "company", label: "Company", className: "w-48" },
  ];

  const setCell = (i, key, val) => {
    setData((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  };

  // Priority ordering: ASF → AGB → ANM → others (alphabetical)
  const PRIORITY = ["ASF", "AGB", "ANM"];
  const rankCompany = (c) => {
    const k = String(c || "").trim().toUpperCase();
    const idx = PRIORITY.indexOf(k);
    return idx === -1 ? PRIORITY.length : idx;
  };

  // Build filtered, sorted, grouped view (stable indices preserved for editing)
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();

    // filter
    const filtered = data
      .map((r, idx) => ({ idx, r }))
      .filter(({ r }) => {
        if (!q) return true;
        const fields = [r.employeeid, r.name, r.company, r.shift, r.status, r.remarks, r.intime, r.outtime].map((v) =>
          String(v || "").toLowerCase()
        );
        return fields.some((s) => s.includes(q));
      });

    // sort with priority
    filtered.sort((a, b) => {
      const ra = rankCompany(a.r.company);
      const rb = rankCompany(b.r.company);
      if (ra !== rb) return ra - rb;

      const ca = String(a.r.company || "").toUpperCase();
      const cb = String(b.r.company || "").toUpperCase();
      if (ra === PRIORITY.length && ca !== cb) return ca.localeCompare(cb); // others by company

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
    try {
      setSaving(true);
      const payloadRows = data.map((r) => ({
        employeeid: r.employeeid,
        name: r.name || null,
        shift: r.shift || null,
        intime: r.intime || null,
        outtime: r.outtime || null,
        workdur: hoursStrToMinutes(r.workdur_hours),
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

  const toHumanDateDdMmYyyy = (yyyyMmDd) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || "")) return "-";
    const [y, m, d] = yyyyMmDd.split("-");
    return `${d}/${m}/${y}`;
  };

  // Derived counts (optional telemetry in header)
  const totalRows = data.length;
  // Note: items includes group rows; derive "shownRows" as number of row items
  const shownRows = items.filter((x) => x.type === "row").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-7xl w-[96vw] bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl m-0 md:m-4 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Preview • {toHumanDateDdMmYyyy(date)}</h3>
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
                        const r = data[it.idx]; // live reference for editing
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
                                ) : (
                                  <input
                                    type="text"
                                    value={r[h.key] ?? ""}
                                    onChange={(e) => setCell(it.idx, h.key, e.target.value)}
                                    className="w-full rounded border border-gray-300 px-2 py-1"
                                    placeholder={h.key === "intime" || h.key === "outtime" ? "HH:MM or HH:MM:SS" : ""}
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
   Create / Edit
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-6xl lg:max-w-7xl w-[96vw] bg-white border border-gray-200 rounded-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
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
