// /src/pages/forgot-password.js
import { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import { Mail, CheckCircle2, ArrowLeft } from "lucide-react";

function classifyIdentifier(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  return isEmail ? "email" : "id";
}

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const idTrim = identifier.trim();
    if (!idTrim) {
      Swal.fire({
        icon: "warning",
        title: "Enter your email or employee ID",
        confirmButtonColor: "#C1272D",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: idTrim }), // email or employee id
      });
      // We intentionally treat any 200/202 as success and avoid leaking user existence
      if (!res.ok && res.status !== 202) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not start reset");
      }
      setSent(true);
    } catch (err) {
      // Still flip to "sent" to avoid user enumeration (optional).
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password • Agasthya</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-50 via-white to-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur border border-gray-100 rounded-2xl shadow-xl p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4 mx-auto h-24 w-24 md:h-28 md:w-28">
                <Image
                  src="/agasthyalogo.png"
                  alt="Agasthya Super Foods"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Forgot your password?</h1>
              <p className="text-sm text-gray-500 mt-1 text-center">
                Enter your work email or employee ID and we&apos;ll send a reset link.
              </p>
            </div>

            {!sent ? (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                    Email or Employee ID
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoFocus
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#C1272D]/20 focus:border-[#C1272D]"
                      placeholder="e.g. no-reply@agasthya.co.in or EMP1001"
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-500 select-none">
                      {identifier ? classifyIdentifier(identifier)?.toUpperCase() : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    We&apos;ll email a secure link that expires in ~15 minutes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#C1272D] text-white font-medium py-2.5 hover:bg-[#a02125] focus:outline-none focus:ring-4 focus:ring-[#C1272D]/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Send reset link
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between">
                  <Link href="/Hlogin" className="inline-flex items-center gap-1 text-sm text-gray-700 hover:underline">
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
                <h2 className="text-base font-semibold text-gray-900">Check your email</h2>
                <p className="mt-1 text-sm text-gray-600">
                  If an account exists for what you entered, we&apos;ve sent a reset link.
                  It will expire in ~15 minutes.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Link
                    href="/Hlogin"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
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
