// FILE: src/pages/ProfileTalakondapally.js
import Head from "next/head";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import MobileFooterMenu from "@/components/MobileFooterMenu";

const PRIMARY = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_TEXT = "text-white";
const MUTED_BTN = "bg-gray-100 hover:bg-gray-200";
const INPUT_FOCUS = "focus:outline-none focus:ring-2 focus:ring-amber-300";

export default function ProfileTalakondapally() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [loading, setLoading] = useState(true);

  // change-password modal state
  const [showChange, setShowChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    // populate profile fields from localStorage (if available)
    if (typeof window === "undefined") return;
    setName(localStorage.getItem("name") || "");
    setDesignation(localStorage.getItem("role") || localStorage.getItem("designation") || "");
    setLoading(false);
  }, []);

  const logout = () => {
    try {
      if (typeof window !== "undefined") {
        // clear auth-related keys (mirror keys used elsewhere in the app)
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        localStorage.removeItem("name");
        localStorage.removeItem("email");
        localStorage.removeItem("employeeid");
        localStorage.removeItem("role");
        localStorage.removeItem("hr_auth");
        localStorage.removeItem("hr_role");
        localStorage.removeItem("hr_name");
        localStorage.removeItem("hr_email");
        localStorage.removeItem("hr_employeeid");
      }
      router.push("/Talakondapallylogin");
      // fallback forced navigation
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.replace("/Talakondapallylogin");
      }, 50);
    } catch {
      if (typeof window !== "undefined") window.location.replace("/Talakondapallylogin");
    }
  };

  const openChangeModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowChange(true);
  };

  const submitChangePassword = async (e) => {
    e?.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Swal.fire({ icon: "warning", title: "Missing fields", text: "Please fill all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      Swal.fire({ icon: "warning", title: "Mismatch", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 6) {
      Swal.fire({ icon: "warning", title: "Weak password", text: "New password must be at least 6 characters." });
      return;
    }

    try {
      setSavingPassword(true);
      // call your backend change-password endpoint
      // adjust URL and payload to your API contract
      const res = await fetch("/api/talakondapally/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || j?.message || "Password change failed");
      Swal.fire({ icon: "success", title: "Password changed", text: "Your password has been updated." });
      setShowChange(false);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Change failed", text: err.message || "Something went wrong" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Head>
        <title>Profile — Talakondapally</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50 pb-14">
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-gray-900">Profile</div>
            <div className="text-xs text-gray-500">Talakondapally</div>
          </div>
        </header>

        <section className="p-4">
          <div className="max-w-md mx-auto space-y-4">

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center text-xl font-semibold">
                  {name ? name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{name || "—"}</div>
                  <div className="text-xs text-gray-500">{designation || "—"}</div>
                </div>
              </div>
            </div>

            {/* Profile fields (read-only) */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-600">Name</label>
                <input
                  className={`w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 ${INPUT_FOCUS}`}
                  value={name}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600">Designation</label>
                <input
                  className={`w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 ${INPUT_FOCUS}`}
                  value={designation}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600">Change password</label>
                <div className="mt-2">
              <button
  type="button"
  disabled
  className={`w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm font-medium text-gray-400 cursor-not-allowed`}
>
  Change password (disabled)
</button>

                </div>
                <p className="mt-2 text-xs text-gray-400">Click to change your account password.</p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={logout}
                  className={`w-full px-4 py-2 rounded-lg ${PRIMARY} ${PRIMARY_TEXT} font-medium`}
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-gray-400">
              <div>Other profile actions are not available here.</div>
            </div>
          </div>
        </section>

        <MobileFooterMenu />
      </main>

      {/* Change Password Modal */}
      {showChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!savingPassword) setShowChange(false); }}
            aria-hidden
          />

          <form
            onSubmit={submitChangePassword}
            className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-auto"
          >
            {/* header with better color contrast */}
            <div className="flex items-center justify-between px-4 py-3 bg-amber-600 rounded-t-xl">
              <div className="text-sm font-semibold text-white">Change password</div>
              <button
                type="button"
                onClick={() => { if (!savingPassword) setShowChange(false); }}
                className="p-2 rounded-md hover:bg-amber-700/20 text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600">Current password</label>
                <input
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  type="password"
                  className={`w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${INPUT_FOCUS}`}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600">New password</label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  className={`w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${INPUT_FOCUS}`}
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600">Confirm new password</label>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  className={`w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${INPUT_FOCUS}`}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { if (!savingPassword) setShowChange(false); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={savingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className={`px-4 py-2 rounded-lg ${PRIMARY} ${PRIMARY_TEXT} text-sm`}
                >
                  {savingPassword ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="text-xs text-gray-400">
                Tip: Use at least 6 characters. For stronger security, use a mix of letters and numbers.
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
