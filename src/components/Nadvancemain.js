import React, { useState, useEffect } from 'react';
import Head from 'next/head';

function Nadvancemain() {
  const [selectedLocation, setSelectedLocation] = useState('tandur');
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch employees when location changes
  useEffect(() => {
    fetchEmployees(selectedLocation);
  }, [selectedLocation]);

  // Filter employees based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredEmployees(filtered);
    }
  }, [searchQuery, employees]);

  const fetchEmployees = async (location) => {
    setLoadingEmployees(true);
    try {
      const res = await fetch(`/api/employees/list?location=${location}`);
      if (!res.ok) throw new Error('Failed to load employees');
      const data = await res.json();
      setEmployees(data.employees || []);
      setFilteredEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
      setFilteredEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleLocationChange = (location) => {
    setSelectedLocation(location);
    setSelectedEmployee(null);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleEmployeeSelect = (emp) => {
    setSelectedEmployee(emp);
    setSearchQuery(emp.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedEmployee || !amount || !date) {
      setErrorMsg('Please fill all required fields');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/expenses/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedLocation,
          employeeId: selectedEmployee.id,
          type: 'advance',
          amount: Number(amount),
          date,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add advance');
      }

      setSuccessMsg(`Advance of ₹${amount} added successfully to ${data.employeeName}!`);
      
      // Reset form
      setAmount('');
      setSelectedEmployee(null);
      setSearchQuery('');
    } catch (error) {
      setErrorMsg(error.message || 'Failed to add advance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Manage Advances • Accounts</title>
        <meta name="description" content="Add salary advances for employees" />
      </Head>

      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Manage Employee Advances</h1>
            <p className="text-gray-600">Add salary advances for employees across all locations</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Location Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Select Location
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleLocationChange('tandur')}
                    className={`p-4 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'tandur'
                        ? 'border-[#C1272D] bg-[#C1272D] text-white'
                        : 'border-gray-300 hover:border-[#C1272D] text-gray-700'
                    }`}
                  >
                    Tandur Farm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationChange('talakondapally')}
                    className={`p-4 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'talakondapally'
                        ? 'border-[#1e40af] bg-[#1e40af] text-white'
                        : 'border-gray-300 hover:border-[#1e40af] text-gray-700'
                    }`}
                  >
                    Talakondapally Farm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationChange('operations')}
                    className={`p-4 rounded-lg border-2 font-medium transition-all outline-none ${
                      selectedLocation === 'operations'
                        ? 'border-[#16a34a] bg-[#16a34a] text-white'
                        : 'border-gray-300 hover:border-[#16a34a] text-gray-700'
                    }`}
                  >
                    Delivery Boys
                  </button>
                </div>
              </div>

              {/* Employee Search */}
              <div className="relative">
                <label htmlFor="employee" className="block text-sm font-semibold text-gray-900 mb-2">
                  Search Employee <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="employee"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type to search employee name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-[#C1272D] transition-colors"
                  required
                />

                {/* Dropdown */}
                {showDropdown && filteredEmployees.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingEmployees ? (
                      <div className="p-4 text-center text-gray-500">Loading employees...</div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleEmployeeSelect(emp)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 outline-none"
                        >
                          <div className="font-medium text-gray-900">{emp.name}</div>
                          <div className="text-sm text-gray-500">{emp.designation}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {showDropdown && filteredEmployees.length === 0 && searchQuery && !loadingEmployees && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    No employees found
                  </div>
                )}
              </div>

              {/* Selected Employee Display */}
              {selectedEmployee && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedEmployee.name}</p>
                      <p className="text-sm text-gray-600">{selectedEmployee.designation}</p>
                      <p className="text-sm text-gray-600">Gross Salary: ₹{selectedEmployee.gross_salary?.toLocaleString() || 'N/A'}</p>
                      <p className="text-sm text-gray-600">Current Advances: ₹{selectedEmployee.advances?.toLocaleString() || '0'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployee(null);
                        setSearchQuery('');
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-medium outline-none"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-gray-900 mb-2">
                  Advance Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter advance amount"
                  min="1"
                  step="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-[#C1272D] transition-colors"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-semibold text-gray-900 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-[#C1272D] transition-colors"
                  required
                />
              </div>

              {/* Success/Error Messages */}
              {successMsg && (
                <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg p-4">
                  ✅ {successMsg}
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">
                  ❌ {errorMsg}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !selectedEmployee}
                className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : (
                  '💰 Add Advance'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Nadvancemain;
