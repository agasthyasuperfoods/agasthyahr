// src/pages/Admin.js
import { useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import UsersTable from "@/components/UsersTable";
import Swal from "sweetalert2";

export default function Admin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Profile state
  const [me, setMe] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  // Auth gate → redirect to /Alogin
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = localStorage.getItem("auth") === "1";
    if (!ok) {
      router.replace("/Alogin");
      return;
    }
    setReady(true);
  }, [router]);

  // Fetch logged-in profile (from EmployeeTable) using stored identifiers
  const fetchMe = async () => {
    const fallbackName =
      (typeof window !== "undefined" && localStorage.getItem("adminName")) || "Admin";

    try {
      const email = typeof window !== "undefined" ? localStorage.getItem("adminEmail") : "";
      const empId = typeof window !== "undefined" ? localStorage.getItem("adminEmployeeId") : "";
      const name = typeof window !== "undefined" ? localStorage.getItem("adminName") : "";

      let url = "/api/users";
      if (email) url += `?email=${encodeURIComponent(email)}`;
      else if (empId) url += `?id=${encodeURIComponent(empId)}`;
      else if (name) url += `?name=${encodeURIComponent(name)}`; // if supported

      const res = await fetch(url);
      if (!res.ok) throw new Error("Profile not found");
      const j = await res.json().catch(() => ({}));
      const row = Array.isArray(j?.data) ? j.data[0] : null;
      if (!row) throw new Error("Profile not found");

      setMe({
        name: row.name || fallbackName,
        email: row.email || "",
        role: row.role || "ADMIN",
        phone: row.number || "",
        company: row.company || "",
      });
    } catch {
      setMe({
        name: fallbackName,
        email: "",
        role: "ADMIN",
        phone: "",
        company: "",
      });
    }
  };

  useEffect(() => {
    if (!ready) return;
    fetchMe();
  }, [ready]);

  const handleOpenProfile = async () => {
    await fetchMe(); // refresh before open
    setShowProfile(true);
  };

  const logout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
        // optionally clear identifiers too
        // localStorage.removeItem("adminEmail");
        // localStorage.removeItem("adminEmployeeId");
        // localStorage.removeItem("adminName");
      }
      await router.push("/Alogin");
      if (typeof window !== "undefined") {
        setTimeout(() => window.location.replace("/Alogin"), 50);
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.replace("/Alogin");
      }
    }
  };

  if (!ready) {
    return (
      <>
        <Head><title>Admin • Agasthya Super Foods</title></Head>
        <div className="min-h-screen flex items-center justify-center text-gray-600">
          <span className="inline-block h-6 w-6 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin • Agasthya Super Foods</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 relative">
          <div className="mx-auto px-4 py-3 flex items-center justify-between">
            <div className="relative h-10 w-[9rem]">
              <Image
                src="/agasthyalogo.png"
                alt="Agasthya Super Foods"
                fill
                className="object-contain"
              />
            </div>

            <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold text-gray-900">
              Admin Dashboard
            </h1>

            <div className="flex items-center gap-2">
              {/* Profile button */}
           

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center rounded-lg bg-[#C1272D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a02125]"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="mx-auto p-4 md:p-6 space-y-8">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Welcome{me?.name ? `, ${me.name}` : ", Admin"}
            </h2>
            <p className="text-sm text-gray-600">Manage users, attendance, payroll, and reports from here.</p>
          </div>

          <UsersTable />
        </div>
      </main>

      {showProfile && (
        <ProfileModal
          me={me}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => setMe(updated)}
        />
      )}
    </>
  );
}

/* ------------------ Profile Modal (always editable + single Password field) ------------------ */
function ProfileModal({ me, onClose, onSaved }) {
  const [name, setName] = useState(me?.name || "");
  const [email, setEmail] = useState(me?.email || "");
  const [phone, setPhone] = useState(me?.phone || "");
  const [company, setCompany] = useState(me?.company || "");
  const role = me?.role || "ADMIN";

  // Optional password update (single field)
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      return Swal.fire({ icon: "error", title: "Validation error", text: "Name is required" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Swal.fire({ icon: "error", title: "Validation error", text: "Email looks invalid" });
    }

    try {
      setSaving(true);

      const identifier =
        (typeof window !== "undefined" &&
          (localStorage.getItem("adminEmail") ||
            localStorage.getItem("adminEmployeeId") ||
            localStorage.getItem("adminName"))) ||
        me?.email ||
        me?.name ||
        "";

      const body = {
        identifier,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
      };
      // Only include password if user typed something
      if (password.trim()) {
        body.password = password.trim();
      }

      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "Failed to save profile");
      }

      const updated = {
        name: body.name || me?.name || "Admin",
        email: body.email || "",
        phone: body.phone || "",
        company: body.company || "",
        role,
      };
      onSaved?.(updated);

      // keep local identity in sync (optional)
      if (typeof window !== "undefined") {
        if (updated.email) {
          localStorage.setItem("adminEmail", updated.email);
          localStorage.setItem("adminName", updated.name || updated.email.split("@")[0] || "Admin");
        } else {
          localStorage.setItem("adminName", updated.name || "Admin");
        }
      }

      Swal.fire({
        icon: "success",
        title: "Saved",
        text: password.trim() ? "Profile and password updated successfully" : "Profile updated successfully",
        confirmButtonColor: "#C1272D",
      });
      onClose();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-lg bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-5 m-0 md:m-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">My Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        {/* Always-edit form with Save/Cancel and single Password field */}
        <form onSubmit={save} className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
          </div>

          <div className="border-t border-gray-200 pt-3">
            <label className="block text-xs font-medium text-gray-700">
              Password <span className="text-gray-400 font-normal">(optional − leave blank to keep unchanged)</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 pr-9 text-sm"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-0 px-2.5 text-gray-500 hover:text-gray-700"
                title={showPwd ? "Hide" : "Show"}
              >
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-[#C1272D] text-white font-medium px-3 py-1.5 text-sm hover:bg-[#a02125] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
