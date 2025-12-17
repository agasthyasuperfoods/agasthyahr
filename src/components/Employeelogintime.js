import React, { useState, useEffect } from "react";

function formatTime(t) {
  if (!t) return "-";
  try { return t.slice(0, 5); } catch { return t; }
}
function formatDate(d) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}
function formatDuration(mins) {
  if (!mins || isNaN(Number(mins))) return "-";
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}m`;
  return `${h}h ${m}m`;
}

const STATUS_BG = {
  Present: "bg-green-50 border-green-400",
  Absent: "bg-red-50 border-red-400",
  Leave: "bg-blue-50 border-blue-400",
  Default: "bg-gray-50 border-gray-300"
};

const STATUS_TEXT = {
  Present: "text-green-700",
  Absent: "text-red-600",
  Leave: "text-blue-600",
  Default: "text-gray-800"
};

// Skeleton for MOBILE cards
function SkeletonCardFull() {
  return (
    <div className="rounded-lg border-l-4 shadow flex flex-row px-3 py-2 bg-gray-100 animate-pulse mb-2">
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
        <div className="flex flex-row gap-2">
          <div className="h-3 bg-gray-300 rounded w-12"></div>
          <div className="h-3 bg-gray-300 rounded w-12"></div>
          <div className="h-3 bg-gray-300 rounded w-12"></div>
        </div>
        <div className="h-3 bg-gray-300 rounded w-36 mt-2"></div>
      </div>
      <div className="h-7 bg-gray-300 rounded-full px-3 py-1 mx-2 w-20"></div>
    </div>
  );
}

function SkeletonMobilePagination() {
  return (
    <div className="w-full flex justify-between items-center mt-4 px-1 animate-pulse">
      <div className="h-8 bg-gray-300 rounded w-24"></div>
      <div className="h-8 bg-gray-300 rounded w-24"></div>
      <div className="h-8 bg-gray-300 rounded w-24"></div>
    </div>
  );
}

// Skeleton for DESKTOP table
function SkeletonRowFull() {
  return (
    <tr className="animate-pulse">
      <td className="py-4 px-3 border-b"><div className="h-4 bg-gray-300 rounded w-24 mx-auto"></div></td>
      <td className="py-4 px-3 border-b"><div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div></td>
      <td className="py-4 px-3 border-b"><div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div></td>
      <td className="py-4 px-3 border-b"><div className="h-3 bg-gray-300 rounded w-16 mx-auto"></div></td>
      <td className="py-4 px-3 border-b"><div className="h-5 bg-gray-300 rounded w-16 mx-auto"></div></td>
      <td className="py-4 px-3 border-b"><div className="h-3 bg-gray-300 rounded w-28 mx-auto"></div></td>
    </tr>
  );
}

function SkeletonDesktopPagination() {
  return (
    <div className="w-full flex justify-between items-center mt-4 px-1 animate-pulse">
      <div className="h-10 bg-gray-300 rounded w-32"></div>
      <div className="h-10 bg-gray-300 rounded w-40"></div>
      <div className="h-10 bg-gray-300 rounded w-32"></div>
    </div>
  );
}

function Employeelogintime() {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    const eid = localStorage.getItem("employeeId") || "";
    setEmployeeId(eid);
    if (eid) fetchPage(1, eid);
  }, []);

  const fetchPage = async (p, eid = employeeId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employeelogins?employeeId=${eid}&page=${p}&limit=7`);
      const body = await res.json();
      if (body.success) {
        setData(body.data);
        setPages(body.pages || 1);
        setPage(p);
      }
    } catch {}
    setLoading(false);
  };

  if (!employeeId) {
    return <div className="p-8 text-center text-red-600 font-bold">No employee ID found.</div>;
  }

  return (
    <div className="w-full mx-auto py-4 px-2">
      <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-4 text-center">Attendance</h2>
      {/* MOBILE: FULL SKELETON */}
      <div className="block md:hidden space-y-3 mb-2">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCardFull key={i}/>)}
            <SkeletonMobilePagination />
          </>
        ) : (
          <>
            {data.length === 0
              ? <div className="w-full text-center py-8 text-gray-600">No attendance records.</div>
              : data.map((row, idx) => {
                  const bgColor = STATUS_BG[row.status] || STATUS_BG.Default;
                  const textColor = STATUS_TEXT[row.status] || STATUS_TEXT.Default;
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border-l-4 shadow-sm flex flex-row flex-wrap items-center px-3 py-2 transition ${bgColor}`}
                    >
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="font-semibold text-gray-700 text-base">{formatDate(row.date)}</div>
                        <div className="text-xs text-gray-500 flex flex-row gap-2 flex-wrap">
                          <span>
                            <span className="font-semibold text-gray-700">In:</span> {formatTime(row.intime)}
                          </span>
                          <span>
                            <span className="font-semibold text-gray-700">Out:</span> {formatTime(row.outtime)}
                          </span>
                          <span>
                            <span className="font-semibold text-gray-700">Work:</span> {formatDuration(row.workdur)}
                          </span>
                        </div>
                        <span className="block text-xs mt-1 text-gray-600">
                          <span className="font-semibold">Remarks:</span> {row.remarks || "-"}
                        </span>
                      </div>
                      <div className={`px-3 py-1 mx-2 text-xs font-bold rounded-full border ${textColor} border-opacity-40 bg-opacity-80`}>
                        {row.status}
                      </div>
                    </div>
                  );
                })
            }
            {/* Pagination */}
            <div className="w-full flex justify-between items-center mt-4 px-1">
              <button
                className="px-4 py-1 rounded-lg bg-gray-200 text-gray-700 text-lg font-bold border shadow-sm transition hover:bg-gray-300 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => fetchPage(page - 1)}
              >Prev</button>
              <span className="text-gray-700 text-sm font-medium">Page {page} / {pages}</span>
              <button
                className="px-4 py-1 rounded-lg bg-gray-200 text-gray-700 text-lg font-bold border shadow-sm transition hover:bg-gray-300 disabled:opacity-50"
                disabled={page >= pages}
                onClick={() => fetchPage(page + 1)}
              >Next</button>
            </div>
          </>
        )}
      </div>
      {/* DESKTOP: FULL SKELETON */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg shadow mb-3">
          <table className="min-w-full bg-white text-sm">
            <thead>
              <tr>
                <th className="py-2 px-3 border-b font-semibold text-left">Date</th>
                <th className="py-2 px-3 border-b font-semibold text-left">In</th>
                <th className="py-2 px-3 border-b font-semibold text-left">Out</th>
                <th className="py-2 px-3 border-b font-semibold text-left">Work</th>
                <th className="py-2 px-3 border-b font-semibold text-left">Status</th>
                <th className="py-2 px-3 border-b font-semibold text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRowFull key={i}/>)
                ) : (
                  data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-600">No attendance records.</td>
                    </tr>
                  ) : (
                    data.map((row, idx) => {
                      const textColor = STATUS_TEXT[row.status] || STATUS_TEXT.Default;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2 px-3 border-b">{formatDate(row.date)}</td>
                          <td className="py-2 px-3 border-b">{formatTime(row.intime)}</td>
                          <td className="py-2 px-3 border-b">{formatTime(row.outtime)}</td>
                          <td className="py-2 px-3 border-b">{formatDuration(row.workdur)}</td>
                          <td className={`py-2 px-3 border-b font-bold ${textColor}`}>{row.status}</td>
                          <td className="py-2 px-3 border-b">{row.remarks || "-"}</td>
                        </tr>
                      );
                    })
                  )
                )
              }
            </tbody>
          </table>
        </div>
        {/* Pagination: Skeleton or real buttons */}
        {loading ? (
          <SkeletonDesktopPagination />
        ) : (
          <div className="w-full flex justify-between items-center mt-2 px-1">
            <button
              className="px-4 py-1 rounded-lg bg-gray-200 text-gray-700 text-lg font-bold border shadow-sm transition hover:bg-gray-300 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => fetchPage(page - 1)}
            >Next</button>
            <span className="text-gray-700 text-sm font-medium">Page {page} / {pages}</span>
            <button
              className="px-4 py-1 rounded-lg bg-gray-200 text-gray-700 text-lg font-bold border shadow-sm transition hover:bg-gray-300 disabled:opacity-50"
              disabled={page >= pages}
              onClick={() => fetchPage(page + 1)}
            >Prev</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Employeelogintime;
