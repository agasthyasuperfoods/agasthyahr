// /src/components/AppHeader.js
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];

export default function AppHeader({
  currentPath = "",
  hrName = "HR",
  onLogout,
  onProfileSaved, // ← optional: parent can update name after profile save
  logoSrc = "/agasthyalogo.png",
  navItems = [
    { href: "/Hrdashboard", label: "Home" },
    { href: "/Employees", label: "Attendance" },
    { href: "/exemployees", label: "Ex Employees" },
    { href: "/Assets", label: "Assets" },
    { href: "/Employee", label: "Employees" },
    { href: "/Documents", label: "Documents" },
  ],
  loginHref = "/Hlogin",
}) {
  const router = useRouter();
  const pathNow = currentPath || router?.asPath || "";
  const isActive = (href) => pathNow === href || pathNow.startsWith(href + "/");

  // Profile state (moved here)
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  function getAuthIdentity() {
    if (typeof window === "undefined") return { id: null, email: null };
    const ls = window.localStorage;
    return {
      id: ls.getItem("hr_employeeid") || null,
      email: ls.getItem("hr_email") || null,
    };
  }

  // Open profile: fetch user by employeeid first, fallback to email
  const openProfile = async () => {
    try {
      setProfileLoading(true);
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

      if (!me) throw new Error("Your profile could not be found");
      setProfileUser(me);
      setShowProfile(true);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Profile", text: e.message || "Unable to load profile" });
    } finally {
      setProfileLoading(false);
    }
  };

  // Logout (kept as-is)
  const defaultLogout = async () => {
    const url = loginHref || "/Hlogin";
    try {
      if (typeof window !== "undefined") {
        const KEYS = [
          "hr_auth", "hr_name", "hr_email", "hr_employeeid", "hr_role", "hr_remember",
          "auth", "remember", "auth_role", "auth_email",
          "adminName", "adminEmail", "adminEmployeeId",
        ];
        KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
        try {
          for (const k of Object.keys(localStorage)) {
            if (/^(hr_|auth_)/i.test(k)) localStorage.removeItem(k);
          }
        } catch {}
        try { sessionStorage.clear(); } catch {}
        try { await router.replace(url); } catch {}
        setTimeout(() => { window.location.replace(url); }, 0);
        return;
      }
    } catch {}
    if (typeof window !== "undefined") window.location.href = url;
  };

  const handleLogoutClick = async () => {
    await defaultLogout();
    if (typeof onLogout === "function") {
      try { await onLogout(); } catch {}
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="relative h-20 w-20">
            <Image src={logoSrc} alt="Agasthya Super Foods" fill className="object-contain" />
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  isActive(item.href) ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Profile button now opens the internal Profile modal */}
            <button
              type="button"
              onClick={openProfile}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
              title={hrName ? `Profile • ${hrName}` : "Profile"}
              aria-label="Profile"
              disabled={profileLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" d="M12 12a5 5 0 100-10 5 5 0 000 10zM3 22a9 9 0 1118 0H3z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              className="inline-flex items-center rounded-lg bg-[#C1272D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a02125]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Profile Modal (moved here) */}
      {showProfile && profileUser ? (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => {
            setShowProfile(false);
            if (typeof onProfileSaved === "function") {
              try { onProfileSaved(updated); } catch {}
            }
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

/* ---------------------
   Inline ProfileModal
   --------------------- */
function ProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role || "HR");
  const [doj, setDoj] = useState(user?.doj || "");
  const [phone, setPhone] = useState(user?.number || "");
  const [company, setCompany] = useState(user?.company || "");
  const [aadhaar, setAadhaar] = useState(user?.adhaarnumber || "");
  const [pan, setPan] = useState(user?.pancard || "");
  const [address, setAddress] = useState(user?.address || "");
  // extra fields so “all” are visible/editable
  const [designation, setDesignation] = useState(user?.designation || "");
  const [reportingToId, setReportingToId] = useState(user?.reporting_to_id || "");
  const [gross, setGross] = useState(String(user?.grosssalary ?? user?.grossSalary ?? ""));

  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!name.trim()) return "Full name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Valid email is required.";
    if (!role) return "Role is required.";
    if (!company.trim()) return "Company is required.";
    const aadhaarDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaarDigits && aadhaarDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
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
        employeeid: user.employeeid,
        name,
        email,
        role,
        doj,
        number: phone,
        company,
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address,
        // include the extras
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
      if (!res.ok) throw new Error(json?.error || "Failed to update profile");
      onSaved?.(json?.data || body);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Update failed", text: e.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-4xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input
                type="text"
                value={user?.employeeid ?? ""}
                readOnly
                disabled
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
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
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input
                type="date"
                value={doj || ""}
                onChange={(e) => setDoj(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={phone || ""}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="ASF / AGB / ASF-FACTORY / ANM / AVION / SRI CHAKRA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (12 digits)</label>
              <input
                type="text"
                value={aadhaar || ""}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="000000000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input
                type="text"
                value={pan || ""}
                onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="ABCDE1234F"
              />
            </div>
          </div>

          {/* Extra fields to show ALL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g. Sr. Executive"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting To (Employee ID)</label>
              <input
                type="text"
                value={reportingToId}
                onChange={(e) => setReportingToId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g. EMP1002"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input
                type="number"
                step="0.01"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g. 30000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea
              rows={2}
              value={address || ""}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Flat / Street / City / State / PIN"
            />
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
              className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]"
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
