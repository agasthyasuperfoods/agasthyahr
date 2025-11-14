import React, { useEffect, useState } from "react";

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

function Employeesoftalakondapallymain() {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const date = todayIso();
    fetch(`/api/talakondapally/attendance?date=${encodeURIComponent(date)}`)
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.data) ? data.data : [];
        // rows: [{ employee_id, employee_name, designation, ... }]
        rows.sort((a, b) => {
          const orderA = DESIGNATION_ORDER[a.designation?.trim() || ""] || 999;
          const orderB = DESIGNATION_ORDER[b.designation?.trim() || ""] || 999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.employee_name || "").localeCompare(b.employee_name || "");
        });
        setEmployees(rows);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h2 className="text-xl font-bold text-amber-700 mb-4">Employees List</h2>
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="min-w-full mb-10 text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Designation</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-gray-500">
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.employee_id || emp.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{emp.employee_name}</td>
                  <td className="px-4 py-2 text-gray-700">{emp.designation || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Employeesoftalakondapallymain;
