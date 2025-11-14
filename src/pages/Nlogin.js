import { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Swal from "sweetalert2";

export default function Nlogin() {
  const [employeeId, setEmployeeId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    const empTrim = employeeId.trim().toLowerCase(); // case-insensitive
    const pwdTrim = passcode.trim();

    if (!empTrim || !pwdTrim) {
      Swal.fire({
        icon: "warning",
        title: "Missing details",
        text: "Please enter both Employee ID and Passcode.",
        confirmButtonColor: "#C1272D",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/nutromilk/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empTrim, passcode: pwdTrim }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error || "Invalid credentials");

      // Save session and redirect
      if (typeof window !== "undefined") {
        localStorage.setItem("nutro_auth", "1");
        localStorage.setItem("nutro_empid", json?.user?.employeeId || empTrim);
        localStorage.setItem("nutro_name", json?.user?.name || "Employee");
      }

      window.location.href = "/NutromilkAccounts";
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Login failed",
        text: err.message || "Invalid Employee ID or Passcode.",
        confirmButtonColor: "#C1272D",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Nutromilk Employee Login • Agasthya Nutromilk</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-50 via-white to-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur border border-gray-100 rounded-2xl shadow-xl p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4 mx-auto h-28 w-28 md:h-36 md:w-36">
                <Image
                  src="/logo.png"
                  alt="Agasthya Nutromilk"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Nutromilk Login</h1>
              <p className="text-sm text-gray-500 mt-1">
                Access your Nutromilk Accounts and operations
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                  Employee ID
                </label>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  autoComplete="username"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                  placeholder="e.g. EMP16"
                />
              </div>

              <div>
                <label htmlFor="passcode" className="block text-sm font-medium text-gray-700">
                  Passcode
                </label>
                <div className="mt-1 relative">
                  <input
                    id="passcode"
                    name="passcode"
                    type={showPwd ? "text" : "password"}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPwd ? "Hide passcode" : "Show passcode"}
                  >
                    {showPwd ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="2" d="M3 3l18 18M10.58 10.58a3 3 0 104.24 4.24" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="2" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium py-2.5 hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Logging in…
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </form>
          </div>

          <div className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} Agasthya Nutromilk. All rights reserved.
          </div>
        </div>
      </main>
    </>
  );
}
