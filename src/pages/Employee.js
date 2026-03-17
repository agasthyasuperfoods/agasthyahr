// src/pages/employee.js
// Uses single API at /api/updateapipage to fetch full EmployeeTable rows.

import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import AppHeader from "@/components/AppHeader";
import Swal from "sweetalert2";
import EmployeeEditModule from "@/components/EmployeeEditModule";
import { Users, Search as SearchIcon, Loader2, Pencil, X as XIcon, Save } from "lucide-react";

const ASSETS_API = "/api/assets/Aindex";
const USERS_API = "/api/updateapipage"; // single API
const ATTENDANCE_CHECK_API = "/api/attendance/check";

/* ========= tiny auth identity helper for profile fallback ========= */
function getAuthIdentity() {
  if (typeof window === "undefined") return { id: null, email: null };
  const ls = window.localStorage;
  return {
    id: ls.getItem("hr_employeeid") || null,
    email: ls.getItem("hr_email") || null,
  };
}

function classifyQuery(q) {
  const s = String(q || "").trim();
  if (!s) return { type: null, value: "" };
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (isEmail) return { type: "email", value: s };
  const looksLikeId = /[0-9]/.test(s) || /^EMP/i.test(s);
  if (looksLikeId) return { type: "id", value: s };
  return { type: "name", value: s };
}

const fmt = {
  date(d) {
    if (!d) return "-";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
  },
};

const QUOTES = [
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "It always seems impossible until it’s done.", author: "Nelson Mandela" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "If I cannot do great things, I can do small things in a great way.", author: "Martin Luther King Jr." },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The best way out is always through.", author: "Robert Frost" },
];

function getGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getDailyQuote(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const day = Math.floor(diff / 86400000);
  return QUOTES[day % QUOTES.length];
}

/* ========= Attendance Calendar (Current Month) ========= */
function AttendanceCalendar({ className = "" }) {
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const today = new Date();
  const year = today.getFullYear();
  const monthIdx = today.getMonth();
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);

  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const monthName = today.toLocaleString(undefined, { month: "long" });

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const y = year;
  const m = monthIdx + 1;
  const pad2 = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${y}-${pad2(m)}-${pad2(d)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const runDates = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const cur = new Date(year, monthIdx, d);
          if (cur <= today) runDates.push(toISO(d));
        }
        const results = await Promise.all(
          runDates.map(async (ds) => {
            try {
              const res = await fetch(`${ATTENDANCE_CHECK_API}?date=${encodeURIComponent(ds)}`);
              const j = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(j?.error || "Failed");
              return [ds, j?.hasData ? "submitted" : "not_submitted"];
            } catch {
              return [ds, "not_submitted"];
            }
          })
        );
        if (cancelled) return;
        const obj = {};
        for (const [ds, st] of results) obj[ds] = st;
        setStatusMap(obj);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, monthIdx, daysInMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm p-3 ${className}`} style={{ width: 300 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">
          {monthName} {year}
        </div>
        {loading ? (
          <div className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…
          </div>
        ) : (
          <div className="text-xs text-gray-500">
            {mounted ? new Date().toLocaleDateString('en-GB') : ""}
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-500 mb-1">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="text-transparent h-7" aria-hidden>·</div>;
          const cellDate = new Date(year, monthIdx, d);
          const isFuture = cellDate > new Date();
          const ds = toISO(d);
          const status = statusMap[ds];

          let cls = "text-sm h-7 leading-7 rounded";
          let contentCls = "text-gray-800";
          if (!isFuture) {
            if (status === "submitted") {
              cls += " bg-green-100";
              contentCls = "text-green-700 font-semibold";
            } else if (status === "not_submitted") {
              cls += " bg-orange-100";
              contentCls = "text-orange-700";
            }
          }
          const isToday =
            new Date().getFullYear() === year &&
            new Date().getMonth() === monthIdx &&
            new Date().getDate() === d;
          if (isToday) cls += " ring-1 ring-blue-400";

          return (
            <div key={i} className={cls} title={ds}>
              <span className={contentCls}>{d}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========= API helper ========= */
async function fetchEmployeeById(id) {
  const res = await fetch(`${USERS_API}?id=${encodeURIComponent(id)}`);
  const j = await res.json().catch(() => ({}));
  if (res.ok && Array.isArray(j?.data) && j.data.length) return j.data[0];
  throw new Error(j?.error || "Employee not found");
}



function Field({ label, value, wide, formatter }) {
  return (
    <div className={wide ? "md:col-span-2 xl:col-span-3" : ""}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-gray-900">{formatter ? formatter(value) : value ?? "-"}</div>
    </div>
  );
}

function AllEmployeesTable({ employees, isLoading, onEdit }) {
  const [companyFilter, setCompanyFilter] = useState('All Companies');

  // Normalize company names to uppercase for unique, case-insensitive filtering
  const uniqueCompanies = [...new Set(employees.map(e => e.company?.trim().toUpperCase()).filter(Boolean))].sort();
  const companyChips = ['All Companies', ...uniqueCompanies];

  // Case-insensitive filtering
  const filteredEmployees = employees.filter(employee => {
    if (companyFilter === 'All Companies') return true;
    return employee.company?.trim().toUpperCase() === companyFilter;
  });

  if (isLoading) {
    return (
      <div className="text-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin inline-block text-gray-400" />
        <p className="text-gray-500 mt-2">Loading Employees...</p>
      </div>
    );
  }

  if (!employees.length) {
    return (
      <div className="text-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <p className="text-gray-500">No employees found.</p>
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-6 pt-4 pb-3 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h3 className="text-base font-semibold text-gray-900 self-center">All Employees</h3>
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex-nowrap">
            {companyChips.map(c => (
              <button
                key={c}
                onClick={() => setCompanyFilter(c)}
                className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 border ${
                  companyFilter === c
                    ? 'bg-[#b03838] text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#b03838] hover:text-[#b03838] hover:bg-red-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 border-b">Employee ID</th>
                <th className="px-3 py-2 border-b">Name</th>
                <th className="px-3 py-2 border-b">Email</th>
                <th className="px-3 py-2 border-b">Role</th>
                <th className="px-3 py-2 border-b">Company</th>
                <th className="px-3 py-2 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((u) => (
                  <tr key={u.employeeid} className="odd:bg-white even:bg-gray-50 align-top">
                    <td className="px-3 py-2 border-t">{u.employeeid ?? "-"}</td>
                    <td className="px-3 py-2 border-t">{u.name || "-"}</td>
                    <td className="px-3 py-2 border-t">{u.email || "-"}</td>
                    <td className="px-3 py-2 border-t">
                      <span className="rounded bg-gray-100 px-2 py-0.5">{u.role || "-"}</span>
                    </td>
                    <td className="px-3 py-2 border-t">{u.company || "-"}</td>
                    <td className="px-3 py-2 border-t text-right">
                      <button
                        onClick={() => onEdit(u)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 p-6 border-t">
                    No employees found for the selected company.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function Employee() {
  const router = useRouter();

  /* ----- Header wiring (hrName, logout) ----- */
  const [hrName, setHrName] = useState("HR");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me");
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setHrName(j?.name || j?.hrName || "HR");
      } catch {
        if (!cancelled) setHrName("HR");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("hr_auth");
        localStorage.removeItem("hr_role");
        localStorage.removeItem("hr_employeeid");
        localStorage.removeItem("hr_email");
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
      }
    } catch {}
    try {
      router.replace("/Hlogin");
    } catch {}
    if (typeof window !== "undefined") setTimeout(() => window.location.replace("/Hlogin"), 50);
  };

  // Search + suggestions
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  // Close-robustness helpers
  const reqIdRef = useRef(0);
  const suggestEnabledRef = useRef(true);

  // Results + selected profile
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  // Employee assets
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  // Total employees KPI
  const [employeeCount, setEmployeeCount] = useState(null);

  // Update module
  const [showEditModule, setShowEditModule] = useState(false);

  // State for the main employee table
  const [employeeList, setEmployeeList] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  // State for populating dropdowns in the edit module
  const [allEmployeesForDropdowns, setAllEmployeesForDropdowns] = useState([]);

  const getUniqueValues = (key) => {
    const allValues = allEmployeesForDropdowns.map(e => e[key]).filter(Boolean);
    return [...new Set(allValues)];
  };

  useEffect(() => {
    // Fetch all employees to display in the main table and to get roles/companies for the modal
    (async () => {
      try {
        setListLoading(true);
        const res = await fetch(`${USERS_API}?all=1`);
        const data = await res.json();
        if (res.ok) {
          const employees = data.data || [];
          setEmployeeList(employees);
          setAllEmployeesForDropdowns(employees);
        }
      } catch (e) {
        console.error("Failed to fetch all employees", e);
        // Optionally set an error state here to show in the UI
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  // Refs
  const inputRef = useRef(null);
  const suggestRef = useRef(null);
  const debounceTimer = useRef(null);
  const lastSuggestQuery = useRef("");

  const hardCloseSuggestions = () => {
    setSuggestOpen(false);
    setSuggestions([]);
    setHighlightIdx(-1);
    lastSuggestQuery.current = "";
    reqIdRef.current += 1;
  };

  // Count KPI
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let res = await fetch(`${USERS_API}?count=1`);
        let j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && (j?.count ?? j?.total ?? null) != null) {
          setEmployeeCount(Number(j.count ?? j.total));
          return;
        }
        res = await fetch(`${USERS_API}?limit=1`);
        j = await res.json().catch(() => ({}));
        if (!cancelled && (j?.total ?? j?.count ?? j?.meta?.total ?? null) != null) {
          setEmployeeCount(Number(j.total ?? j.count ?? j.meta?.total));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced suggestions
  useEffect(() => {
    if (!search.trim()) {
      hardCloseSuggestions();
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const q = search.trim();
      if (!q || !suggestEnabledRef.current) return;

      if (lastSuggestQuery.current === q && suggestions.length) {
        setSuggestOpen(true);
        return;
      }

      const myReqId = ++reqIdRef.current;
      lastSuggestQuery.current = q;
      setSuggestLoading(true);
      setError("");

      try {
        const res = await fetch(`${USERS_API}?suggest=1&q=${encodeURIComponent(q)}&limit=8`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Suggestion lookup failed");
        if (myReqId !== reqIdRef.current || !suggestEnabledRef.current) return;
        const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        setSuggestions(arr);
        setSuggestOpen(true);
        setHighlightIdx(arr.length ? 0 : -1);
      } catch (e) {
        if (myReqId !== reqIdRef.current) return;
        setSuggestions([]);
        setSuggestOpen(false);
        if (e?.message) setError(e.message);
      } finally {
        if (myReqId === reqIdRef.current) setSuggestLoading(false);
      }
    }, 200);
    return () => clearTimeout(debounceTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outside click closes dropdown
  useEffect(() => {
    function onDocClick(e) {
      if (!suggestRef.current) return;
      if (!suggestRef.current.contains(e.target) && !(inputRef.current && inputRef.current.contains(e.target))) {
        hardCloseSuggestions();
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Close when a user is set
  useEffect(() => {
    if (selected?.employeeid) {
      suggestEnabledRef.current = false;
      hardCloseSuggestions();
    }
  }, [selected?.employeeid]);

  const doSearch = async (e) => {
    if (e) e.preventDefault();
    const { type, value } = classifyQuery(search);
    if (!type) {
      setResults([]);
      setSelected(null);
      setError("Enter an email, employee ID, or name.");
      return;
    }
    try {
      setSearching(true);
      setError("");
      setSelected(null);
      setAssets([]);
      setAssetsLoading(false);
      const qs =
        type === "email"
          ? `email=${encodeURIComponent(value)}`
          : type === "id"
          ? `id=${encodeURIComponent(value)}`
          : `name=${encodeURIComponent(value)}`;
      const res = await fetch(`${USERS_API}?${qs}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Search failed");
      const arr = Array.isArray(j?.data) ? j.data : [];
      setResults(arr);
      if (arr.length === 1) {
        try {
          const only = arr[0];
          const full = only?.employeeid ? await fetchEmployeeById(only.employeeid) : only;
          setSelected(full);
          setResults([full]);
        } catch {
          setSelected(arr[0]);
        } finally {
          suggestEnabledRef.current = false;
          hardCloseSuggestions();
        }
      }
    } catch (e2) {
      setError(e2.message || "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Load assets for selected
  useEffect(() => {
    if (!selected?.employeeid) return;
    (async () => {
      try {
        setAssetsLoading(true);
        const res = await fetch(`${ASSETS_API}?assigned_employeeid=${encodeURIComponent(selected.employeeid)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load assets");
        setAssets(Array.isArray(j?.data) ? j.data : []);
      } catch (e) {
        Swal.fire({ icon: "error", title: "Assets", text: e.message || "Failed to load assets" });
        setAssets([]);
      } finally {
        setAssetsLoading(false);
      }
    })();
  }, [selected?.employeeid]);

  // Async choose suggestion -> always fetch full row
  const chooseSuggestion = async (u) => {
    try {
      setSearch(u.employeeid || u.email || u.name || "");
      const full = u?.employeeid ? await fetchEmployeeById(u.employeeid) : u;
      setResults([full]);
      setSelected(full);
    } catch {
      setResults([u]);
      setSelected(u);
    } finally {
      suggestEnabledRef.current = false;
      hardCloseSuggestions();
    }
  };

  // KEYBOARD HANDLER (fixes the ReferenceError)
  const onInputKeyDown = async (e) => {
    if (suggestOpen && (suggestions.length || suggestLoading)) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (suggestions.length ? (i + 1) % suggestions.length : -1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => (suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : -1));
        return;
      } else if (e.key === "Enter") {
        if (highlightIdx >= 0 && suggestions[highlightIdx]) {
          e.preventDefault();
          await chooseSuggestion(suggestions[highlightIdx]);
          return;
        }
      } else if (e.key === "Escape") {
        hardCloseSuggestions();
        return;
      }
    }
    if (e.key === "Enter") doSearch(e);
  };

  const offboardOne = async (asset) => {
    if (!asset?.id) return;
    const ok = await Swal.fire({
      icon: "warning",
      title: "Unassign asset?",
      text: `Asset ${asset.asset_tag || asset.serial_no || `#${asset.id}`} will be unassigned and moved to InStock.`,
      showCancelButton: true,
      confirmButtonText: "Yes, Unassign",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (!ok) return;
    try {
      const res = await fetch(ASSETS_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "offboard", assetIds: [asset.id] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Unassign failed");
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      Swal.fire({ icon: "success", title: "Unassigned", text: "Asset is now InStock." });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Unassign failed", text: e.message || "Failed" });
    }
  };

  // Safety net: upgrade partial selections to full DB row
  useEffect(() => {
    (async () => {
      if (!selected?.employeeid) return;
      const missingCore =
        selected.designation === undefined ||
        selected.reporting_to_id === undefined ||
        (selected.Leaves_cf === undefined && selected.leaves_cf === undefined) ||
        selected.grosssalary === undefined;
      if (!missingCore) return;
      try {
        const full = await fetchEmployeeById(selected.employeeid);
        setSelected(full);
        setResults((prev) => prev.map((r) => (r.employeeid === full.employeeid ? full : r)));
      } catch {}
    })();
  }, [selected?.employeeid]);

  const canShowEmployeePicker = results.length > 1 && !selected;
  const showEmployeeDetails = !!selected;

  // Greeting content (use HR name from header)
  const greetingName = hrName || "HR";
  const greeting = getGreeting();
  const dailyQuote = getDailyQuote();

  return (
    <>
      <Head>
        <title>Employee • Assets & Details</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <AppHeader currentPath={router.pathname} hrName={hrName} onLogout={logout} />

        <div className="p-4 md:p-6 space-y-8">
          {/* ===== Organized Search / Calendar / KPI ===== */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            {/* Row layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 ">
              {/* Left: Title + Search */}
              <div className="lg:col-span-6 self-start ">
                <div className="mb-3">
                  <div className="mb-5">
                    <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4">
                      <div>
                        <div className="text-sm text-gray-700">
                          {greeting}, <span className="font-semibold text-gray-900">{greetingName}</span> 👋
                        </div>
                        <p className="mt-1 text-sm text-gray-700 italic">
                          “{dailyQuote.text}”
                          {dailyQuote.author ? <span className="not-italic text-gray-500"> — {dailyQuote.author}</span> : null}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <label className="block text-sm font-medium text-gray-700 ">Search Employee</label>
                <p className="text-xs text-gray-500 mb-2 ">Find an employee, view details, and manage assigned assets.</p>

                <div className="relative" ref={suggestRef}>
                  <SearchIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      suggestEnabledRef.current = true;
                      setSuggestOpen(true);
                      setHighlightIdx(-1);
                    }}
                    onFocus={() => {
                      if (search.trim() && suggestions.length) setSuggestOpen(true);
                    }}
                    onKeyDown={onInputKeyDown}
                    className="w-full rounded-xl border border-gray-300 pl-9 pr-40 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder="Type employee ID (e.g., EMP1001), email, or name…"
                    autoComplete="off"
                  />

                  {/* Right-side controls */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {search ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          suggestEnabledRef.current = true;
                          hardCloseSuggestions();
                          setResults([]);
                          setSelected(null);
                          inputRef.current?.focus();
                        }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        aria-label="Clear search"
                        title="Clear"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={doSearch}
                      disabled={searching}
                      className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                    >
                      {searching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching…
                        </>
                      ) : (
                        <>
                          <SearchIcon className="h-4 w-4" />
                          Search
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setResults([]);
                        setSelected(null);
                        setShowEditModule(false);
                        hardCloseSuggestions();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      title="Clear search and show all employees"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Suggestions dropdown */}
                  {suggestOpen ? (
                    <div
                      className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden"
                      onMouseDown={(e) => {
                        if (e.currentTarget === e.target) hardCloseSuggestions();
                      }}
                    >
                      {suggestLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching…
                        </div>
                      ) : null}

                      {!suggestLoading && suggestions.length > 0 ? (
                        <ul role="listbox" className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                          {suggestions.map((u, idx) => {
                            const active = idx === highlightIdx;
                            return (
                              <li
                                key={`${u.employeeid || u.email || u.name || idx}`}
                                role="option"
                                aria-selected={active}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => chooseSuggestion(u)}
                                className={`px-3 py-2 cursor-pointer ${active ? "bg-blue-50" : "bg-white"} hover:bg-blue-50`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{u.name || "-"}</div>
                                    <div className="text-xs text-gray-600 truncate">
                                      {u.email || "-"} • {u.company || "-"} • {u.role || "-"}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">{u.employeeid || ""}</div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}

                      {!suggestLoading && suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Middle: Calendar + Legend */}
              <div className="lg:col-span-4">
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3">
                  <div className="flex items-start gap-4">
                    <AttendanceCalendar />
                    <div className="min-w-[140px]">
                      <div className="text-xs font-medium text-gray-700 mb-2">Attendance</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3.5 w-3.5 rounded bg-green-100 ring-1 ring-green-300" />
                          <span className="text-gray-800">Submitted</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3.5 w-3.5 rounded bg-orange-100 ring-1 ring-orange-300" />
                          <span className="text-gray-800">Not submitted</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3.5 w-3.5 rounded bg-white ring-1 ring-gray-200" />
                          <span className="text-gray-800">Future</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Total employees KPI */}
              <div className="lg:col-span-2">
                <div className="h-full rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex items-center">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <Users className="h-5 w-5 text-gray-700" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Total Employees</div>
                      <div className="text-2xl leading-6 font-semibold text-gray-900 mt-1">
                        {employeeCount != null ? (
                          employeeCount.toLocaleString()
                        ) : (
                          <span className="inline-block h-6 w-16 rounded bg-gray-100 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-result table (only when >1 and not selected) */}
            {canShowEmployeePicker ? (
              <div className="mt-6 border border-gray-200 rounded-2xl overflow-hidden">
                <table className="min-w-[800px] w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2 border-b">Employee ID</th>
                      <th className="px-3 py-2 border-b">Name</th>
                      <th className="px-3 py-2 border-b">Email</th>
                      <th className="px-3 py-2 border-b">Role</th>
                      <th className="px-3 py-2 border-b">Company</th>
                      <th className="px-3 py-2 border-b text-right">Select</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((u, idx) => (
                      <tr key={u.employeeid || idx} className="odd:bg-white even:bg-gray-50 align-top">
                        <td className="px-3 py-2 border-t">{u.employeeid ?? "-"}</td>
                        <td className="px-3 py-2 border-t">{u.name || "-"}</td>
                        <td className="px-3 py-2 border-t">{u.email || "-"}</td>
                        <td className="px-3 py-2 border-t">
                          <span className="rounded bg-gray-100 px-2 py-0.5">{u.role || "-"}</span>
                        </td>
                        <td className="px-3 py-2 border-t">{u.company || "-"}</td>
                        <td className="px-3 py-2 border-t text-right">
                          <button
                            onClick={async () => {
                              try {
                                const full = u?.employeeid ? await fetchEmployeeById(u.employeeid) : u;
                                setSelected(full);
                                setResults((prev) => prev.map((r) => (r.employeeid === u.employeeid ? full : r)));
                              } catch {
                                setSelected(u);
                              } finally {
                                suggestEnabledRef.current = false;
                                hardCloseSuggestions();
                              }
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                          No results.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {/* ===== All Employees Table (shown by default) ===== */}
          {!selected && results.length === 0 ? (
            <AllEmployeesTable
              employees={employeeList}
              isLoading={listLoading}
              onEdit={(employee) => {
                setSelected(employee);
                setShowEditModule(true);
              }}
            />
          ) : null}


          {/* ===== New Edit Module ===== */}
          {showEmployeeDetails && showEditModule ? (
            <EmployeeEditModule
              user={selected}
              onCancel={() => setShowEditModule(false)}
              onSaved={(updated) => {
                setSelected(updated);
                setResults((prev) =>
                  prev.length === 1 ? [updated] : prev.map((u) => (u.employeeid === updated.employeeid ? updated : u))
                );
                setShowEditModule(false);
              }}
              roles={getUniqueValues('role')}
              companies={getUniqueValues('company')}
            />
          ) : null}


          {/* ===== Details + Assets ===== */}
          {showEmployeeDetails && !showEditModule ? (
            <section className="space-y-6">
              {/* Employee details */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Employee Details</h3>
                    <p className="text-sm text-gray-600">All fields pulled from EmployeeTable.</p>
                  </div>
                  <div>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-[#b03838] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#8e2d2d]"
                      onClick={() => setShowEditModule(true)}
                    >
                      <Pencil className="h-4 w-4" /> Update
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
                  <Field label="Employee ID" value={selected.employeeid} />
                  <Field label="Name" value={selected.name} />
                  <Field label="Email" value={selected.email} />
                  <Field label="Role" value={selected.role} />
                  <Field label="Company" value={selected.company} />
                  <Field label="Phone" value={selected.number} />
                  <Field label="Designation" value={selected.designation} />
                  <Field label="Reporting To" value={selected.reporting_to_id} />
                  <Field label="Date of Joining" value={selected.doj} formatter={fmt.date} />
                  <Field label="Gross Salary" value={selected.grosssalary || selected.grossSalary} />
                  <Field label="PAN" value={selected.pancard} />
                  <Field label="Carryforward Leaves" value={selected.Leaves_cf ?? selected.leaves_cf} />
                  <Field label="Address" value={selected.address} />
                </div>
              </div>

              {/* Assets */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Assigned Assets</h3>
                    <p className="text-xs text-gray-500">
                      Pulled from <code className="font-mono">public."Assets"</code>.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-gray-600">
                        <th className="px-3 py-2 border-b">ID</th>
                        <th className="px-3 py-2 border-b">Asset Tag</th>
                        <th className="px-3 py-2 border-b">Category</th>
                        <th className="px-3 py-2 border-b">Brand</th>
                        <th className="px-3 py-2 border-b">Model</th>
                        <th className="px-3 py-2 border-b">Serial No</th>
                        <th className="px-3 py-2 border-b">Assigned Date</th>
                        <th className="px-3 py-2 border-b">Company</th>
                        <th className="px-3 py-2 border-b">Location</th>
                        <th className="px-3 py-2 border-b">Status</th>
                        <th className="px-3 py-2 border-b text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetsLoading ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                            <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                            Loading assets…
                          </td>
                        </tr>
                      ) : assets.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                            No assets assigned.
                          </td>
                        </tr>
                      ) : (
                        assets.map((a) => (
                          <tr key={a.id} className="odd:bg-white even:bg-gray-50 align-top">
                            <td className="px-3 py-2 border-t">{a.id}</td>
                            <td className="px-3 py-2 border-t">{a.asset_tag || "-"}</td>
                            <td className="px-3 py-2 border-t">{a.category || "-"}</td>
                            <td className="px-3 py-2 border-t">{a.brand || "-"}</td>
                            <td className="px-3 py-2 border-t">{a.model || "-"}</td>
                            <td className="px-3 py-2 border-t">{a.serial_no || "-"}</td>
                            <td className="px-3 py-2 border-t">{fmt.date(a.assigned_date)}</td>
                            <td className="px-3 py-2 border-t">{a.company || "-"}</td>
                            <td className="px-3 py-2 border-t">{a.location || "-"}</td>
                            <td className="px-3 py-2 border-t">
                              <span className="rounded bg-gray-100 px-2 py-0.5">{a.status || "-"}</span>
                            </td>
                            <td className="px-3 py-2 border-t text-right">
                              <button onClick={() => offboardOne(a)} className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100">
                                Unassign
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
