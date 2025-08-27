// src/pages/Alogin.js
import { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isEmpId = (s) => /^([A-Za-z]{2,}-?\d+|EMP-?\d+)$/i.test(s); // e.g. EMP-001 or HR12

export default function Alogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Missing credentials",
        text: "Please provide both your username/email and password.",
      });
      return;
    }

    try {
      setLoading(true);

      // Authenticate
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, remember }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Invalid credentials");

      // Persist auth + identity keys for Admin page to resolve your profile
      if (typeof window !== "undefined") {
        const idTrim = identifier.trim();

        localStorage.setItem("auth", "1");
        if (remember) localStorage.setItem("remember", "1");
        else localStorage.removeItem("remember");

        // Prefer email, else employee id, else name
        if (isEmail(idTrim)) {
          localStorage.setItem("adminEmail", idTrim);
          localStorage.removeItem("adminEmployeeId");
          localStorage.setItem("adminName", idTrim.split("@")[0]);
        } else if (isEmpId(idTrim)) {
          localStorage.setItem("adminEmployeeId", idTrim);
          localStorage.removeItem("adminEmail");
          localStorage.setItem("adminName", idTrim);
        } else {
          localStorage.setItem("adminName", idTrim);
          localStorage.removeItem("adminEmail");
          localStorage.removeItem("adminEmployeeId");
        }
      }

      await router.push("/Admin");
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Login failed",
        text: err.message || "The username or password you entered is incorrect.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin Sign In • Agasthya Super Foods</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-50 via-white to-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur border border-gray-100 rounded-2xl shadow-xl p-8">
            {/* Logo + header */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4 mx-auto h-32 w-32 md:h-40 md:w-40 lg:h-44 lg:w-44">
                <Image
                  src="/agasthyalogo.png"
                  alt="Agasthya Super Foods"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Console</h1>
              <p className="text-sm text-gray-500 mt-1">Secure access to operational dashboards</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                  placeholder="vardhan"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <a href="#" className="text-xs text-[#C1272D] hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    title={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" d="M3 3l18 18M10.58 10.58a3 3 0 104.24 4.24M9.88 5.5A9.77 9.77 0 0121 12c-.6 1.03-1.36 1.99-2.25 2.82M6.26 6.26A9.77 9.77 0 003 12c.6 1.03 1.36 1.99 2.25 2.82" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#C1272D] focus:ring-[#C1272D]"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <span className="text-xs text-gray-400">v1.0</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium py-2.5 hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>

              <p className="text-center text-xs text-gray-500">
                By signing in, you acknowledge our{" "}
                <a href="/" className="text-[#C1272D] hover:underline">Privacy Policy</a>.
              </p>
            </form>
          </div>

          <div className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} Agasthya Super Foods. All rights reserved.
          </div>
        </div>
      </main>
    </>
  );
}
