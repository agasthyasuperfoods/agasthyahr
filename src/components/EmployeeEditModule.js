
import { useState, useMemo } from 'react';
import { Loader2, Save, X as XIcon } from 'lucide-react';
import Swal from 'sweetalert2';

const USERS_API = "/api/updateapipage";

function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <input
        {...props}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <select
        {...props}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        {children}
      </select>
    </div>
  );
}

export default function EmployeeEditModule({ user, onCancel, onSaved, roles = [], companies = [] }) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    role: user.role || '',
    company: user.company || '',
    number: user.number || '',
    designation: user.designation || '',
    reporting_to_id: user.reporting_to_id || '',
    doj: user.doj ? new Date(user.doj).toISOString().split('T')[0] : '',
    grosssalary: user.grosssalary || user.grossSalary || '',
    pancard: user.pancard || '',
    leaves_cf: user.Leaves_cf ?? user.leaves_cf ?? '',
    address: user.address || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        id: user.employeeid, // Pass the original employee ID for update
      };
      
      const res = await fetch(`${USERS_API}?id=${user.employeeid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update employee.');
      }

      Swal.fire({
        icon: 'success',
        title: 'Employee Updated',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });

      // Pass the updated data back to the parent
      if (onSaved) {
        onSaved({ ...user, ...payload });
      }

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message,
      });
    } finally {
      setSaving(false);
    }
  };
  
  const uniqueRoles = useMemo(() => [...new Set([formData.role, ...roles].filter(Boolean))], [formData.role, roles]);
  const uniqueCompanies = useMemo(() => [...new Set([formData.company, ...companies].filter(Boolean))], [formData.company, companies]);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">
          Editing: <span className="font-normal">{user.name} ({user.employeeid})</span>
        </h3>
      </div>
      <form onSubmit={handleSave}>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
          <Input label="Name" name="name" value={formData.name} onChange={handleChange} required />
          <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required />
          <Select label="Role" name="role" value={formData.role} onChange={handleChange} required>
            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select label="Company" name="company" value={formData.company} onChange={handleChange} required>
            {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Phone" name="number" value={formData.number} onChange={handleChange} />
          <Input label="Designation" name="designation" value={formData.designation} onChange={handleChange} />
          <Input label="Reporting To (ID)" name="reporting_to_id" value={formData.reporting_to_id} onChange={handleChange} />
          <Input label="Date of Joining" name="doj" type="date" value={formData.doj} onChange={handleChange} />
          <Input label="Gross Salary" name="grosssalary" type="number" value={formData.grosssalary} onChange={handleChange} />
          <Input label="PAN" name="pancard" value={formData.pancard} onChange={handleChange} />
          <Input label="Carryforward Leaves" name="leaves_cf" type="number" value={formData.leaves_cf} onChange={handleChange} />
          <div className="md:col-span-2 xl:col-span-3">
            <Input label="Address" name="address" value={formData.address} onChange={handleChange} />
          </div>
        </div>
        <div className="px-6 pb-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <XIcon className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#b03838] px-4 py-2 text-sm font-medium text-white hover:bg-[#8e2d2d] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
