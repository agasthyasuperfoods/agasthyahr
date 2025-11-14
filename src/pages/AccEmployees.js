// src/pages/AccEmployees.jsx
import React, { useState, useEffect } from "react";
import Head from "next/head";
import SuperfoodsHeader from "@/components/SuperfoodsHeader";

function getLocationColor(location) {
  if (!location) return "bg-gray-100 text-gray-800 border-gray-300";
  switch (String(location).toLowerCase()) {
    case "tandur":
      return "bg-red-100 text-red-800 border-red-300";
    case "talakondapally":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "operations":
      return "bg-green-100 text-green-800 border-green-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function getCompanyBadge(company) {
  if (!company) return { label: "Unknown", classes: "bg-gray-100 text-gray-800 border-gray-300" };
  const key = String(company).toLowerCase();
  if (key === "asf") return { label: "ASF", classes: "bg-[#C1272D] text-white border-[#C1272D]" };
  if (key === "asf-factory") return { label: "ASF-factory", classes: "bg-[#1e40af] text-white border-[#1e40af]" };
  return { label: company, classes: "bg-gray-100 text-gray-800 border-gray-300" };
}

export default function AccEmployees() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // fetch once on mount
    const fetchEmployees = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(`/api/employees/listacc`);
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Unexpected API response: ${text || res.statusText}`);
        }
        if (!res.ok) {
          throw new Error(data.message || `API Error ${res.status}`);
        }
        if (!data.success) {
          throw new Error(data.message || "API returned unsuccessful response");
        }
        // employees from API already filtered to ASF / ASF-factory
        setEmployees(data.employees || []);
        setFilteredEmployees(data.employees || []);
      } catch (err) {
        console.error("Error fetching employees:", err);
        setErrorMsg(err.message || "Failed to load employees");
        setEmployees([]);
        setFilteredEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredEmployees(employees);
    } else {
      const q = searchQuery.toLowerCase();
      const filtered = employees.filter((emp) => {
        const name = (emp.name || "").toLowerCase();
        const designation = (emp.designation || "").toLowerCase();
        const empid = (emp.employeeid || "").toLowerCase();
        const company = (emp.company || "").toLowerCase();
        const location = ((emp.location || emp.Location) || "").toLowerCase();
        return (
          name.includes(q) ||
          designation.includes(q) ||
          empid.includes(q) ||
          company.includes(q) ||
          location.includes(q)
        );
      });
      setFilteredEmployees(filtered);
    }
  }, [searchQuery, employees]);

  const isKnownLocation = (location) => {
    if (!location) return false;
    const v = String(location).trim().toLowerCase();
    return v !== "unknown" && v !== "n/a" && v !== "";
  };

  return (
    <>
      <Head>
        <title>Employees • Accounts</title>
        <meta name="description" content="Accounts: ASF & ASF-factory employee directory" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <SuperfoodsHeader />

        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Employees — Accounts</h1>
            <p className="text-gray-600 mt-1">Showing employees for ASF & ASF-factory. Use search to find a person.</p>
          </div>

          {/* Search only (no location filters) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, employee ID, designation, company or location..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-[#C1272D]"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4 mb-6">
              ❌ {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C1272D]" />
              <p className="mt-2 text-gray-600">Loading employees...</p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredEmployees.length}</span> employee{filteredEmployees.length !== 1 ? "s" : ""}
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <p className="text-gray-500 text-lg">No employees found</p>
                  <p className="text-gray-400 text-sm mt-2">Try a different search query</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredEmployees.map((emp) => {
                    const companyBadge = getCompanyBadge(emp.company || emp.Company);
                    const rawLocation = emp.location ?? emp.Location ?? "";
                    const showLocation = isKnownLocation(rawLocation);
                    const locationBadge = showLocation ? getLocationColor(rawLocation) : null;
                    const displayLocation = showLocation ? rawLocation : "";

                    return (
                      <article key={emp.employeeid} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-lg truncate">{emp.name || emp.employeeid}</h3>
                            <p className="text-sm text-gray-500 mt-1 truncate">{emp.designation || "N/A"}</p>

                            <div className="mt-3 flex flex-wrap gap-2 items-center">
                              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${companyBadge.classes}`}>
                                {companyBadge.label}
                              </span>

                              {showLocation && (
                                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${locationBadge}`}>
                                  {displayLocation}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-gray-500">Employee ID</div>
                            <div className="font-medium text-gray-900">{emp.employeeid}</div>
                            <div className="mt-3 text-xs text-gray-500">Gross Salary</div>
                            <div className="font-semibold text-gray-900 mt-0.5">{emp.gross_salary ? `₹${Number(emp.gross_salary).toLocaleString("en-IN")}` : "N/A"}</div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
