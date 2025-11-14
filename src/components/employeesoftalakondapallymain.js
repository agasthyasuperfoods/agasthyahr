import React, { useEffect, useMemo, useState } from "react";
import { FaTrash } from "react-icons/fa"; // 👈 ICON IMPORTED
import { FiChevronDown, FiChevronUp, FiUserPlus } from "react-icons/fi";
import Swal from 'sweetalert2';

// ---------- THEME & ICONS ----------
const PRIMARY_HEX = "#D97706"; // amber-600
const PRIMARY_BTN = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";
// -----------------------------------


// DESIGNATION ORDER (No changes needed here)
const DESIGNATION_ORDER = {
  "HOD Operations": 1,
  "HOD - Operations": 1,
  "Farm Manager": 2,
  "Jr Accountant F&A": 3,
  "Live Stock Manager": 4,
  "Live stock manager": 4,
  "Cattle Feed Manager": 5,
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
  "Farm worker": 34,
  "Labour": 34,
};

// 1. Extract only UNIQUE designations and sort them by their assigned order number
const UNIQUE_DESIGNATIONS = Array.from(new Set(Object.keys(DESIGNATION_ORDER))).sort((a, b) => {
    return (DESIGNATION_ORDER[a] || 999) - (DESIGNATION_ORDER[b] || 999);
});

// The list used for the dropdown should be based on the unique, sorted list
const ALL_DESIGNATIONS = UNIQUE_DESIGNATIONS;

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return [yyyy, mm, dd].join("-");
}

export default function Employeesoftalakondapallymain() {
  const [mode, setMode] = useState("loading"); // loading | readonly | entry
  const [employees, setEmployees] = useState([]); // readonly rows
  const [entryRows, setEntryRows] = useState([]); // entry rows when no attendance
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const date = useMemo(() => todayIso(), []);

  const sortEmployees = (list) => {
    return list.sort((a, b) => {
      const cleanA = (a.designation || "").trim();
      const cleanB = (b.designation || "").trim();
      // Ensure we use the DESIGNATION_ORDER map for sorting priority
      const orderA = DESIGNATION_ORDER[cleanA] || 999;
      const orderB = DESIGNATION_ORDER[cleanB] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.employee_name.localeCompare(b.employee_name);
    });
  };

  useEffect(() => {
    let canceled = false;

    async function load() {
      setError("");
      setMode("loading");

      try {
        // 1) Check today’s attendance
        const res = await fetch(`/api/talakondapally/attendance?date=${encodeURIComponent(date)}`);
        if (!res.ok) throw new Error("Failed to fetch attendance");
        const payload = await res.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];

        // Apply custom sort
        sortEmployees(rows);

        if (canceled) return;

        if (rows.length > 0) {
          setEmployees(rows);
          setMode("readonly");
          return;
        }

        // 2) No attendance: load master employees
        const resEmp = await fetch(`/api/talakondapally/employees`);
        if (!resEmp.ok) throw new Error("Failed to fetch employees");
        const empPayload = await resEmp.json();
        const base = Array.isArray(empPayload?.data) ? empPayload.data : [];

        // Apply custom sort
        const sortedBase = sortEmployees(base);

        const prepared = sortedBase.map((e) => ({
          employee_id: e.employee_id || e.id,
          employee_name: e.employee_name,
          designation: e.designation,
          status: "Present",
          in_time: "",
          out_time: "",
          remarks: "",
        }));

        if (canceled) return;

        setEntryRows(prepared);
        setMode("entry");
      } catch (err) {
        if (canceled) return;
        setError(err.message || "Load error");
        setMode("loading");
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [date]);

  // Function to handle adding the new employee after successful DB save
  const addNewEmployee = ({ employee_id: newEmployeeId, employee_name: newEmployeeName, designation: newDesignation }) => {

    // Create the new employee object using the permanent ID
    const newEmployee = {
        employee_id: newEmployeeId,
        employee_name: newEmployeeName,
        designation: newDesignation,
        status: mode === "entry" ? "Present" : "N/A",
        in_time: "",
        out_time: "",
        remarks: mode === "readonly" ? "Permanently added to master list." : "",
    };

    if (mode === "entry") {
        // 1. Add to entryRows and resort (for immediate attendance entry)
        setEntryRows(prev => sortEmployees([...prev, newEmployee]));

        Swal.fire({
            icon: 'success',
            title: 'Employee Added & Included',
            text: `${newEmployeeName} has been permanently added and included in today's attendance entry.`,
            timer: 3000,
            showConfirmButton: false,
        });
    } else if (mode === "readonly") {
        // Add to employees list (for immediate visibility in the readonly table)
        setEmployees(prev => sortEmployees([...prev, newEmployee]));

        Swal.fire({
            icon: 'success',
            title: 'Employee Added Permanently',
            html: `${newEmployeeName} has been added to the master list.`,
            timer: 5000,
            showConfirmButton: true,
        });
    }

    // Close the custom modal
    setShowAdd(false);
  };


  async function handleSubmit() {
    Swal.fire({
        title: "Submitting Attendance...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
    });

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/talakondapally/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entries: entryRows.map((r) => ({
            employee_id: r.employee_id,
            status: r.status,
            in_time: r.in_time || null,
            out_time: r.out_time || null,
            remarks: r.remarks || null,
          })),
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Submit failed");
      }

      Swal.close();
      Swal.fire({
        icon: "success",
        title: "Submitted!",
        text: "Attendance successfully recorded.",
      });

      const readonlyRows = entryRows.map((r) => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        designation: r.designation,
        status: r.status,
        in_time: r.in_time,
        out_time: r.out_time,
        remarks: r.remarks,
      }));

      setEmployees(readonlyRows);
      setMode("readonly");
    } catch (e) {
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Submission Error",
        text: e.message || "Could not save attendance data.",
      });
      setError(e.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * HANDLES PERMANENT DELETION VIA API CALL (UPDATED LOGIC)
   */
  async function handleDeleteEmployee(employeeId, employeeName) {
    const result = await Swal.fire({
      title: 'Permanently Delete Employee? ⚠️',
      html: `You are about to **permanently remove** <b>${employeeName}</b> (ID: ${employeeId}) from the **master employee database**. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33', // Red color for danger
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, Delete Permanently!',
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
        return;
    }

    // Show loading spinner while deleting
    Swal.fire({
        title: "Deleting Employee...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
    });

    try {
        // --- API CALL TO DELETE EMPLOYEE (Uses DELETE method) ---
        // NOTE: The endpoint is based on your previous mock: /api/talakondapally/employee/delete
        const res = await fetch(`/api/talakondapally/employee/delete?id=${encodeURIComponent(employeeId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
            // Attempt to parse JSON error or fall back to text
            let errorText = await res.text();
            try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.message || errorText;
            } catch (e) {
                // Keep the text error
            }
            throw new Error(errorText || "Delete failed");
        }

        Swal.close();

        // Update local state only on successful database deletion
        if (mode === "entry") {
            setEntryRows(prev => prev.filter(emp => emp.employee_id !== employeeId));
        } else if (mode === "readonly") {
            setEmployees(prev => prev.filter(emp => emp.employee_id !== employeeId));
        }

        Swal.fire('Deleted! ✅', `${employeeName} has been permanently removed from the master list.`, 'success');

    } catch (e) {
        Swal.close();
        Swal.fire({
            icon: "error",
            title: "Deletion Error ❌",
            text: e.message || "Could not delete the employee from the database.",
        });
    }
  }

  const colSpanCount = 3;

  return (
    <div className="min-h-screen bg-gray-50 p-4">

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-amber-700">
          Employees List
        </h2>

        {/* ADD EMPLOYEE BUTTON (Always Visible unless loading/submitting) */}
        <button
            onClick={() => setShowAdd(true)}
            aria-label="Add Employee"
            title="Add Employee"
            className="rounded-lg px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white shadow-md transition duration-150 flex items-center gap-1 text-sm font-semibold disabled:opacity-50"
            disabled={submitting || mode === 'loading'}
        >
            <FiUserPlus className="w-4 h-4" />
            Add +
        </button>
      </div>
      {/* --- END HEADER --- */}

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
            {mode === "loading" && (
              <tr>
                <td colSpan={colSpanCount} className="px-4 py-6 text-gray-500">Loading...</td>
              </tr>
            )}

            {(mode === "readonly" || mode === "entry") &&
              (mode === "readonly" ? employees : entryRows).length === 0 ? (
                <tr>
                  <td colSpan={colSpanCount} className="px-4 py-4 text-gray-500">No employees found.</td>
                </tr>
              ) : (
                (mode === "readonly" ? employees : entryRows).map((emp) => (
                  <tr key={emp.employee_id || emp.id || `temp-${Math.random()}`} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-900">{emp.employee_name}</td>
                    <td className="px-4 py-2 text-gray-700">{emp.designation || "—"}</td>

                    <td className="px-4 py-2 flex items-center justify-end space-x-2">
                        {/* Hidden attendance inputs (required for submission in entry mode) */}
                        <div className="flex space-x-1 opacity-0 w-0 h-0 overflow-hidden">
                            <select
                                className="border rounded px-2 py-1"
                                value={emp.status}
                                onChange={mode === "entry" ? (e) => {
                                    const v = e.target.value;
                                    setEntryRows((prev) =>
                                        prev.map((r) => (r.employee_id === emp.employee_id ? { ...r, status: v } : r))
                                    );
                                } : () => {}}
                            >
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Leave">Leave</option>
                            </select>
                            <input
                                type="time"
                                className="border rounded px-2 py-1"
                                value={emp.in_time}
                                onChange={mode === "entry" ? (e) => {
                                    const v = e.target.value;
                                    setEntryRows((prev) =>
                                        prev.map((r) => (r.employee_id === emp.employee_id ? { ...r, in_time: v } : r))
                                    );
                                } : () => {}}
                            />
                            <input
                                type="time"
                                className="border rounded px-2 py-1"
                                value={emp.out_time}
                                onChange={mode === "entry" ? (e) => {
                                    const v = e.target.value;
                                    setEntryRows((prev) =>
                                        prev.map((r) => (r.employee_id === emp.employee_id ? { ...r, out_time: v } : r))
                                    );
                                } : () => {}}
                            />
                            <input
                                type="text"
                                placeholder="Remarks"
                                className="border rounded px-2 py-1 w-full"
                                value={emp.remarks}
                                onChange={mode === "entry" ? (e) => {
                                    const v = e.target.value;
                                    setEntryRows((prev) =>
                                        prev.map((r) => (r.employee_id === emp.employee_id ? { ...r, remarks: v } : r))
                                    );
                                } : () => {}}
                            />
                        </div>

                        {/* Visible Delete Icon */}
                        <button
                            title="Delete Employee Permanently"
                            onClick={() => handleDeleteEmployee(emp.employee_id, emp.employee_name)}
                            className="text-red-500 hover:text-red-700 p-1"
                        >
                            <FaTrash className="w-5 h-5" /> {/* THE TRASH ICON */}
                        </button>
                    </td>
                  </tr>
                ))
              )}
          </tbody>
        </table>
      </div>

      {mode === "entry" && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || entryRows.length === 0}
            className="rounded-lg bg-amber-600 text-white px-5 py-2.5 hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Attendance"}
          </button>
        </div>
      )}

      {/* --- RENDER CUSTOM MODAL --- */}
      {showAdd && (
          <AddEmployeeModal
            onClose={() => setShowAdd(false)}
            onAdded={addNewEmployee}
            disabled={submitting || mode === 'loading'}
          />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------------
// --- ADD EMPLOYEE MODAL COMPONENT (MOCK API CALL) ---
// ----------------------------------------------------------------------------------
function AddEmployeeModal({ onClose, onAdded, disabled }) {
  const [employee_name, setEmployeeName] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDesignationSelector, setShowDesignationSelector] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (disabled || saving) return;

    if (!employee_name.trim()) {
        Swal.fire({ icon: "warning", title: "Name required", text: "Please enter employee name." });
        return;
    }
    if (!designation) {
        Swal.fire({ icon: "warning", title: "Designation required", text: "Please select a designation." });
        return;
    }

    setSaving(true);

    Swal.fire({
        title: "Adding Employee to Database...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
    });

    try {
        // --- MOCK API CALL TO ADD EMPLOYEE TO MASTER DB ---
        // This simulates the POST call to your database
        const mockResponse = await new Promise(resolve => setTimeout(() => resolve({
            ok: true,
            // In a real app, the server returns the final employee object including the new ID
            json: () => Promise.resolve({ employee_id: Date.now() % 100000 + 1000, employee_name, designation })
        }), 1000));

        // You would replace 'mockResponse' with a real fetch call like this:
        /*
        const res = await fetch(`/api/talakondapally/employee/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_name, designation }),
        });
        */
        const res = mockResponse; // Using mock response for this example

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || "Failed to add employee to master database.");
        }

        const result = await res.json();

        if (!result.employee_id) {
            throw new Error("Server did not return a permanent employee ID.");
        }

        onAdded({
            employee_id: result.employee_id,
            employee_name: result.employee_name,
            designation: result.designation
        });

        Swal.close();
        onClose(true); // Close the modal on success
        return { success: true };

    } catch (error) {
        Swal.close();
        Swal.fire({
            icon: "error",
            title: "Error Saving",
            text: error.message || "An unknown error occurred while saving the employee.",
        });
        return { success: false };
    } finally {
        setSaving(false);
    }
  };

  // Use the unique, sorted list of designations
  const sortedDesignations = useMemo(() => {
    return ALL_DESIGNATIONS.map(d => ({ value: d, label: d }));
  }, []);

  return (
    // Fixed container for background overlay and positioning
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Background overlay (Click to close) */}
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose(false)} />

      {/* Modal content container (Slides up from bottom) */}
      <div className="relative w-full md:max-w-md bg-white rounded-t-2xl md:rounded-2xl p-5 m-0 md:m-4
                    transform transition-transform duration-300 ease-out translate-y-0"
           style={{ boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-gray-900">Add Employee</h3>
          <button onClick={() => onClose(false)} className="text-gray-500 hover:text-gray-700 text-lg">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* Full Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              type="text"
              value={employee_name}
              onChange={(e) => setEmployeeName(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base ${PRIMARY_OUTLINE}`}
              placeholder="e.g. Ramesh"
              disabled={disabled || saving}
            />
          </div>

          {/* Custom Designation Input/Button */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Designation</label>
            <button
                type="button"
                onClick={() => setShowDesignationSelector(true)}
                className={`mt-1 w-full flex justify-between items-center rounded-lg border px-3 py-2 text-base bg-white transition duration-150 ${PRIMARY_OUTLINE} disabled:bg-gray-50 disabled:cursor-not-allowed`}
                style={{
                    color: designation ? '#1f2937' : '#9ca3af',
                    borderColor: designation ? PRIMARY_HEX : '#d1d5db'
                }}
                disabled={disabled || saving}
            >
                <span className="truncate">{designation || '— Select Designation —'}</span>
                {showDesignationSelector ? <FiChevronUp className="w-5 h-5 text-gray-500" /> : <FiChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              disabled={disabled || saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || disabled || !employee_name.trim() || !designation}
              className={`rounded-lg ${PRIMARY_BTN} text-white px-4 py-2 text-sm font-medium`}
            >
              {saving ? "Saving..." : "Add Employee"}
            </button>
          </div>
        </form>
      </div>

      {/* --- CENTERED DESIGNATION SELECTION MODAL --- */}
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
  );
}

// ----------------------------------------------------------------------------------
// --- CENTRED SELECTION MODAL COMPONENT ---
// ----------------------------------------------------------------------------------
function CenteredSelectionModal({ title, options, selectedValue, onSelect, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Background overlay */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Centered Modal Box */}
            <div className="relative w-full max-w-sm max-h-[80vh] md:max-w-md md:max-h-[90vh] bg-white rounded-xl shadow-2xl transform scale-100 transition-all duration-300
                          flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
                </div>

                {/* Options List */}
                <div className="overflow-y-auto flex-grow py-2">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => onSelect(option.value)}
                            className={`w-full text-left px-4 py-3 text-base transition duration-150
                                ${option.value === selectedValue
                                    ? 'bg-amber-50 text-amber-700 font-semibold'
                                    : 'text-gray-700 hover:bg-gray-50'
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