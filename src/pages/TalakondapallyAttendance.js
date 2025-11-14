// FILE: src/pages/TalakondapallyAttendanceReadOnly.js
import Head from "next/head";
import Image from "next/image";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
// 🚨 FIX: Add FiTrash2 to imports
import { FiCalendar, FiRefreshCw, FiSave, FiUserPlus, FiChevronDown, FiChevronUp, FiTrash2 } from "react-icons/fi";
import MobileFooterMenu from "@/components/MobileFooterMenu";


// ---------- THEME ----------
const PRIMARY_HEX = "#D97706"; // amber-600
const PRIMARY_BTN = "bg-amber-600 hover:bg-amber-700";
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";
// ---------------------------

// ---------- DESIGNATION SORT ORDER ----------
const DESIGNATION_ORDER = {
   "HOD - Operations": 1, "Farm Manager": 2, "Jr Accountant F&A": 3,
 "Live stock manager": 4, "Cattle Feed Manager": 5,
  "Farm Supervisor": 6, "Supervisor": 6, "Garden Supervisor": 7, "BMC Supervisor": 8,
  "BMC Operator": 9, "Sr Vet Assistant": 10, "Jr Vet Assistant": 11,
  "Vet Doctor": 12,  "Electrecian": 13, "Poojari": 14, "Milk Supervisor": 15,
  "Milker": 17, "Milk Van Driver": 30, "Tractor Driver": 31, "Water Men": 32,
  "Farm Worker": 34, "Labour": 34,
};

// 1. Extract only UNIQUE designations and sort them by their assigned order number
const UNIQUE_DESIGNATIONS = Array.from(new Set(Object.keys(DESIGNATION_ORDER))).sort((a, b) => {
    return (DESIGNATION_ORDER[a] || 999) - (DESIGNATION_ORDER[b] || 999);
});

// The list used for the dropdown should be based on the unique, sorted list
const ALL_DESIGNATIONS = UNIQUE_DESIGNATIONS;
// ------------------------------------------

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return [yyyy, mm, dd].join("-");
}

const STATUS = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF: "Half Day",
};

// ----------------------------------------------------------------------------------
// --- CENTRED SELECTION MODAL COMPONENT (Helper) ---
// ----------------------------------------------------------------------------------
function CenteredSelectionModal({ title, options, selectedValue, onSelect, onClose }) {
    return (
        // z-[60] ensures it sits above the AddEmployeeModal's z-50
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"> 
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-sm max-h-[80vh] md:max-w-md md:max-h-[90vh] bg-white rounded-xl shadow-2xl transform scale-100 transition-all duration-300 flex flex-col"> 
                
                <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
                </div>

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

// ----------------------------------------------------------------------------------
// --- ADD EMPLOYEE MODAL COMPONENT (Helper) ---
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
    
    // Call the async onAdded function (which handles the API call)
    const result = await onAdded({ employee_name: employee_name.trim(), designation });

    setSaving(false);
    
    // Close the modal only if the API call was successful
    if (result?.success) {
        onClose(true); // Pass true to indicate successful addition
    }
  };
  
  const sortedDesignations = useMemo(() => {
    return ALL_DESIGNATIONS.map(d => ({ value: d, label: d }));
  }, []);

  return (
    // z-50 for the main modal backdrop
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose(false)} />
      
      <div className="relative w-full md:max-w-md bg-white rounded-t-2xl md:rounded-2xl p-5 m-0 md:m-4 transform transition-transform duration-300 ease-out translate-y-0" 
           style={{ boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }} 
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-gray-900">Add Employee</h3>
          <button onClick={() => onClose(false)} className="text-gray-500 hover:text-gray-700 text-lg">✕</button>
        </div>
        
        <form onSubmit={submit} className="space-y-4">
          
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
              {saving ? "Adding..." : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
      
      {/* Centered Designation Selection Modal (z-60) */}
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
// --- MAIN COMPONENT ---
// ----------------------------------------------------------------------------------
export default function TalakondapallyAttendanceReadOnly() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  
  const [attendanceData, setAttendanceData] = useState({});
  const [allEmployees, setAllEmployees] = useState([]);
  
  const [recordedEmployees, setRecordedEmployees] = useState([]);
  const [recordedAttMap, setRecordedAttMap] = useState({});
  
  const [isLocked, setIsLocked] = useState(false); 
  
  const [showAdd, setShowAdd] = useState(false); 

  // AUTH GUARD (EMP179 only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const authed = localStorage.getItem("auth") === "1";
    const id = localStorage.getItem("employeeid");
    if (!authed || id !== "EMP179") {
      router.replace("/Talakondapallylogin");
      return;
    }
    setReady(true);
  }, [router]);

  const sortEmployees = useCallback((list) => {
    return list.sort((a, b) => {
      // Function to normalize the designation string for resilient lookup
      const normalizeDesignation = (designation) => {
        if (!designation) return "";
        // Trim whitespace, replace common delimiters (space, hyphen) with a single space, and normalize case.
        return designation.trim().replace(/[-\s]+/g, ' ').trim();
      };

      const normalizedA = normalizeDesignation(a.designation);
      const normalizedB = normalizeDesignation(b.designation);

      // We need to check all DESIGNATION_ORDER keys against the normalized designation.
      const findOrder = (normalizedDesignation) => {
        for (const key in DESIGNATION_ORDER) {
          if (normalizeDesignation(key) === normalizedDesignation) {
            return DESIGNATION_ORDER[key];
          }
        }
        return 999; // Default order for unknown designations
      };
      
      const orderA = findOrder(normalizedA);
      const orderB = findOrder(normalizedB);
      
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by name
      return a.employee_name.localeCompare(b.employee_name);
    });
  }, []); // Depend on nothing as DESIGNATION_ORDER is static

  const updateAttendanceStatus = (employeeId, status) => {
    setAttendanceData(prev => ({ ...prev, [employeeId]: status }));
  };
  
  // Primary data fetch function
  const loadForDate = useCallback(async (newDate = date) => {
    try {
      setLoading(true);
      
      // Fetch attendance data (which includes the employee list for the day)
      const res = await fetch(`/api/talakondapally/attendance?date=${encodeURIComponent(newDate)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load attendance");

      const fetchedEmployees = Array.isArray(j?.data) ? j.data : [];
      
      const recorded = [];
      const nextRecordedAttMap = {};
      const nextAttendanceData = {};
      
      let foundAnySubmission = false;

      // 1. Map fetched data and apply the required sorting immediately
      const sortedAllEmployees = sortEmployees(fetchedEmployees.map(r => ({
          id: r.employee_id,
          employee_name: r.employee_name,
          designation: r.designation || "",
          status: r.status || "",
      })));

      for (const r of sortedAllEmployees) { // Iterate over the sorted list
        if (r.status && r.status.length > 0) {
            foundAnySubmission = true;
        }

        if (r.status && r.status.length > 0) {
            recorded.push(r);
            nextRecordedAttMap[r.id] = r.status;
        }
        
        nextAttendanceData[r.id] = r.status || STATUS.PRESENT;
      }
      
      setIsLocked(foundAnySubmission);

      if (foundAnySubmission) {
          // Locked: Ensure the final list of recorded employees is also sorted by designation
          setRecordedEmployees(sortEmployees(recorded)); 
          setRecordedAttMap(nextRecordedAttMap);
          setAllEmployees([]);
          setAttendanceData({});
      } else {
          // Unlocked: Use the pre-sorted list
          setAllEmployees(sortedAllEmployees);
          setAttendanceData(nextAttendanceData);
          setRecordedEmployees([]);
          setRecordedAttMap({});
      }

    } catch (e) {
      Swal.fire({ icon: "error", title: "Load failed", text: e.message || "Something went wrong" });
      setRecordedEmployees([]);
      setRecordedAttMap({});
      setAllEmployees([]);
      setAttendanceData({});
      setIsLocked(false);
    } finally {
      setLoading(false);
    }
  }, [date, sortEmployees]);
  
  useEffect(() => {
    if (!ready) return;
    loadForDate(date);
  }, [ready, date, loadForDate]);

  // --- ASYNC EMPLOYEE ADDITION LOGIC (API Call for Permanent Insertion) ---
  const addNewEmployee = useCallback(async ({ employee_name: newEmployeeName, designation: newDesignation }) => {
    
    const employeeData = {
        employee_name: newEmployeeName,
        designation: newDesignation,
    };

    Swal.fire({
      title: `Adding ${newEmployeeName}...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
        // --- API CALL TO PERMANENTLY ADD EMPLOYEE TO MASTER DB ---
        const res = await fetch("/api/talakondapally/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employeeData),
        });

        const j = await res.json();
        Swal.close();
        
        if (!res.ok || !j?.employee_id) {
            // The API response must return the new ID as 'employee_id'
            throw new Error(j?.error || "Failed to add employee to master database. Missing new employee_id.");
        }
        
        const realEmployeeId = j.employee_id;

        // 1. Show success message (but DO NOT call loadForDate here)
        Swal.fire({
            icon: 'success',
            title: 'Employee Added Permanently',
            text: `${newEmployeeName} (ID: ${realEmployeeId}) has been added to the master database.`,
            timer: 3000,
            showConfirmButton: false,
        });
        
        // Return success indicator
        return { success: true };

    } catch (e) {
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Action Failed',
            text: e.message || 'Could not add employee to the master database.',
        });
        return { success: false };
    }
  }, []); // Dependencies removed as refresh is handled externally

  // --- ASYNC EMPLOYEE DELETION LOGIC (API Call for Permanent Deletion) ---
  const deleteEmployee = useCallback(async (employeeId, employeeName) => {
    
    // 1. Confirmation Dialog
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: `You are about to permanently delete ${employeeName}. This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#F43F5E', // Rose 500
        cancelButtonColor: '#6B7280', // Gray 500
        confirmButtonText: 'Yes, delete it!',
    });

    if (!result.isConfirmed) {
        return;
    }

    Swal.fire({
      title: `Deleting ${employeeName}...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
        // --- API CALL TO PERMANENTLY DELETE EMPLOYEE FROM MASTER DB ---
        // Pass employeeId as a query parameter
        const res = await fetch(`/api/talakondapally/employees?id=${encodeURIComponent(employeeId)}`, {
            method: "DELETE",
        });

        const j = await res.json();
        Swal.close();
        
        if (!res.ok) {
            throw new Error(j?.error || "Failed to delete employee from master database.");
        }
        
        // 2. Show success message and trigger hard refresh
        await Swal.fire({
            icon: 'success',
            title: 'Employee Deleted',
            text: `${employeeName} has been permanently removed.`,
            timer: 3000,
            showConfirmButton: false,
        });
        
        // Trigger a hard refresh to update the list immediately
        loadForDate(date); 

    } catch (e) {
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Action Failed',
            text: e.message || 'Could not delete employee from the master database.',
        });
    }
  }, [loadForDate, date]);


  // *** Central function to handle modal closure and refresh ***
  const handleModalClose = useCallback((shouldRefresh) => {
      setShowAdd(false);
      if (shouldRefresh) {
          // This call guarantees the refresh happens after the modal is hidden
          loadForDate(date); 
      }
  }, [loadForDate, date]);
  // -------------------------


  const counts = useMemo(() => {
    const data = isLocked ? recordedAttMap : attendanceData;
    let present = 0, absent = 0, half = 0;
    
    for (const id in data) {
        const st = data[id];
        if (st === STATUS.PRESENT) present++;
        else if (st === STATUS.ABSENT) absent++;
        else if (st === STATUS.HALF) half++;
    }
    
    return { 
        total: isLocked ? recordedEmployees.length : allEmployees.length, 
        present, 
        absent, 
        half,
    };
  }, [isLocked, recordedEmployees.length, recordedAttMap, allEmployees.length, attendanceData]);


  const handleSubmit = async () => {
    // Only proceed if not locked and all current employees have a status
    if (isLocked) return;
    if (Object.keys(attendanceData).length !== allEmployees.length) {
         Swal.fire({ icon: "warning", title: "Incomplete", text: "Please ensure all employees have an attendance status selected." });
         return;
    }
    
    const payload = {
        date: date,
        rows: Object.entries(attendanceData).map(([employee_id, status]) => ({
            // Ensure employee_id is handled correctly (it might be a string from API)
            employee_id: employee_id, 
            status,
        })),
        submitter_id: localStorage.getItem("employeeid") 
    };

    Swal.fire({
      title: "Submitting Attendance...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await fetch("/api/talakondapally/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      Swal.close();

      if (!res.ok) {
        throw new Error(j.error || "Submission failed.");
      }

      Swal.fire({
        icon: "success",
        title: "Submitted!",
        text: "Attendance successfully recorded.",
      });

      loadForDate(date); 

    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Submission Error",
        text: error.message || "Could not save attendance data.",
      });
    }
  };


  const getDesignationBadgeStyle = (designation) => {
    const lower = designation.toLowerCase();
    if (lower.includes('labour')) return "bg-yellow-100 text-yellow-800";
    if (lower.includes('supervisor') || lower.includes('manager') || lower.includes('hod')) return "bg-blue-100 text-blue-800";
    if (lower.includes('vet') || lower.includes('doctor')) return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  }

  const getStatusDropdownStyle = (status) => {
    switch (status) {
        case STATUS.PRESENT:
            return "border-emerald-500 text-emerald-700 focus:border-emerald-600 focus:ring-emerald-500/50";
        case STATUS.ABSENT:
            return "border-rose-500 text-rose-700 focus:border-rose-600 focus:ring-rose-500/50";
        case STATUS.HALF:
            return "border-amber-500 text-amber-700 focus:border-amber-600 focus:ring-amber-500/50";
        default:
            return "border-gray-300 text-gray-700 focus:border-amber-500 focus:ring-amber-400/50";
    }
  }


  if (!ready) {
    return (
      <>
        <Head><title>Talakondapally Attendance</title></Head>
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
        <title>Talakondapally Attendance ({isLocked ? 'View' : 'Submit'})</title>
        <meta name="robots" content="noindex" />
      </Head>
      
      <main className={`min-h-screen bg-gray-50 ${isLocked ? 'pb-14' : 'pb-32'}`}>
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 relative flex-shrink-0">
                  <Image src="/logo.png" alt="Agasthya Superfoods" width={48} height={48} className="rounded-full object-contain" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              
              {/* CALENDAR/DATE INPUT */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5">
                <FiCalendar className="text-gray-500" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={todayIso()}
                  className={`text-sm outline-none bg-transparent ${PRIMARY_OUTLINE}`}
                  disabled={loading} 
                />
              </div>

              {/* REFRESH BUTTON */}
              <button
                onClick={() => loadForDate(date)}
                aria-label="Refresh"
                title="Refresh"
                className="rounded-lg p-2 border border-gray-200 bg-white hover:bg-gray-50"
                disabled={loading} 
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              </button>
              
              {/* ADD EMPLOYEE BUTTON (Always Visible) */}
              <button
                  onClick={() => setShowAdd(true)} 
                  aria-label="Add Employee"
                  title="Add Employee"
                  className="rounded-lg px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white shadow-md transition duration-150 flex items-center gap-1 text-sm font-semibold disabled:opacity-50"
                  disabled={loading} 
              >
                  <FiUserPlus className="w-4 h-4" />
                  Add +
              </button>
              
            </div>
          </div>

          <div className="px-4 pb-3 text-xs text-gray-700 flex items-center gap-3 overflow-x-auto">
            <span>{isLocked ? 'Recorded' : 'Total'} Employees: <b>{counts.total}</b></span>
            <span className="text-emerald-700">Present: <b>{counts.present}</b></span>
            <span className="text-rose-700">Absent: <b>{counts.absent}</b></span>
            <span className="text-amber-700">Half Day: <b>{counts.half}</b></span>
          </div>
        </header>
        
        {/* Conditional View Rendering */}
        {isLocked ? (
            /* --- READ-ONLY VIEW (Table) --- */
            <section className="p-4">
                <div className="mx-0 mt-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm p-3">
                    Attendance for **{date}** has been **submitted**. Viewing in Read-Only Mode.
                </div>
                <h3 className="text-base font-semibold mb-2 mt-4 text-gray-700">Recorded Attendance</h3>
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="px-4 py-4 text-gray-500">Loading attendance data...</div>
                    ) : (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
                                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Status</th>
                                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Designation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recordedEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-4 text-gray-500">
                                            No employee attendance data recorded for this date.
                                        </td>
                                    </tr>
                                ) : (
                                    recordedEmployees.map((e) => (
                                        <tr key={e.id} className="border-t border-gray-100">
                                            <td className="px-4 py-2 text-gray-900">{e.employee_name}</td>
                                            <td className="px-4 py-2">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                                        ${recordedAttMap[e.id] === STATUS.PRESENT ? "bg-emerald-100 text-emerald-700" :
                                                          recordedAttMap[e.id] === STATUS.ABSENT  ? "bg-rose-100 text-rose-700"    :
                                                          recordedAttMap[e.id] === STATUS.HALF    ? "bg-amber-100 text-amber-700"   :
                                                                                                    "bg-gray-100 text-gray-700" }`}
                                                >
                                                    {recordedAttMap[e.id]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-700">{e.designation || "—"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table >
                    )}
                </div>
            </section>
        ) : (
            /* --- SUBMISSION VIEW (Card List) --- */
            <section className="p-4">
                <h3 className="text-base font-semibold mb-3 text-gray-700">Mark Attendance for Submission</h3>
                
                {loading ? (
                    <div className="px-4 py-4 text-gray-500">Loading employees...</div>
                ) : (
                    <div className="space-y-4">
                        {allEmployees.length === 0 ? (
                            <div className="p-4 bg-white rounded-xl border border-gray-200 text-gray-500">
                                No employees found for this date.
                            </div>
                        ) : (
                            allEmployees.map((e) => {
                                const currentStatus = attendanceData[e.id] || STATUS.PRESENT;

                                return (
                                    <div key={e.id} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="min-w-0">
                                                <p className="text-lg font-semibold text-gray-900 truncate">
                                                  {e.employee_name}
                                                </p>
                                                <span 
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${getDesignationBadgeStyle(e.designation)}`}
                                                >
                                                    {e.designation || 'Worker'}
                                                </span>
                                            </div>
                                            {/* 🚨 FIX: Correct Delete Button Implementation */}
                                            <button 
                                                onClick={() => deleteEmployee(e.id, e.employee_name)}
                                                className="flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition duration-150"
                                                title={`Permanently delete ${e.employee_name}`}
                                                disabled={loading}
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                            {/* END FIX */}
                                        </div>

                                        <label htmlFor={`status-${e.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            id={`status-${e.id}`}
                                            value={currentStatus}
                                            onChange={(ev) => updateAttendanceStatus(e.id, ev.target.value)}
                                            className={`w-full border rounded-lg py-2 px-3 text-base bg-white appearance-none transition duration-150 ${getStatusDropdownStyle(currentStatus)}`}
                                        >
                                            {Object.values(STATUS).map((st) => (
                                                <option key={st} value={st}>{st}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </section>
        )}
        
        {/* --- FIXED SUBMIT FOOTER (Visible only when NOT locked) --- */}
        {!isLocked && allEmployees.length > 0 && (
             <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-gray-200 mb-9 z-30 p-3 shadow-2xl">
                <button
                    onClick={handleSubmit}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-white font-semibold bg-amber-500 hover:bg-amber-600 transition duration-150 ${PRIMARY_OUTLINE}`}
                    disabled={loading}
                >
                    <FiSave className="w-5 h-5" />
                    Submit Attendance for {date}
                </button>
            </div>
        )}

        <MobileFooterMenu />
      </main>

      {/* --- RENDER CUSTOM MODAL --- */}
      {showAdd && (
          <AddEmployeeModal 
            onClose={handleModalClose} // Now calls the new handler
            onAdded={addNewEmployee} 
            disabled={loading}
          />
      )}
    </>
  );
}