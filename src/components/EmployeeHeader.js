import React, { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

// Modal for employee profile (API update & vertical centering)
function EmployeeProfileModal({ open, onClose }) {
  const [profile, setProfile] = useState({
    employeeId: "",
    employeeName: "",
    employeeEmail: "",
    employeeMobile: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      const employeeId = localStorage.getItem("employeeId") || "";
      setProfile(prev => ({ ...prev, employeeId }));
      if (employeeId) {
        setLoading(true);
        fetch(`/api/emp?employeeid=${employeeId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setProfile({
                employeeId: data.employeeid || "",
                employeeName: data.name || "",
                employeeEmail: data.email || "",
                employeeMobile: data.number || "",
              });
            }
          })
          .finally(() => setLoading(false));
      }
    }
  }, [open]);

  const handleChange = (e) => {
    setProfile((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/emp', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeid: profile.employeeId,
          name: profile.employeeName,
          number: profile.employeeMobile
        })
      });
      const data = await res.json();
      if (data.success) {
        await Swal.fire({
          title: "Saved!",
          text: "Your profile has been updated.",
          icon: "success",
          confirmButtonColor: "#C1272D",
          timer: 1500,
        });
        if (onClose) onClose();
      } else {
        await Swal.fire({
          title: "Error",
          text: data.message,
          icon: "error",
          confirmButtonColor: "#C1272D"
        });
      }
    } catch (err) {
      await Swal.fire({
        title: "Error",
        text: err.message,
        icon: "error",
        confirmButtonColor: "#C1272D"
      });
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50  flex min-h-screen items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 sm:p-10 flex flex-col justify-center relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-red-700 text-2xl font-bold"
          aria-label="Close"
          type="button"
        >
          &times;
        </button>
        <h1 className="text-2xl font-bold mb-8 text-center">Employee Profile</h1>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={e => { e.preventDefault(); handleSave(); }}
        >
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Employee ID</label>
            <input
              type="text"
              value={profile.employeeId}
              readOnly
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="employeeName"
              value={profile.employeeName}
              onChange={handleChange}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={profile.employeeEmail}
              readOnly
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              name="employeeMobile"
              value={profile.employeeMobile}
              onChange={handleChange}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              pattern="[0-9]{10}"
              maxLength={10}
              required
              placeholder="Enter mobile number"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-1/2 py-2 rounded-lg bg-[#C1272D] text-white font-semibold hover:bg-[#a02125] shadow"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

export default function EmployeeHeader({
  adminName = "Admin",
  onProfileClick,
  onLogout,
}) {
  const router = useRouter();
  const currentPath = router.pathname;
  const [profileOpen, setProfileOpen] = useState(false);

  const defaultLogout = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        localStorage.removeItem("adminEmail");
        localStorage.removeItem("adminEmployeeId");
        localStorage.removeItem("adminName");
        localStorage.removeItem("employeeId");
        localStorage.removeItem("employeeName");
        localStorage.removeItem("employeeEmail");
        localStorage.removeItem("employeeMobile");
      }
      await router.replace("/Emplogin");
    } catch {
      if (typeof window !== "undefined") window.location.href = "/Emplogin";
    }
  }, [router]);

  const defaultProfile = useCallback(() => {
    setProfileOpen(true);
  }, []);

  const handleLogout = onLogout || defaultLogout;
  const handleProfile = onProfileClick || defaultProfile;

  const NAV = [
    { href: "/Edash", label: "Payslip" },
    { href: "/ReimbursementRequest", label: "Reimbursement" },
    { href: "/Timesheet", label: "Timesheet" },
    { href: "/Leaves", label: "Leaves" },
  ];

  const isActive = (href) => currentPath === href;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-[10rem] md:h-12 md:w-[13rem]">
            <Image
              src="/agasthyalogo.png"
              alt="Agasthya Superfoods"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${isActive(n.href)
                  ? "bg-[#C1272D] text-white"
                  : "text-gray-700 hover:bg-[#C1272D]/10"
                }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleProfile}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            title="Profile"
          >
            Profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#C1272D] text-white text-sm hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/30"
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>
      <EmployeeProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}
