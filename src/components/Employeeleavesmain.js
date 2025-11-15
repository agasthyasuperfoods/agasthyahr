import React, { useEffect, useState } from "react";

function formatDate(d) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function Employeeleavesmain() {
  const [leaveData, setLeaveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(7); // Set limit for page size

  useEffect(() => {
    const eid = localStorage.getItem("employeeId") || "";
    if (!eid) {
      setLeaveData(null);
      setLoading(false);
      return;
    }
    async function fetchLeaves() {
      setLoading(true);
      const res = await fetch(`/api/employeeleaves?employeeId=${eid}&page=${page}&limit=${limit}`);
      const body = await res.json();
      setLeaveData(body.success ? body : null);
      setLoading(false);
    }
    fetchLeaves();
  }, [page, limit]);

  const now = new Date();
  const month = now.toLocaleString("default", { month: "long" });

  return (
    <div className="w-full max-w-xl mx-auto py-6 px-3">
      <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-5 text-center">Leave Dashboard</h2>
      <div className="bg-white rounded-lg shadow p-5">
        {loading && <div className="text-center py-12 text-gray-400">Loading...</div>}
        {!loading && !leaveData && (
          <div className="text-center py-12 text-red-500">Unable to load leave data for user.</div>
        )}
        {!loading && leaveData && (
          <>
            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded bg-green-50 border border-green-200 p-4 flex flex-col items-center">
                <div className="text-sm text-gray-600 font-medium">Leaves Carry Forward</div>
                <div className="text-3xl md:text-4xl font-bold text-green-700">{leaveData.leaves_cf}</div>
              </div>
              <div className="rounded bg-red-50 border border-red-200 p-4 flex flex-col items-center">
                <div className="text-sm text-gray-600 font-medium">{month} Leaves Taken</div>
                <div className="text-3xl md:text-4xl font-bold text-red-700">{leaveData.leaveDays}</div>
              </div>
            </div>
            {/* Paginated Leave Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Leave history for {month}</h3>
              {leaveData.data.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No leave records for this month.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white text-sm rounded shadow">
                    <thead>
                      <tr>
                        <th className="py-2 px-3 border-b font-semibold text-left">Date</th>
                        <th className="py-2 px-3 border-b font-semibold text-left">Status</th>
                        <th className="py-2 px-3 border-b font-semibold text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveData.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-1 px-3 border-b">{formatDate(row.date)}</td>
                          <td className="py-1 px-3 border-b font-bold text-red-600">{row.status}</td>
                          <td className="py-1 px-3 border-b">{row.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Pagination */}
              <div className="w-full flex justify-between items-center mt-4 px-1">
                <button
                  className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 text-base font-bold border shadow-sm transition hover:bg-gray-300 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >Prev</button>
                <span className="text-gray-700 text-base font-semibold">Page {page} / {leaveData.pages}</span>
                <button
                  className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 text-base font-bold border shadow-sm transition hover:bg-gray-300 disabled:opacity-50"
                  disabled={page >= leaveData.pages}
                  onClick={() => setPage(page + 1)}
                >Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Employeeleavesmain;
