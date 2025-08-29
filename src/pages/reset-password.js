import { useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import { Lock, CheckCircle2, ArrowLeft } from "lucide-react";

function normalizeToPath(toParam) {
  const ALLOWED = new Set(["/Alogin", "/Hlogin"]);
  if (!toParam) return "/Hlogin";
  let s = String(toParam).trim();
  if (!s.startsWith("/")) s = `/${s}`; // allow "Alogin" -> "/Alogin"
  return ALLOWED.has(s) ? s : "/Hlogin";
}

// Read token & to directly from the URL on FIRST render (before router is ready).
function readInitialQuery() {
  if (typeof window === "undefined") return { token: "", to: "/Hlogin" };
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token") || "";
    const to = normalizeToPath(url.searchParams.get("to"));
    return { token, to };
  } catch {
    return { token: "", to: "/Hlogin" };
  }
}

export default function ResetPassword() {
  const router = useRouter();

  const initial = readInitialQuery();
  const [token, setToken] = useState(initial.token);
  const [toPath, setToPath] = useState(initial.to);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Sync with router when it becomes ready (covers client-side navigations)
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query || {};
    if (typeof q.token === "string") setToken(q.token);
    setToPath(normalizeToPath(q.to));
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!token) return;
    if (String(token).length < 16) {
      Swal.fire({ icon: "error", title: "Invalid link", text: "This reset link is invalid." });
    }
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) {
      Swal.fire({ icon: "error", title: "Invalid link", text: "Missing reset token." });
      return;
    }
    if (!pwd || pwd.length < 4) {
      Swal.fire({ icon: "warning", title: "Weak password", text: "Use at least 4 characters." });
      return;
    }
    if (pwd !== pwd2) {
      Swal.fire({ icon: "warning", title: "Passwords don’t match", text: "Please retype the same password." });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwd }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Reset failed");
      setDone(true);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Reset failed", text: e.message || "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  const goBack = async () => {
    try {
      await router.replace(toPath);
    } catch {
      if (typeof window !== "undefined") window.location.href = toPath;
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password • Agasthya HR</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-50 via-white to-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur border border-gray-100 rounded-2xl shadow-xl p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4 mx-auto h-24 w-24 md:h-28 md:w-28">
                <Image src="/agasthyalogo.png" alt="Agasthya Super Foods" fill className="object-contain" priority />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
              <p className="text-sm text-gray-500 mt-1 text-center">Create a new password for your account.</p>
            </div>

            {!done ? (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700">New password</label>
                  <div className="mt-1 relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                      placeholder="At least 4 characters"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                      title={showPwd ? "Hide" : "Show"}
                    >
                      <Lock className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirm password</label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={pwd2}
                    onChange={(e) => setPwd2(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                    placeholder="Retype your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#C1272D] text-white font-medium py-2.5 hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    "Set new password"
                  )}
                </button>

                <div className="flex items-center justify-between">
                  <Link href={toPath} className="inline-flex items-center gap-1 text-sm text-gray-700 hover:underline">
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                  <span className="text-xs text-gray-400">v1.0</span>
                </div>
              </form>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-green-50 text-green-700 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Password updated</h2>
                <p className="mt-1 text-sm text-gray-600">You can now sign in with your new password.</p>
                <div className="mt-4">
                  <button
                    onClick={goBack}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Go to sign in
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} Agasthya Super Foods. All rights reserved.
          </div>
        </div>
      </main>
    </>
  );
}
