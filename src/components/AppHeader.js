// src/components/AppHeader.js
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];
const companyKey = (empId) => `hr_company_${String(empId || "anon")}`;

// ---- Exact-match helpers to avoid EMP12 -> EMP125 mixups ----
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

export default function AppHeader({
  currentPath = "",
  hrName = "HR",
  hrUser = null,     // <-- accept the exact-match user from parent (Hrdashboard)
  hrCompany = "",    // <-- parent can also pass authoritative company
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

    // 1) Prefer company from parent props (authoritative)
    if (hrCompany?.trim()) {
      setFallbackCompany(hrCompany.trim());
      return;
    }

    // 2) If parent gave the full hrUser, use that
    if (hrUser?.company?.trim()) {
      setFallbackCompany(hrUser.company.trim());
      return;
    }

    // 3) Try to resolve on our own (server -> id -> LS)
    (async () => {
      try {
        let me = null;
        // Ask server who I am
        try {
          const r = await fetch("/api/me", { credentials: "include" });
          const j = await r.json().catch(() => ({}));
          if (j && (j.employeeid || j.name)) me = j;
        } catch {}

        // Use id/email from server or LS
        let id =
          me?.employeeid ||
          (typeof window !== "undefined" ? localStorage.getItem("hr_employeeid") : "") ||
          "";
        let company = (me?.company || "").trim();

        // Pull user row to get company if still empty
        if (!company && id) {
          try {
            const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { credentials: "include" });
            const j = await r.json().catch(() => ({}));
            if (r.ok) {
              const exact = pickExactById(j?.data, id);
              if (exact) company = (exact.company || "").trim();
            }
          } catch {}
        }

        // Namespaced LS fallback
        if (!company && id && typeof window !== "undefined") {
          company = (localStorage.getItem(companyKey(id)) || "").trim();
        }

        if (!dead) setFallbackCompany(company || "");
      } catch {}
    })();

    return () => {
      dead = true;
    };
  }, [hrCompany, hrUser]);

  const openProfile = async () => {
    try {
      setProfileLoading(true);
      let me = null;

      // 0) If parent already gave us the exact user, use it directly
      if (hrUser && (hrUser.employeeid || hrUser.email)) {
        me = hrUser;
      }

      // 1) Otherwise, try /api/me
      if (!me) {
        try {
          const r = await fetch("/api/me", { credentials: "include" });
          const j = await r.json().catch(() => ({}));
          if (j && (j.employeeid || j.email)) me = j;
        } catch {}
      }

      // 2) Fallback to LS id/email, fetch exact match from /api/users
      if (!me && typeof window !== "undefined") {
        const id = localStorage.getItem("hr_employeeid");
        const email = localStorage.getItem("hr_email");

        if (id) {
          const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok) me = pickExactById(j?.data, id) || me;
        }
        if (!me && email) {
          const r = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok) me = pickExactByEmail(j?.data, email) || me;
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
        KEYS.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
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

  const shownCompany = (hrCompany || hrUser?.company || fallbackCompany || "").trim();

  return (
    <>
      {/* MADE STICKY */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              <Image src={logoSrc} alt="Agasthya Super Foods" fill className="object-contain" />
            </div>
            {/* If you want to show company badge in header, uncomment:
            {shownCompany ? (
              <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
                {shownCompany}
              </span>
            ) : null}
            */}
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
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          {/* form fields unchanged */}
          {/* ... */}
        </form>
      </div>
    </div>
  );
}
