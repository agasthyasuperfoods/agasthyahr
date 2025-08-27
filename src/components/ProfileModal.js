import { useState } from "react";
import Swal from "sweetalert2";

const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];

export default function ProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role || "HR");
  const [doj, setDoj] = useState(user?.doj || "");
  const [phone, setPhone] = useState(user?.number || user?.phone || "");
  const [company, setCompany] = useState(user?.company || "");
  const [aadhaar, setAadhaar] = useState(user?.adhaarnumber || "");
  const [pan, setPan] = useState(user?.pancard || "");
  const [address, setAddress] = useState(user?.address || "");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!name.trim()) return "Full name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Valid email is required.";
    if (!role) return "Role is required.";
    if (!company.trim()) return "Company is required.";
    const aadhaarDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaarDigits && aadhaarDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
    const panNorm = String(pan || "").toUpperCase();
    if (panNorm && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid (e.g., ABCDE1234F).";
    // Address is optional now — no validation
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      Swal.fire({ icon: "error", title: "Validation error", text: err });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        employeeid: user.employeeid, // ok to include even with ?id=
        name,
        email,
        role,
        doj,
        phone,
        company,
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address: String(address).trim() || null, // <-- optional, normalized
      };

      const res = await fetch(`/api/users?id=${encodeURIComponent(user.employeeid)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update profile");
      onSaved?.(json?.data || payload);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Update failed", text: e.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-3xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input type="text" value={user?.employeeid ?? ""} readOnly disabled className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input type="date" value={doj || ""} onChange={(e) => setDoj(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={phone || ""} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="+91 98765 43210" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ASF-Factory" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (12 digits)</label>
              <input type="text" value={aadhaar || ""} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="000000000000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input type="text" value={pan || ""} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ABCDE1234F" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea rows={2} value={address || ""} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Flat / Street / City / State / PIN" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
