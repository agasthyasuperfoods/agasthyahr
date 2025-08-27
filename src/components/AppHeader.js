import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";

export default function AppHeader({
  currentPath = "",
  hrName = "HR",
  onProfileClick = () => {},
  onLogout,
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
          <button
            type="button"
            onClick={onProfileClick}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
            title={hrName ? `Profile • ${hrName}` : "Profile"}
            aria-label="Profile"
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
  );
}
