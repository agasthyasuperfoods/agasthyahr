// src/components/UsersTable.js
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const ROLES = ["HR", "FINANCE", "EMPLOYEE"];
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [10, 20, 50, 100];

export default function UsersTable() {
  // Server data
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [showCreate, setShowCreate] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Search + pagination
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  // Load from API
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/users");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to load users");
      }
      const j = await res.json();

      // Normalize shape + casing differences safely
      const raw = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const normalized = raw.map((u) => ({
        employeeid: u.employeeid ?? u.id ?? "",
        name: u.name ?? "",
        email: u.email ?? "",
        role: u.role ?? "",
        doj: u.doj ?? "",
        number: u.number ?? "",
        company: u.company ?? "",
        grossSalary: u.grossSalary ?? u.grosssalary ?? u.gross_salary ?? "",
        adhaarnumber: u.adhaarnumber ?? u.aadhaar ?? u.adhar ?? "",
        pancard: u.pancard ?? u.pan ?? "",
        address: u.address ?? "",
      }));
      setUsers(normalized);
    } catch (e) {
      setError(e.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Local filtering
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const fields = [
        u?.employeeid?.toString() ?? "",
        u?.name ?? "",
        u?.email ?? "",
        u?.role ?? "",
        u?.company ?? "",
        u?.number ?? "",
        u?.pancard ?? "",
        u?.adhaarnumber ?? "",
        u?.address ?? "",
      ];
      return fields.some((f) => String(f).toLowerCase().includes(q));
    });
  }, [users, query]);

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [users]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  // Handlers
  const onCreate = () => setShowCreate(true);
  const onUpdate = (user) => {
    setEditingUser(user || null);
    setShowUpdate(true);
  };
 const onDelete = async (employeeid, name) => {
    const ok = await Swal.fire({
      icon: "warning",
  title: `Delete ${name || "this user"}?`,
     text: name? `This will permanently delete ${name}.`: "This will permanently delete employee.",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (!ok) return;

    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(employeeid)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete user");

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: name ? `${name} has been deleted.` : `Employee #${employeeid} has been deleted.`,        confirmButtonColor: "#C1272D",
      });
      await loadUsers();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Something went wrong" });
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Users</h3>
          <p className="text-xs text-gray-500">Create, update & manage HR/Finance/Admin/Employee accounts</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="block w-full sm:w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 pl-9 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
              placeholder="Search by ID, name, email, role, company…"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          </div>

          {/* Page size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
            title="Rows per page"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>

          {/* Create */}
          <button
            onClick={onCreate}
            className="inline-flex items-center rounded-lg bg-[#C1272D] px-3 py-2 text-sm font-medium text-white hover:bg-[#a02125]"
          >
            Onboard Employee
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-3 py-2 border-b">Employee ID</th>
              <th className="px-3 py-2 border-b">Full name</th>
              <th className="px-3 py-2 border-b">Email</th>
              <th className="px-3 py-2 border-b">Role</th>
              <th className="px-3 py-2 border-b">DOJ</th>
              <th className="px-3 py-2 border-b">Phone</th>
              <th className="px-3 py-2 border-b">Company</th>
              <th className="px-3 py-2 border-b">Gross Salary</th>
              <th className="px-3 py-2 border-b">Aadhaar</th>
              <th className="px-3 py-2 border-b">PAN</th>
              <th className="px-3 py-2 border-b">Address</th>
              <th className="px-3 py-2 border-b text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-gray-500">
                  <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                  Loading users…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-red-600">{error}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-gray-500">No matching users. Try adjusting your search.</td>
              </tr>
            ) : (
              pageSlice.map((u, i) => (
                <tr key={String(u.employeeid || i)} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 border-t">{u.employeeid ?? "-"}</td>
                  <td className="px-3 py-2 border-t">{u.name || "-"}</td>
                  <td className="px-3 py-2 border-t">{u.email || "-"}</td>
                  <td className="px-3 py-2 border-t">
                    <span className="rounded bg-gray-100 px-2 py-0.5">{u.role || "-"}</span>
                  </td>
                  <td className="px-3 py-2 border-t">{u.doj || "-"}</td>
                  <td className="px-3 py-2 border-t">{u.number || "-"}</td>
                  <td className="px-3 py-2 border-t">{u.company || "-"}</td>
                  <td className="px-3 py-2 border-t">{u.grossSalary ?? u.grosssalary ?? "-"}</td>
                  <td className="px-3 py-2 border-t">{u.adhaarnumber ?? u.aadhaar ?? u.adhar ?? "-"}</td>
                  <td className="px-3 py-2 border-t">{u.pancard ?? u.pan ?? "-"}</td>
                  <td className="px-3 py-2 border-t">{u.address ?? "-"}</td>
                  <td className="px-3 py-2 border-t text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onUpdate(u)}
                        className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                        title="Update user"
                      >
                        Update
                      </button>
                   <button
  onClick={() => onDelete(u.employeeid, u.name)}
    className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100"
    title="Delete user"
  >
    Delete
  </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-gray-600">
          Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-50">« First</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-50">‹ Prev</button>
          <span className="text-sm text-gray-700 px-2">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-50">Next ›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-50">Last »</button>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await Swal.fire({ icon: "success", title: "Employee created", text: "The employee profile has been provisioned successfully.", confirmButtonColor: "#C1272D" });
            await loadUsers();
          }}
        />
      )}
      {showUpdate && editingUser && (
        <UpdateUserModal
          data={editingUser}
          onClose={() => {
            setShowUpdate(false);
            setEditingUser(null);
          }}
          onUpdated={async () => {
            setShowUpdate(false);
            setEditingUser(null);
            await Swal.fire({ icon: "success", title: "Employee updated", text: "The employee profile has been updated successfully.", confirmButtonColor: "#C1272D" });
            await loadUsers();
          }}
        />
      )}
    </section>
  );
}

/* ------------------------- Create User Modal ------------------------- */
function CreateUserModal({ onClose, onCreated }) {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [doj, setDoj] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("HR");
  const [company, setCompany] = useState("");
  const [grossSalary, setGrossSalary] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!String(employeeId).trim()) return "Employee ID is required.";
    if (!name.trim()) return "Full name is required.";
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email format looks invalid.";
    if (!role) return "Please select a role.";
    if (!company.trim()) return "Company is required.";
    if (String(grossSalary).trim() === "" || isNaN(Number(grossSalary))) return "Gross Salary is required and must be numeric.";
    const aadhaarDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaarDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
    const panNorm = String(pan || "").toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid.";
    if (!String(address || "").trim()) return "Address is required.";
    if (phone && !String(phone).replace(/\D/g, "").length) return "Phone must contain digits.";
    if ((role === "HR" || role === "FINANCE") && !password.trim()) return "Password is required for HR/FINANCE user.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return Swal.fire({ icon: "error", title: "Validation error", text: err });

    try {
      setSubmitting(true);
      const body = {
        employeeid: String(employeeId).trim(),
        name,
        email,
        role,
        doj,
        phone,
        company,
        grossSalary: String(grossSalary).trim(),
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address: String(address).trim(),
      };
      if (role === "HR" || role === "FINANCE") body.password = password;

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to Onboard Employee");
      onCreated?.();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Create failed", text: e.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      {/* Wider + compact */}
      <div className="relative w-full md:max-w-7xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">Onboard Employee</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        {/* Compact form: 3 columns */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Row 1 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Employee ID *</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="EMP-001"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Full name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Date of Joining</label>
            <input
              type="date"
              value={doj}
              onChange={(e) => setDoj(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="+91 98765 43210"
            />
          </div>

          {/* Row 3 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Company *</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Gross Salary *</label>
            <input
              type="text"
              inputMode="decimal"
              value={grossSalary}
              onChange={(e) => setGrossSalary(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">PAN *</label>
            <input
              type="text"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="ABCDE1234F"
              maxLength={10}
              required
            />
          </div>

          {/* Row 4 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Aadhaar *</label>
            <input
              type="text"
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="12 digits"
              maxLength={12}
              required
            />
          </div>

          {/* Password ABOVE Address (only for HR/FINANCE) */}
          {(role === "HR" || role === "FINANCE") && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border px-2.5 py-1.5 text-sm"
                required
              />
            </div>
          )}

          {/* Address (full width) */}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-700">Address *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border px-2.5 py-1.5 text-sm"
              placeholder="Flat / Street / City / PIN"
              rows={2}
              required
            />
          </div>

          {/* Actions */}
          <div className="md:col-span-3 pt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-[#C1272D] text-white font-medium px-3 py-1.5 text-sm hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Onboarding Employee...." : "Onboard Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------- Update User Modal ------------------------- */
function UpdateUserModal({ data, onClose, onUpdated }) {
  const [name, setName] = useState(data?.name || "");
  const [email, setEmail] = useState(data?.email || "");
  const [doj, setDoj] = useState(data?.doj || "");
  const [phone, setPhone] = useState(data?.number || "");
  const [role, setRole] = useState(data?.role || "HR");
  const [company, setCompany] = useState(data?.company || "");
  const [grossSalary, setGrossSalary] = useState(String(data?.grossSalary ?? ""));
  const [aadhaar, setAadhaar] = useState(String(data?.adhaarnumber ?? ""));
  const [pan, setPan] = useState(String(data?.pancard ?? ""));
  const [address, setAddress] = useState(String(data?.address ?? ""));
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!data?.employeeid) return "Missing employee ID.";
    if (!name.trim()) return "Full name is required.";
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email format looks invalid.";
    if (!role) return "Please select a role.";
    if (!company.trim()) return "Company is required.";
    if (String(grossSalary).trim() === "" || isNaN(Number(grossSalary))) return "Gross Salary is required and must be numeric.";
    const aadhaarDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaarDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
    const panNorm = String(pan || "").toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid.";
    if (!String(address || "").trim()) return "Address is required.";
    if (phone && !String(phone).replace(/\D/g, "").length) return "Phone must contain digits.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      return Swal.fire({ icon: "error", title: "Validation error", text: err });
    }
    try {
      setSubmitting(true);
      const body = {
        employeeid: data.employeeid,
        name,
        email,
        role,
        doj,
        phone,
        company,
        grossSalary: String(grossSalary).trim(),
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address: String(address).trim(),
      };

      const res = await fetch(`/api/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update employee");
      onUpdated?.();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Update failed", text: e.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      {/* Wider + compact */}
      <div className="relative w-full md:max-w-7xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">Update Employee</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        {/* Compact form: 3 columns */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Row 1 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Employee ID</label>
            <input
              type="text"
              value={data?.employeeid ?? ""}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Full name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Date of Joining</label>
            <input
              type="date"
              value={doj || ""}
              onChange={(e) => setDoj(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="+91 98765 43210"
            />
          </div>

          {/* Row 3 */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Company *</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Gross Salary *</label>
            <input
              type="text"
              inputMode="decimal"
              value={grossSalary}
              onChange={(e) => setGrossSalary(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">PAN *</label>
            <input
              type="text"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="ABCDE1234F"
              maxLength={10}
              required
            />
          </div>

          {/* Row 4: Aadhaar + Address (Address takes 2 cols) */}
          <div>
            <label className="block text-xs font-medium text-gray-700">Aadhaar *</label>
            <input
              type="text"
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              placeholder="12 digits"
              maxLength={12}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700">Address *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border px-2.5 py-1.5 text-sm"
              placeholder="Flat / Street / City / PIN"
              rows={1}
              required
            />
          </div>

          {/* Actions */}
          <div className="md:col-span-3 pt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-[#C1272D] text-white font-medium px-3 py-1.5 text-sm hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Updating…" : "Update Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
