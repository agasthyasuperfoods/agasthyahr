import React, { useEffect, useMemo, useState } from "react";

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

  const date = useMemo(() => todayIso(), []);

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

        rows.sort((a, b) => {
          const orderA = DESIGNATION_ORDER[a.designation?.trim() || ""] || 999;
          const orderB = DESIGNATION_ORDER[b.designation?.trim() || ""] || 999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.employee_name || "").localeCompare(b.employee_name || "");
        });

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

        base.sort((a, b) => {
          const orderA = DESIGNATION_ORDER[a.designation?.trim() || ""] || 999;
          const orderB = DESIGNATION_ORDER[b.designation?.trim() || ""] || 999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.employee_name || "").localeCompare(b.employee_name || "");
        });

        const prepared = base.map((e) => ({
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
        // Do NOT flip to entry on error; keep on loading error state until retry
        setMode("loading");
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [date]);

  async function handleSubmit() {
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

      // Lock to readonly after submit
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
      setError(e.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h2 className="text-xl font-bold text-amber-700 mb-4">
        Employees List — {date}
      </h2>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="min-w-full mb-10 text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Designation</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Status</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">In</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Out</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Remarks</th>
            </tr>
          </thead>

          <tbody>
            {mode === "loading" && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-gray-500">Loading...</td>
              </tr>
            )}

            {mode === "readonly" &&
              (employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-gray-500">No employees found.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employee_id || emp.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-900">{emp.employee_name}</td>
                    <td className="px-4 py-2 text-gray-700">{emp.designation || "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{emp.status || "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{emp.in_time || "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{emp.out_time || "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{emp.remarks || "—"}</td>
                  </tr>
                ))
              ))}

            {mode === "entry" &&
              (entryRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-gray-500">No employees to enter.</td>
                </tr>
              ) : (
                entryRows.map((row, idx) => (
                  <tr key={row.employee_id || idx} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-900">{row.employee_name}</td>
                    <td className="px-4 py-2 text-gray-700">{row.designation || "—"}</td>
                    <td className="px-4 py-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={row.status}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEntryRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, status: v } : r))
                          );
                        }}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Leave">Leave</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        className="border rounded px-2 py-1"
                        value={row.in_time}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEntryRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, in_time: v } : r))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        className="border rounded px-2 py-1"
                        value={row.out_time}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEntryRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, out_time: v } : r))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Remarks"
                        className="border rounded px-2 py-1 w-full"
                        value={row.remarks}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEntryRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, remarks: v } : r))
                          );
                        }}
                      />
                    </td>
                  </tr>
                ))
              ))}
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
    </div>
  );
}
