import React, { useState, useEffect } from 'react';
import Head from 'next/head';

function Nemployeeslist() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchEmployees(selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.location && emp.location.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredEmployees(filtered);
    }
  }, [searchQuery, employees]);

  const fetchEmployees = async (location) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/employees/list?location=${location}`);
      if (!res.ok) throw new Error('Failed to load employees');
      const data = await res.json();
      setEmployees(data.employees || []);
      setFilteredEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMsg('Failed to load employees');
      setEmployees([]);
      setFilteredEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const getLocationColor = (location) => {
    switch (location.toLowerCase()) {
      case 'tandur':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'talakondapally':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'operations':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleLocationChange = (location) => {
    setSelectedLocation(location);
    setSearchQuery('');
  };

  return (
    <>
      <Head>
        <title>Employee List • Accounts</title>
        <meta name="description" content="View and search all employees across locations" />
      </Head>

      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Employee Directory</h1>
            <p className="text-gray-600">View and search all employees across all locations</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="space-y-4">
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Filter by Location
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => handleLocationChange('all')}
                    className={`p-3 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'all'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 hover:border-gray-900 text-gray-700'
                    }`}
                  >
                    All Locations
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationChange('tandur')}
                    className={`p-3 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'tandur'
                        ? 'border-[#C1272D] bg-[#C1272D] text-white'
                        : 'border-gray-300 hover:border-[#C1272D] text-gray-700'
                    }`}
                  >
                    Tandur
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationChange('talakondapally')}
                    className={`p-3 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'talakondapally'
                        ? 'border-[#1e40af] bg-[#1e40af] text-white'
                        : 'border-gray-300 hover:border-[#1e40af] text-gray-700'
                    }`}
                  >
                    Talakondapally
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationChange('operations')}
                    className={`p-3 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'operations'
                        ? 'border-[#16a34a] bg-[#16a34a] text-white'
                        : 'border-gray-300 hover:border-[#16a34a] text-gray-700'
                    }`}
                  >
                    Delivery Boys
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div>
                <label htmlFor="search" className="block text-sm font-semibold text-gray-900 mb-2">
                  Search Employee
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, designation, or location..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-[#C1272D] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4 mb-6">
              ❌ {errorMsg}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C1272D]"></div>
              <p className="mt-2 text-gray-600">Loading employees...</p>
            </div>
          )}

          {/* Employee Count */}
          {!loading && (
            <div className="mb-4 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredEmployees.length}</span> employee{filteredEmployees.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* Employee Cards */}
          {!loading && filteredEmployees.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-lg">No employees found</p>
              <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          )}

          {!loading && filteredEmployees.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => (
                <div
                  key={`${emp.location}-${emp.id}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{emp.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{emp.designation || 'N/A'}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getLocationColor(emp.location)}`}>
                      {emp.location}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Gross Salary:</span>
                      <span className="font-semibold text-gray-900">₹{emp.gross_salary?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Advances:</span>
                      <span className="font-semibold text-orange-600">₹{emp.advances?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Nemployeeslist;
