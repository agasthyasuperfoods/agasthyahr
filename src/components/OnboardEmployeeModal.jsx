import { useEffect, useState } from "react";

export default function OnboardEmployeeModal({ open, onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // form state (match your columns exactly)
  const [form, setForm] = useState({
    employeeid: "",
    name: "",
    email: "",
    number: "",
    doj: "",
    designation: "",
    company: "",
    address: "",
    pancard: "",
    adhaarnumber: "",
    grosssalary: "",
    reporting_to_id: "", // <-- new field you added in DB
    password: "",
    role: "EMPLOYEE",
  });

  useEffect(() => {
    if (!open) {
      setForm({
        employeeid: "",
        name: "",
        email: "",
        number: "",
        doj: "",
        designation: "",
        company: "",
        address: "",
        pancard: "",
        adhaarnumber: "",
        grosssalary: "",
        reporting_to_id: "",
        password: "",
        role: "EMPLOYEE",
      });
      setErr("");
      setSaving(false);
    }
  }, [open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employeeid.trim() || !form.name.trim()) {
      setErr("Employee ID and Name are required.");
      return;
    }
    try {
      setSaving(true);
      setErr("");

      // build payload (convert blanks to nulls for cleaner inserts)
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, String(v || "").trim() || null])
      );

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to create employee");

      onCreated?.(j.data);
      onClose?.();
    } catch (e) {
      setErr(e.message || "Failed to create employee");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} aria-hidden="true" />
      <div className="relative w-full md:max-w-2xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-5 m-0 md:m-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">Onboard Employee</h3>
          <button onClick={() => onClose?.()} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {err ? <div className="md:col-span-2 text-sm text-red-600">{err}</div> : null}

          <div>
            <label className="block text-xs text-gray-700">Employee ID *</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.employeeid} onChange={(e)=>update("employeeid", e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Name *</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.name} onChange={(e)=>update("name", e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Email</label>
            <input type="email" className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.email} onChange={(e)=>update("email", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Phone</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.number} onChange={(e)=>update("number", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Date of Joining</label>
            <input type="date" className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.doj || ""} onChange={(e)=>update("doj", e.target.value)} />
          </div>

          {/* NEW: Designation */}
          <div>
            <label className="block text-xs text-gray-700">Designation</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.designation} onChange={(e)=>update("designation", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Company</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.company} onChange={(e)=>update("company", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-gray-700">Address</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.address} onChange={(e)=>update("address", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-700">PAN</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.pancard} onChange={(e)=>update("pancard", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Aadhaar</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.adhaarnumber} onChange={(e)=>update("adhaarnumber", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-700">Monthly CTC (grosssalary)</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.grosssalary} onChange={(e)=>update("grosssalary", e.target.value)} />
          </div>

          {/* NEW: Reporting To (Employee ID) */}
          <div>
            <label className="block text-xs text-gray-700">Reporting To (Employee ID)</label>
            <input className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   placeholder="e.g. EMP1002"
                   value={form.reporting_to_id} onChange={(e)=>update("reporting_to_id", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-gray-700">Set Password</label>
            <input type="password" className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                   value={form.password} onChange={(e)=>update("password", e.target.value)} />
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => onClose?.()} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-[#C1272D] text-white px-3 py-1.5 text-sm hover:bg-[#a02125] disabled:opacity-60">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
