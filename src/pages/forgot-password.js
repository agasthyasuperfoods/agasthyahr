import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";

function normalizeToPath(toParam) {
  const ALLOWED = new Set(["/Alogin", "/Hlogin"]);
  if (!toParam) return "/Hlogin";
  let s = String(toParam).trim();
  if (!s.startsWith("/")) s = `/${s}`;
  return ALLOWED.has(s) ? s : "/Hlogin";
}

export default function ResetPassword() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [toPath, setToPath] = useState("/Hlogin");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    setToken(typeof router.query.token === "string" ? router.query.token : "");
    setToPath(normalizeToPath(router.query?.to));
  }, [router.isReady, router.query]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) { Swal.fire({ icon: "error", title: "Invalid link", text: "Missing or malformed token." }); return; }
    if (pwd.length < 8) { Swal.fire({ icon: "warning", title: "Too short", text: "Password must be at least 8 characters." }); return; }
    if (pwd !== pwd2) { Swal.fire({ icon: "warning", title: "Mismatch", text: "Passwords do not match." }); return; }

    try {
      setSaving(true);
      const res = await fetch("/api/auth/reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwd, to: toPath }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Reset failed");

      await Swal.fire({ icon: "success", title: "Password updated", text: "You can now sign in with your new password." });
      router.replace(toPath);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Reset failed", text: err.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head><title>Reset Password • Agasthya</title></Head>
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-lg font-semibold text-gray-900">Set a new password</h1>
          <p className="text-sm text-gray-600 mt-1">Enter and confirm your new password.</p>

          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-700">New password</label>
              <div className="relative mt-1">
                <input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 text-sm" placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-gray-500">{show ? "Hide" : "Show"}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700">Confirm password</label>
              <input type={show ? "text" : "password"} value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium py-2.5 hover:bg-[#a02125] disabled:opacity-60">
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
