// /pages/ex-employees.js
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AppHeader from "@/components/AppHeader";
import ProfileModal from "@/components/ProfileModal";

const COLS = [
  { key: "employeeid", label: "Employee ID" },
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "resigneddate", label: "Resigned Date" },
  { key: "doj", label: "DOJ" },
  { key: "number", label: "Phone" },
  { key: "grosssalary", label: "Gross Salary" },
  { key: "adhaarnumber", label: "Aadhaar" },
  { key: "pancard", label: "PAN" },
  { key: "address", label: "Address" },
];

const PAGE_SIZES = [10, 20, 50, 100];

function getAuthIdentity() {
  if (typeof window === "undefined") return { id: null, email: null };
  const ls = window.localStorage;
  return {
    id: ls.getItem("hr_employeeid") || null,
    email: ls.getItem("hr_email") || null,
  };
}

export default function ExEmployeesPage() {
  const router = useRouter();

  // Header props
  const [hrName, setHrName] = useState("HR");
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me");
        const j = await r.json().catch(() => ({}));
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
      localStorage.removeItem("hr_auth");
      localStorage.removeItem("hr_role");
      localStorage.removeItem("hr_employeeid");
      localStorage.removeItem("hr_email");
    } catch {}
    router.replace("/Hlogin");
  };

  // Table state
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState("resigneddate");
  const [sortDir, setSortDir] = useState("desc");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [reloadTick, setReloadTick] = useState(0); // force refresh after save

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const qs = new URLSearchParams({
          q: debouncedQ,
          page: String(page),
          pageSize: String(pageSize),
          sort: `${sortBy}_${sortDir}`,
        }).toString();

        const res = await fetch(`/api/ex-employees?${qs}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load ex-employees");

        setRows(Array.isArray(j.rows) ? j.rows : []);
        setTotal(Number(j.total || 0));
        setTotalPages(Number(j.totalPages || 1));
      } catch (e) {
        setErr(e.message || "Failed to load ex-employees");
        setRows([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, page, pageSize, sortBy, sortDir, reloadTick]);

  // Reset to page 1 on search/size change
  useEffect(() => { setPage(1); }, [debouncedQ, pageSize]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const pagerInfo = useMemo(() => {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return { from, to };
  }, [page, pageSize, total]);

  const openEdit = (row) => { setEditRow(row); setEditOpen(true); };
  const onSaved = () => { setEditOpen(false); setEditRow(null); setReloadTick((t) => t + 1); };

  return (
    <>
      <Head>
        <title>Ex-Employees • Agasthya</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <AppHeader
          currentPath={router.pathname}
          hrName={hrName}
          onProfileClick={openProfile}
          onLogout={logout}
        />

        <div className="p-4 md:p-6 space-y-4">
          {/* Toolbar */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by ID, name, email, company, PAN, address…"
                  className="w-[340px] max-w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {debouncedQ ? (
                  <button onClick={() => setQ("")} className="text-sm text-gray-600 hover:underline" title="Clear search">
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="overflow-x-auto rounded-2xl">
              <table className="min-w-[1250px] w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="text-left text-gray-600">
                    {COLS.map((c) => {
                      const active = sortBy === c.key;
                      return (
                        <th
                          key={c.key}
                          className="px-3 py-2 border-b whitespace-nowrap cursor-pointer select-none"
                          onClick={() => toggleSort(c.key)}
                          title={`Sort by ${c.label}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            <span className={`text-xs ${active ? "opacity-100" : "opacity-30"}`}>
                              {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </span>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 border-b text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={COLS.length + 1} className="px-3 py-8 text-center text-gray-500">
                        <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                        Loading…
                      </td>
                    </tr>
                  ) : err ? (
                    <tr>
                      <td colSpan={COLS.length + 1} className="px-3 py-8 text-center text-red-600">
                        {err}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length + 1} className="px-3 py-8 text-center text-gray-600">
                        No results.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr key={r.employeeid || idx} className="odd:bg-white even:bg-gray-50 align-top">
                        {COLS.map((c) => (
                          <td key={c.key} className="px-3 py-2 border-t">{r?.[c.key] ?? "-"}</td>
                        ))}
                        <td className="px-3 py-2 border-t text-right">
                          <button
                            onClick={() => openEdit(r)}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pager */}
            <div className="p-3 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="text-xs text-gray-600">
                Showing <span className="font-medium">{pagerInfo.from}</span> – <span className="font-medium">{pagerInfo.to}</span> of{" "}
                <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(1)}
                  className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                  title="First"
                >
                  «
                </button>
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                  title="Previous"
                >
                  ‹
                </button>

                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(totalPages, parseInt(e.target.value || "1", 10)));
                    setPage(val);
                  }}
                  className="w-16 text-center rounded border px-2 py-1 text-sm"
                />
                <span className="text-sm text-gray-600">/ {totalPages}</span>

                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                  title="Next"
                >
                  ›
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(totalPages)}
                  className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                  title="Last"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {editOpen && editRow ? (
        <EditExEmployeeModal row={editRow} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      ) : null}

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
    </>
  );
}

/* -----------------------------
   Edit Modal (wide)
------------------------------ */
function EditExEmployeeModal({ row, onClose, onSaved }) {
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(row?.name || "");
  const [role, setRole] = useState(row?.role || "");
  const [email, setEmail] = useState(row?.email || "");
  const [company, setCompany] = useState(row?.company || "");
  const [resigneddate, setResigneddate] = useState(row?.resigneddate || ""); // VARCHAR
  const [doj, setDoj] = useState(row?.doj || "");
  const [number, setNumber] = useState(row?.number ?? "");
  const [grosssalary, setGrosssalary] = useState(row?.grosssalary || "");
  const [adhaarnumber, setAdhaarnumber] = useState(row?.adhaarnumber ?? "");
  const [pancard, setPancard] = useState(row?.pancard || "");
  const [address, setAddress] = useState(row?.address || "");

  const validate = () => {
    if (!row?.employeeid) return "Missing employeeid";
    if (!name.trim()) return "Name is required.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { alert(v); return; }

    try {
      setSubmitting(true);
      const payload = {
        employeeid: row.employeeid,
        name,
        role,
        email,
        company,
        resigneddate,
        doj,
        number: number === "" ? null : Number(number),
        grosssalary,
        adhaarnumber: adhaarnumber === "" ? null : Number(adhaarnumber),
        pancard,
        address,
      };
      const res = await fetch("/api/ex-employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Update failed");
      onSaved?.(j?.row);
    } catch (e) {
      alert(e.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-5xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Ex-Employee • {row?.employeeid}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input
                value={row?.employeeid || ""}
                readOnly
                disabled
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Resigned Date</label>
              <input
                type="date"
                value={/^\d{4}-\d{2}-\d{2}$/.test(resigneddate || "") ? resigneddate : ""}
                onChange={(e) => setResigneddate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">DOJ</label>
              <input
                type="text"
                value={doj || ""}
                onChange={(e) => setDoj(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="YYYY-MM-DD or text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input
                type="text"
                value={grosssalary || ""}
                onChange={(e) => setGrosssalary(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar</label>
              <input
                type="number"
                value={adhaarnumber}
                onChange={(e) => setAdhaarnumber(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input
                type="text"
                value={pancard || ""}
                onChange={(e) => setPancard(e.target.value.toUpperCase())}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                rows={2}
                value={address || ""}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
