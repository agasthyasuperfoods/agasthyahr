import React, { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

// --- Paste your EmployeeProfileModal component here ---

export default function SuperfoodsHeader({
  adminName = "Admin",
  onProfileClick,
  onLogout,
}) {
  const router = useRouter();
  const currentPath = router.pathname;
  const [profileOpen, setProfileOpen] = useState(false);

  // Default logout behavior
  const defaultLogout = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        localStorage.removeItem("adminEmail");
        localStorage.removeItem("adminEmployeeId");
        localStorage.removeItem("adminName");
      }
      await router.replace("/Acclogin");
    } catch {
      if (typeof window !== "undefined") window.location.href = "/Acclogin";
    }
  }, [router]);

  // Change default profile—now opens a modal
  const defaultProfile = useCallback(() => setProfileOpen(true), []);

  const handleLogout = onLogout || defaultLogout;
  const handleProfile = onProfileClick || defaultProfile;

  const NAV = [
    { href: "/Accountsmodule", label: "Paysheet" },
    { href: "/SuperfoodsPayslips", label: "Payslips" },
    { href: "/SuperfoodsReimbursement", label: "Reimbursement" },
    { href: "/AccEmployees", label: "Employees" },
    { href: "/SuperfoodsReports", label: "Reports" },
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
        {/* Profile + Logout */}
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
      {/* Modal Profile */}
      <EmployeeProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}
