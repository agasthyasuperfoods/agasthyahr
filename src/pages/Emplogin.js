import Image from 'next/image';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { useRouter } from 'next/router';

export default function Emplogin() {
  const [employeeId, setEmployeeId] = useState('');
  const [dojInput, setDojInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Converts yymmdd to YYYY-MM-DD 00:00:00 for DB check
  function formatDOJ(yymmdd) {
    if (!/^\d{6}$/.test(yymmdd)) return null;
    const year = '20' + yymmdd.slice(0, 2);
    const month = yymmdd.slice(2, 4);
    const day = yymmdd.slice(4, 6);
    return `${year}-${month}-${day} 00:00:00`;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const formattedDOJ = formatDOJ(dojInput);

    if (!formattedDOJ) {
      Swal.fire('Invalid DOJ format!', 'Please enter as yymmdd (e.g. 250804)', 'error');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/employees/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, doj: formattedDOJ }),
      });
      const data = await response.json();

      if (data.success) {
        // Save login info to localStorage
        localStorage.setItem("employeeId", employeeId);
        if (data.employeeName) localStorage.setItem("employeeName", data.employeeName);
        if (data.employeeEmail) localStorage.setItem("employeeEmail", data.employeeEmail);
        // Add more fields as needed.
        router.push('/Loginstime');
      } else {
        Swal.fire({
          title: 'Login Failed',
          text: data.message || 'ID or DOJ mismatch.',
          icon: 'error',
          confirmButtonColor: '#d33',
        });
      }
    } catch {
      Swal.fire({
        title: 'Error',
        text: 'Unexpected error. Please try again.',
        icon: 'error',
        confirmButtonColor: '#d33',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 sm:p-12 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/agasthyalogo.png" alt="Agasthya Logo" width={170} height={60} priority />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-800">Employee Login</h1>
        <p className="text-sm text-gray-500 text-center mt-2 mb-8">
          Login using your Employee ID and Date of Joining
        </p>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              placeholder="e.g. EMP168"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="dojInput" className="block text-sm font-medium text-gray-700 mb-1">
              Date of Joining <span className="text-xs text-gray-400">(yymmdd)</span>
            </label>
            <input
              type="text"
              id="dojInput"
              placeholder="e.g. 250804"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={dojInput}
              onChange={(e) => setDojInput(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-red-700 hover:bg-red-800 text-white font-medium rounded-lg shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
      <footer className="absolute bottom-6 text-center text-xs text-gray-400">
        © 2025 Agasthya Head Office. All rights reserved.
      </footer>
    </div>
  );
}
