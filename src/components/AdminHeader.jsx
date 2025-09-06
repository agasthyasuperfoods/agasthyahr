// /src/components/AdminHeader.jsx
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback } from "react";

export default function AdminHeader({
  currentPath = "",
  adminName = "Admin",
  onProfileClick,   // optional
  onLogout,         // optional
}) {
  const router = useRouter();

  // Fallback logout if parent doesn't provide one
  const defaultLogout = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        localStorage.removeItem("adminEmail");
        localStorage.removeItem("adminEmployeeId");
        localStorage.removeItem("adminName");
      }
      await router.replace("/Alogin");
    } catch {
      if (typeof window !== "undefined") window.location.href = "/Alogin";
    }
  }, [router]);

  // Always-available Profile handler
  const defaultProfile = useCallback(() => {
    router.push("/Admin/profile");
  }, [router]);

  const handleLogout = onLogout || defaultLogout;
  const handleProfile = onProfileClick || defaultProfile;

  const NAV = [
    { href: "/Admin", label: "Home" },
    { href: "/Payrollsuperfoods", label: "Payroll" },
    { href: "/Reports", label: "Reports" },
    { href: "/OrganizationChartPage", label: "Organization Chart" },
  ];

  const isActive = (href) => currentPath && currentPath.startsWith(href.replace(/#.*$/, ""));

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-[9rem] md:h-12 md:w-[11rem]">
            <Image
              src="/agasthyalogo.png"
              alt="Agasthya HR"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Nav */}
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Profile is always visible, all pages, all sizes */}
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
    </header>
  );
}
