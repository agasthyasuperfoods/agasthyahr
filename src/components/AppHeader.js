import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];
const companyKey = (empId) => `hr_company_${String(empId || "anon")}`;

export default function AppHeader({
  currentPath = "",
  hrName = "HR",
  hrCompany = "",     // <- parent passes the resolved company (authoritative)
  onLogout,
  onProfileSaved,
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

  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Local display fallback (if parent hasn't resolved yet)
  const [fallbackCompany, setFallbackCompany] = useState("");

  // Keep header badge consistent on first paint even if parent prop is empty
  useEffect(() => {
    let dead = false;
    if (hrCompany) {
      setFallbackCompany(hrCompany);
      return;
    }
    (async () => {
      try {
        // 1) Ask server who I am
        let me = null;
        try {
          const r = await fetch("/api/me", { credentials: "include" });
          const j = await r.json().catch(() => ({}));
          if (j && (j.employeeid || j.name)) me = j;
        } catch {}

        // 2) Fall back to LS id if server didn't identify
        let id = me?.employeeid || (typeof window !== "undefined" ? localStorage.getItem("hr_employeeid") : "") || "";
        let company = (me?.company || "").trim();

        if (!company && id) {
          // Pull user row so we can show the right company
          try {
            const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { credentials: "include" });
            const j = await r.json().catch(() => ({}));
            if (r.ok && Array.isArray(j?.data) && j.data.length) {
              company = (j.data[0]?.company || "").trim();
            }
          } catch {}
        }

        // 3) Namespaced LS fallback
        if (!company && id && typeof window !== "undefined") {
          company = (localStorage.getItem(companyKey(id)) || "").trim();
        }

        if (!dead) setFallbackCompany(company || "");
      } catch {}
    })();
    return () => { dead = true; };
  }, [hrCompany]);

  const openProfile = async () => {
    try {
      setProfileLoading(true);
      let me = null;
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (j && (j.employeeid || j.email)) me = j;
      } catch {}

      if (!me && typeof window !== "undefined") {
        const id = localStorage.getItem("hr_employeeid");
        const email = localStorage.getItem("hr_email");
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
          Object.keys(localStorage).forEach((k) => {
            if (k === "hr_company" || /^hr_company_/.test(k)) localStorage.removeItem(k);
          });
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

  const shownCompany = (hrCompany || fallbackCompany || "").trim();

  return (
    <>
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              <Image src={logoSrc} alt="Agasthya Super Foods" fill className="object-contain" />
            </div>
        
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  pathNow === item.href || pathNow.startsWith(item.href + "/")
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
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

      {showProfile && profileUser ? (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => {
            setShowProfile(false);
            const nextCompany = String(updated?.company || "").trim();
            const by = updated?.employeeid || profileUser?.employeeid || "";
            try {
              localStorage.setItem(companyKey(by), nextCompany);
              document.cookie = `hr_company_${encodeURIComponent(by)}=${encodeURIComponent(nextCompany)}; Path=/; Max-Age=31536000; SameSite=Lax`;
              window.dispatchEvent(new CustomEvent("hr-company-changed", { detail: { company: nextCompany, by } }));
            } catch {}
            if (typeof onProfileSaved === "function") {
              try { onProfileSaved(updated); } catch {}
            }
            Swal.fire({ icon: "success", title: "Profile updated", text: "Your changes have been saved.", confirmButtonColor: "#C1272D" });
          }}
        />
      ) : null}
    </>
  );
}

/* ---------------- Profile Modal ---------------- */
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
    if (err) { Swal.fire({ icon: "error", title: "Validation error", text: err }); return; }
    try {
      setSubmitting(true);
      const body = {
        employeeid: user.employeeid,
        name, email, role, doj, number: phone, company,
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address,
        designation: String(designation).trim() || null,
        reporting_to_id: String(reportingToId).trim() || null,
      };
      if (String(gross).trim() !== "") body.grosssalary = String(gross).trim();

      const res = await fetch("/api/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input type="text" value={user?.employeeid ?? ""} readOnly disabled className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
            </div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input type="date" value={doj || ""} onChange={(e) => setDoj(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={phone || ""} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="+91 98765 43210" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ASF / AGB / ASF-FACTORY / ANM / AVION / SRI CHAKRA" />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Sr. Executive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reporting To (Employee ID)</label>
              <input type="text" value={reportingToId} onChange={(e) => setReportingToId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. EMP1002" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gross Salary</label>
              <input type="number" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. 30000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea rows={2} value={address || ""} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Flat / Street / City / State / PIN" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
