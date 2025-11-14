import React, { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp, FiUserPlus, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";

const PRIMARY_HEX = "#D97706";
const PRIMARY_BTN = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";

const DESIGNATION_ORDER = {
  "HOD Operations": 1,
  "Farm Manager": 2,
  "Jr Accountant F&A": 3,
  "Live Stock Manager": 4,
  "Cattle feed manager": 5,
  "Farm Supervisor": 6,
  "Supervisor": 6,
  "Garden Supervisor": 7,
  "BMC Supervisor": 8,
  "BMC Operator": 9,
  "Sr Vet Assistant": 10,
  "Jr Vet Assistant": 11,
  "Vet Assistant": 11,
  "Vet Doctor": 12,
  "Doctor": 12,
  "Electrecian": 13,
  "Poojari": 14,
  "Milk Supervisor": 15,
  "Milker": 17,
  "Milk Van Driver": 30,
  "Tractor Driver": 31,
  "Water Men": 32,
  "Water men": 32,
  "Farm Worker": 34,
  "Labour": 34,
};

const UNIQUE_DESIGNATIONS = Array.from(new Set(Object.keys(DESIGNATION_ORDER)))
  .sort((a, b) => (DESIGNATION_ORDER[a] || 999) - (DESIGNATION_ORDER[b] || 999));
const ALL_DESIGNATIONS = UNIQUE_DESIGNATIONS;

export default function Employeesoftalakondapallymain() {
  const [employees, setEmployees] = useState([]);
  const [mode, setMode] = useState("loading");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  function sortEmployees(list) {
    return [...list].sort((a, b) => {
      const orderA = DESIGNATION_ORDER[a.designation] || 999;
      const orderB = DESIGNATION_ORDER[b.designation] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.employee_name || "").localeCompare(b.employee_name || "");
    });
  }

  useEffect(() => {
    setError("");
    setMode("loading");
    fetch("/api/talakondapally/employees")
      .then((r) => r.json())
      .then((body) => {
        if (body.data) {
          setEmployees(sortEmployees(body.data));
          setMode("readonly");
        } else {
          setEmployees([]);
          setMode("readonly");
        }
      })
      .catch((err) => {
        setError("Error fetching employees: " + (err.message || err));
        setMode("readonly");
      });
  }, []);

  async function addNewEmployee({ employee_name, designation }) {
    if (!employee_name.trim() || !designation.trim()) return;

    setSubmitting(true);
    Swal.fire({ title: "Adding...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const res = await fetch("/api/talakondapally/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_name, designation }),
      });
      const body = await res.json();
      if (!res.ok || !body.employee_id)
        throw new Error(body.error || "Add failed");
      setEmployees((prev) =>
        sortEmployees([
          ...prev,
          { id: body.employee_id, employee_name, designation },
        ])
      );
      Swal.close();
      Swal.fire({
        icon: "success",
        title: "Added!",
        text: "Employee added to master list.",
        timer: 1800,
        showConfirmButton: false,
      });
      setShowAdd(false);
    } catch (e) {
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Add failed",
        text: e.message || "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEmployee(id, employee_name) {
    if (!id) return;
    const ask = await Swal.fire({
      title: "Delete permanently?",
      html: `Remove <b>${employee_name}</b>? This can't be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete!",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });
    if (!ask.isConfirmed) return;

    Swal.fire({
      title: "Deleting...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await fetch(
        `/api/talakondapally/employees?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      const body = await res.json();
      if (!res.ok || !body.ok)
        throw new Error(body.error || "Delete failed");
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      Swal.close();
      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: `${employee_name} removed.`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: e.message || "Unknown error",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-amber-700">Employees List</h2>
        <button
          onClick={() => setShowAdd(true)}
          aria-label="Add Employee"
          className="rounded-lg px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white shadow-md flex items-center gap-1 text-sm font-semibold"
          disabled={submitting || mode === "loading"}
        >
          <FiUserPlus className="w-4 h-4" /> Add +
        </button>
      </div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="min-w-full mb-10 text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700 w-1/3">Name</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700 w-1/3">Designation</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700 w-1/3">Action</th>
            </tr>
          </thead>
          <tbody>
            {mode === "loading" ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-gray-500">
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{emp.employee_name}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {emp.designation || "—"}
                  </td>
                  <td className="px-4 py-2 flex items-center justify-end space-x-2">
                    <button
                      onClick={() =>
                        handleDeleteEmployee(emp.id, emp.employee_name)
                      }
                      className="flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      disabled={submitting || mode === "loading"}
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: bottom sheet/popup from bottom, overlays all */}
      {showAdd && (
        <AddEmployeeModal
          onClose={() => setShowAdd(false)}
          onAdded={addNewEmployee}
          disabled={submitting || mode === "loading"}
        />
      )}

      <footer className="border-t pt-4 mt-auto text-center text-gray-400 text-xs">
        © 2025 Agasthya Super Foods
      </footer>
    </div>
  );
}

// ------ MODAL FOR ADD EMPLOYEE: slides up from bottom ------
function AddEmployeeModal({ onClose, onAdded, disabled }) {
  const [employee_name, setEmployeeName] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDesignationSelector, setShowDesignationSelector] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (disabled || saving) return;
    if (!employee_name.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Name required",
        text: "Please enter employee name.",
      });
      return;
    }
    if (!designation) {
      Swal.fire({
        icon: "warning",
        title: "Designation required",
        text: "Please select a designation.",
      });
      return;
    }
    setSaving(true);
    try {
      await onAdded({
        employee_name: employee_name.trim(),
        designation: designation.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const sortedDesignations = useMemo(
    () => ALL_DESIGNATIONS.map((d) => ({ value: d, label: d })),
    []
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ pointerEvents: "auto" }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl pb-20 p-5 m-0 shadow-2xl animate-slideUp" style={{
        marginBottom: "0px"
      }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-gray-900">Add Employee</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full name
            </label>
            <input
              type="text"
              value={employee_name}
              onChange={(e) => setEmployeeName(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base ${PRIMARY_OUTLINE}`}
              placeholder="e.g. Ramesh"
              disabled={disabled || saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Designation
            </label>
            <button
              type="button"
              onClick={() => setShowDesignationSelector(true)}
              className={`mt-1 w-full flex justify-between items-center rounded-lg border px-3 py-2 text-base bg-white transition duration-150 ${PRIMARY_OUTLINE}`}
              style={{
                color: designation ? "#1f2937" : "#9ca3af",
                borderColor: designation ? PRIMARY_HEX : "#d1d5db",
              }}
              disabled={disabled || saving}
            >
              <span className="truncate">
                {designation || "— Select Designation —"}
              </span>
              {showDesignationSelector ? (
                <FiChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <FiChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              disabled={disabled || saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving || disabled || !employee_name.trim() || !designation
              }
              className={`rounded-lg ${PRIMARY_BTN} text-white px-4 py-2 text-sm font-medium`}
            >
              {saving ? "Saving..." : "Add Employee"}
            </button>
          </div>
        </form>
        {showDesignationSelector && (
          <CenteredSelectionModal
            title="Select Designation"
            options={sortedDesignations}
            selectedValue={designation}
            onSelect={(value) => {
              setDesignation(value);
              setShowDesignationSelector(false);
            }}
            onClose={() => setShowDesignationSelector(false)}
          />
        )}
      </div>
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0.5;
          }
          to {
            transform: translateY(0%);
            opacity: 1;
          }
        }
        .animate-slideUp {
          animation: slideUp 0.25s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
    </div>
  );
}

// -- keeps overlay/modal for usability --
function CenteredSelectionModal({
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm max-h-[80vh] md:max-w-md md:max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-grow py-2">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={`w-full text-left px-4 py-3 text-base transition duration-150 ${
                option.value === selectedValue
                  ? "bg-amber-50 text-amber-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
