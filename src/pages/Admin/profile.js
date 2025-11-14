// src/pages/Admin/profile.jsx
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import AdminHeader from "@/components/AdminHeader";

function toDateInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminProfile() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("Admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    employeeid: "",
    name: "",
    email: "",
    number: "",
    doj: "",
    designation: "",
    address: "",
    pancard: "",
    aadhaar: "",
    company: "",
    password: "",
  });

  // auth + load profile + header name
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = localStorage.getItem("auth") === "1";
    if (!ok) { router.replace("/Alogin"); return; }

    const storedName = localStorage.getItem("adminName");
    if (storedName) setAdminName(storedName);

    const empId = localStorage.getItem("adminEmployeeId");
    if (!empId) { router.replace("/Admin"); return; }

    (async () => {
      try {
        setErr("");
        const res = await fetch(`/api/admin/profile?identifier=${encodeURIComponent(empId)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.data) throw new Error(j?.error || "Failed to load profile");
        const row = j.data;

        // keep header name fresh if DB has a nicer name
        if (row?.name) {
          setAdminName(row.name);
          localStorage.setItem("adminName", row.name);
        }

        setForm({
          employeeid: row.employeeid || empId,
          name: row.name || "",
          email: row.email || "",
          number: row.number?.toString?.() || "",
          doj: toDateInput(row.doj),
          designation: row.designation || "",
          address: row.address || "",
          pancard: row.pancard || "",
          aadhaar: row.aadhaar || "",
          company: row.company || "",
          password: "",
        });
      } catch (e) {
        setErr(e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErr("");

      if (form.password && form.password.length < 4) {
        throw new Error("Password must be at least 4 characters (or leave it blank).");
      }

      const body = { ...form };
      if (!body.password) delete body.password;

      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Save failed");

      if (typeof window !== "undefined" && body.name) {
        localStorage.setItem("adminName", body.name);
        setAdminName(body.name);
      }
      alert("Profile saved.");
      router.push("/Admin");
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head><title>Admin Profile • Agasthya Super Foods</title></Head>

      {/* Pass currentPath + adminName so header highlights the active tab and shows brand color */}
      <AdminHeader currentPath={router.pathname} adminName={adminName} />

      <main className="min-h-screen bg-gray-50 px-3 py-4">
        <div className="mx-auto">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <h1 className="text-base font-semibold text-gray-900">My Profile</h1>
            <p className="text-xs text-gray-600 mt-0.5">Update your admin details.</p>

            {loading ? (
              <div className="mt-4 text-gray-600 text-sm">Loading…</div>
            ) : (
              <form onSubmit={save} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {err ? <div className="md:col-span-2 text-sm text-red-600">{err}</div> : null}

                <div>
                  <label className="block text-xs text-gray-700">Employee ID</label>
                  <input
                    value={form.employeeid}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-gray-50"
                    disabled
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Name</label>
                  <input
                    value={form.name}
                    onChange={(e)=>update("name", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e)=>update("email", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Phone</label>
                  <input
                    value={form.number}
                    onChange={(e)=>update("number", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Date of Joining</label>
                  <input
                    type="date"
                    value={form.doj}
                    onChange={(e)=>update("doj", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e)=>update("designation", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-700">Address</label>
                  <input
                    value={form.address}
                    onChange={(e)=>update("address", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">PAN</label>
                  <input
                    value={form.pancard}
                    onChange={(e)=>update("pancard", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Aadhaar</label>
                  <input
                    value={form.aadhaar}
                    onChange={(e)=>update("aadhaar", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700">Company</label>
                  <input
                    value={form.company}
                    onChange={(e)=>update("company", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-700">
                    New Password <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e)=>update("password", e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    placeholder="Leave blank to keep unchanged"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => router.push("/Admin")}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-[#C1272D] text-white px-3 py-1.5 text-sm hover:bg-[#a02125] disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
