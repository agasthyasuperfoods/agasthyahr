// FILE: src/pages/TalakondapallyAttendanceReadOnly.js
import Head from "next/head";
import Image from "next/image";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import { FiCalendar, FiRefreshCw, FiSave } from "react-icons/fi"; 
import MobileFooterMenu from "@/components/MobileFooterMenu";


// ---------- THEME ----------
const PRIMARY_HEX = "#D97706"; // amber-600
const PRIMARY_OUTLINE = "focus:outline-none focus:ring-2 focus:ring-amber-400/50";
// ---------------------------

// ---------- DESIGNATION SORT ORDER ----------
const DESIGNATION_ORDER = {
  "HOD Operations": 1, "HOD - Operations": 1, "Farm Manager": 2, "Jr Accountant F&A": 3,
  "Live Stock Manager": 4, "Live stock manager": 4, "Cattle Feed Manager": 5, "Cattle feed manager": 5,
  "Farm Supervisor": 6, "Supervisor": 6, "Garden Supervisor": 7, "BMC Supervisor": 8,
  "BMC Operator": 9, "Sr Vet Assistant": 10, "Jr Vet Assistant": 11, "Vet Assistant": 11,
  "Vet Doctor": 12, "Doctor": 12, "Electrecian": 13, "Poojari": 14, "Milk Supervisor": 15,
  "Milker": 17, "Milk Van Driver": 30, "Tractor Driver": 31, "Water Men": 32, "Water men": 32,
  "Farm Worker": 34, "Farm worker": 34, "Labour": 34,
};

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

// --- START COMPONENT ---
export default function TalakondapallyAttendanceReadOnly() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  
  // State for editable attendance data (used when !isLocked)
  const [attendanceData, setAttendanceData] = useState({});
  // State for ALL employees (used when !isLocked to show full list)
  const [allEmployees, setAllEmployees] = useState([]);
  
  // State for recorded employees (used when isLocked)
  const [recordedEmployees, setRecordedEmployees] = useState([]);
  const [recordedAttMap, setRecordedAttMap] = useState({});
  
  // State for global lock based on submission (true if any attendance exists)
  const [isLocked, setIsLocked] = useState(false); 

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

  const sortEmployees = (list) => {
    return list.sort((a, b) => {
      const cleanA = (a.designation || "").trim();
      const cleanB = (b.designation || "").trim();
      const orderA = DESIGNATION_ORDER[cleanA] || 999;
      const orderB = DESIGNATION_ORDER[cleanB] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.employee_name.localeCompare(b.employee_name);
    });
  };

  const updateAttendanceStatus = (employeeId, status) => {
    setAttendanceData(prev => ({ ...prev, [employeeId]: status }));
  };
  
  const loadForDate = useCallback(async (newDate = date) => {
    try {
      setLoading(true);
      
      // 1. Fetch ALL employees and their saved attendance (if any) for the date
      const res = await fetch(`/api/talakondapally/attendance?date=${encodeURIComponent(newDate)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load attendance");

      const fetchedEmployees = Array.isArray(j?.data) ? j.data : [];
      
      const recorded = [];
      const nextRecordedAttMap = {};
      const nextAttendanceData = {};
      
      let foundAnySubmission = false;

      // Ensure all employees are processed for sorting and default status setting
      const sortedAllEmployees = sortEmployees(fetchedEmployees.map(r => ({
          id: r.employee_id,
          employee_name: r.employee_name,
          designation: r.designation || "",
          status: r.status || "",
      })));

      for (const r of sortedAllEmployees) {
        // Check for Global Lock
        if (r.status && r.status.length > 0) {
            foundAnySubmission = true;
        }

        // Populate Read-Only display list (if status exists)
        if (r.status && r.status.length > 0) {
            recorded.push(r);
            nextRecordedAttMap[r.id] = r.status;
        }
        
        // Populate Editable data (Default to 'Present' if no status, otherwise use existing)
        nextAttendanceData[r.id] = r.status || STATUS.PRESENT;
      }
      
      // Set the global lock state
      setIsLocked(foundAnySubmission);

      if (foundAnySubmission) {
          // Locked view: show only recorded employees
          setRecordedEmployees(recorded);
          setRecordedAttMap(nextRecordedAttMap);
          // Clear submission states
          setAllEmployees([]);
          setAttendanceData({});
      } else {
          // Submission view: show ALL employees with status defaults
          setAllEmployees(sortedAllEmployees);
          setAttendanceData(nextAttendanceData);
          // Clear read-only states
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
  }, [date]);
  
  // Re-fetch data whenever the date changes
  useEffect(() => {
    if (!ready) return;
    loadForDate(date);
  }, [ready, date, loadForDate]);


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
    // 1. Validate data (ensure every employee has a status)
    if (Object.keys(attendanceData).length !== allEmployees.length) {
         Swal.fire({ icon: "warning", title: "Incomplete", text: "Please ensure all employees have an attendance status selected." });
         return;
    }
    
    // 2. Prepare payload
    const payload = {
        date: date,
        // The API expects 'rows' key if it's the POST logic from the shared file
        rows: Object.entries(attendanceData).map(([employee_id, status]) => ({
            employee_id: Number(employee_id),
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
      // FIX: Changed the URL from "/api/talakondapally/attendance/submit" 
      // to the correct URL handled by your existing API file.
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

      // Reload data to switch to locked/read-only view
      loadForDate(date); 

    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Submission Error",
        text: error.message || "Could not save attendance data.",
      });
    }
  };


  // Helper function to render the designation badge style
  const getDesignationBadgeStyle = (designation) => {
    const lower = designation.toLowerCase();
    if (lower.includes('labour')) return "bg-yellow-100 text-yellow-800";
    if (lower.includes('supervisor') || lower.includes('manager') || lower.includes('hod')) return "bg-blue-100 text-blue-800";
    if (lower.includes('vet') || lower.includes('doctor')) return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  }

  // Helper function to get status-specific colors for the dropdown
  const getStatusDropdownStyle = (status) => {
    // Uses focus:ring-{color}/50 for the ring color when focusing
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
      {/* Adjust main padding based on lock status: 
        pb-14 for ReadOnly (MobileFooterMenu), pb-32 for Submission (MobileFooterMenu + FixedSubmitButton) 
      */}
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

            {/* compact action icons (calendar + date input, refresh icon) */}
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
                                                {/* Employee Name and Designation */}
                                                <p className="text-lg font-semibold text-gray-900 truncate">{e.employee_name}</p>
                                                <span 
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${getDesignationBadgeStyle(e.designation)}`}
                                                >
                                                    {e.designation || 'Worker'}
                                                </span>
                                            </div>
                                            {/* Delete Button (Placeholder) */}
                                            <button 
                                                // The button is for UI consistency. No functionality added as per current scope.
                                                onClick={() => Swal.fire('Not Implemented', `Deleting ${e.employee_name} is currently not supported for attendance submission.`, 'info')}
                                                className="px-3 py-1 text-xs text-rose-600 border border-rose-300 rounded-md hover:bg-rose-50"
                                            >
                                                Delete
                                            </button>
                                        </div>

                                        {/* Status Dropdown */}
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
                >
                    <FiSave className="w-5 h-5" />
                    Submit Attendance for {date}
                </button>
            </div>
        )}

        <MobileFooterMenu />
      </main>
    </>
  );
}
