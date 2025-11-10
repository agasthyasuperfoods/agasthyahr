import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

const EyeIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeSlashIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.99 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.75 3.75M21 21L17.772 17.772m0 0L14.025 14.025m3.747 3.747l-3.75-3.75m-3.75 3.75l-3.75-3.75" />
  </svg>
);

export default function LoginPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/finance/Acc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, passcode }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/Accountsmodule');
      } else {
        Swal.fire({
          title: 'Login Failed',
          text: data.message || 'Invalid credentials. Please try again.',
          icon: 'error',
          confirmButtonColor: '#d33',
        });
      }
    } catch {
      Swal.fire({
        title: 'Error',
        text: 'An unexpected error occurred. Please try again later.',
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

        <h1 className="text-2xl font-bold text-center text-gray-800">Head Office Accounts Login</h1>
        <p className="text-sm text-gray-500 text-center mt-2 mb-8">Access your Head Office accounts and operations</p>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              placeholder="e.g. EMP145"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="passcode" className="block text-sm font-medium text-gray-700 mb-1">
              Passcode
            </label>
            <div className="relative">
              <input
                type={passwordVisible ? 'text' : 'password'}
                id="passcode"
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                className="absolute inset-y-0 right-0 flex items-center justify-center h-full w-10 text-gray-400 hover:text-gray-600"
              >
                {passwordVisible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
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
