import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Download, 
  FileText, 
  Receipt, 
  Briefcase, 
  User, 
  BarChart2 
} from 'lucide-react';

// --- Helper Functions ---

/**
 * Formats a number as Indian Rupees (INR).
 */
const formatCurrency = (amount) => {
  // Check if amount is a valid number before formatting
  if (typeof amount !== 'number' || isNaN(amount)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Gets the total of a specific column.
 */
const getColumnTotal = (employees, key) => {
  if (!employees) return 0;
  return employees.reduce((acc, emp) => acc + (emp[key] || 0), 0);
};

const formatDateToYearMonth = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Calculates LOP and Net Salary based on the 2-day leave policy.
 * THIS RUNS IN THE BROWSER.
 */
const calculateSalary = (employees) => {
  if (!employees) return [];
  
  const allowedLeave = 2; // 2 days allowed leave

  return employees.map(emp => {
    // Ensure data from DB is treated as a number
    const grossSalary = parseFloat(emp.gross_salary) || 0;
    const requiredDays = parseInt(emp.requiredDays, 10) || 30;
    const absentDays = parseInt(emp.absent, 10) || 0;

    // Handle division by zero if requiredDays is 0
    const dailyRate = requiredDays > 0 ? grossSalary / requiredDays : 0;
    
    // Calculate LOP only for days absent *after* the allowed leave
    const lopDays = Math.max(0, absentDays - allowedLeave);
    const lossOfPay = Math.round(lopDays * dailyRate);
    const netSalary = Math.round(grossSalary - lossOfPay);
    
    // Calculate working days
    const workingDays = requiredDays - absentDays;

    return {
      ...emp,
      grossSalary: grossSalary, // Ensure it's a number
      lossOfPay,
      netSalary,
      workingDays,
    };
  });
};


// --- Sub-components ---

/**
 * Renders the single paysheet table.
 */
const PaysheetTable = ({ title, employees }) => {
  const totalGross = getColumnTotal(employees, 'grossSalary');
  const totalLossOfPay = getColumnTotal(employees, 'lossOfPay');
  const totalNet = getColumnTotal(employees, 'netSalary');

  const headers = [
    { name: "Name", width: "w-3/12" }, // 25% width
    { name: "Designation", width: "w-2/12" }, // ~17% width
    { name: "Required Days/Visits", width: "w-auto" },
    { name: "Working Days/Visits", width: "w-auto" },
    { name: "Absent/Missed", width: "w-auto" },
    { name: "Gross Salary", width: "w-auto" },
    { name: "Loss of Pay", width: "w-auto" },
    { name: "Net Salary", width: "w-auto" }
  ];

  return (
    <div className="mb-10 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* Table Title - Green Header - Padding from previous step */}
      <div className="px-8 py-4 bg-green-600 text-white">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map(header => (
                <th
                  key={header.name}
                  scope="col"
                  // FIXED: Set column widths in the header
                  className={`px-8 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${header.width}`}
                >
                  {header.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees && employees.length > 0 ? (
              employees.map((emp) => (
                <tr key={emp.name || emp.id} className="hover:bg-gray-50">
                  
                  {/* FIXED: Removed 'whitespace-nowrap' from Name to allow wrapping */}
                  <td className="px-8 py-3 text-sm font-medium text-gray-900">{emp.name}</td>
                  
                  {/* FIXED: Removed 'whitespace-nowrap' from Designation to allow wrapping */}
                  <td className="px-8 py-3 text-sm text-gray-700">{emp.designation}</td>
                  
                  {/* Other columns are fine with whitespace-nowrap */}
                  <td className="px-8 py-3 whitespace-nowrap text-sm text-gray-700">{emp.requiredDays}</td>
                  <td className="px-8 py-3 whitespace-nowrap text-sm text-gray-700">{emp.workingDays}</td>
                  <td className="px-8 py-3 whitespace-nowrap text-sm text-gray-700">{emp.absent}</td>
                  <td className="px-8 py-3 whitespace-nowrap text-sm text-gray-700">{formatCurrency(emp.grossSalary)}</td>
                  <td className="px-8 py-3 whitespace-nowrap text-sm text-red-600">{formatCurrency(emp.lossOfPay)}</td>
                  <td className="px-8 py-3 whitespace-nowrap text-sm font-bold text-green-700">{formatCurrency(emp.netSalary)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-8 py-12 text-center text-gray-500">
                  No employee data found for this month.
                </td>
              </tr>
            )}
            
            {/* Total Row */}
            {employees && employees.length > 0 && (
              <tr className="bg-white border-t-2 border-gray-300">
                <td colSpan={5} className="px-8 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-800">
                  Total
                </td>
                <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                  {formatCurrency(totalGross)}
                </td>
                <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-red-700">
                  {formatCurrency(totalLossOfPay)}
                </td>
                <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-green-800">
                  {formatCurrency(totalNet)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * A simple loading spinner.
 */
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-600"></div>
    <span className="ml-4 text-gray-700">Loading Data...</span>
  </div>
);


// --- Main App Component ---

/**
 * The main application component that renders the Paysheets page.
 * This is the component you import into 'Accountsmodule.js'
 */
export default function PaysheetPage() { 
  // Default to October 2025 as seen in your video
  const [selectedDate, setSelectedDate] = useState(new Date('2025-10-01T00:00:00'));
  
  // State for data
  const [paysheetData, setPaysheetData] = useState({ title: '', employees: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Effect: Fetch Data when Date changes ---
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const monthYear = formatDateToYearMonth(selectedDate);
    
    // THIS IS THE API ROUTE WE ARE CALLING
    // It matches the file 'pages/api/finance/Accpayshe.js'
    const apiUrl = `/api/finance/Accpayshe?month=${monthYear}`;
    console.log(`Fetching data from: ${apiUrl}`);

    fetch(apiUrl)
      .then(res => {
        if (!res.ok) {
          // Handle HTTP errors
          throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.error) {
          // Handle errors from the API logic
          throw new Error(data.details || data.error);
        }
        
        console.log("Raw data received from API:", data.employees);
        
        // Process the raw data: apply 2-day leave rule and calculate LOP/Net
        const processedEmployees = calculateSalary(data.employees || []);
        
        console.log("Processed data:", processedEmployees);

        setPaysheetData({
          title: data.title || `Main Employee Pay Sheet - ${monthYear}`,
          employees: processedEmployees,
        });
      })
      .catch(err => {
        console.error("Failed to fetch or process paysheet data:", err);
        setError(err.message);
        setPaysheetData({ title: `Error loading data`, employees: [] });
      })
      .finally(() => {
        setIsLoading(false);
      });

  }, [selectedDate]); // Re-run effect when date changes

  // --- Event Handlers ---

  const changeMonth = (direction) => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate.getFullYear(), prevDate.getMonth() + direction, 1);
      return newDate;
    });
  };

  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split('-');
    setSelectedDate(new Date(parseInt(year), parseInt(month) - 1, 1));
  };
  
  const formattedMonth = formatDateToYearMonth(selectedDate);
  const displayMonth = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    // This div is full-width, as fixed before
    <div className="p-4 md:p-8">
        
      {/* Top Control Bar */}
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mb-8 flex flex-wrap justify-between items-center gap-4">
        
        {/* Month Selector */}
        <div className="flex items-center border border-gray-300 rounded-md">
          <label htmlFor="month-select" className="pl-3 text-sm font-medium text-gray-700">
            Select Month
          </label>
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-l-md"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <span className="px-3 py-2 text-sm font-medium text-gray-800 bg-gray-50">
            {displayMonth}
          </span>
          {/* Hidden input for native picker fallback */}
            <input 
              type="month" 
              id="month-select"
              value={formattedMonth} 
              onChange={handleMonthChange}
              className="opacity-0 w-0 h-0 absolute"
            />

          <button
            onClick={() => changeMonth(1)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-r-md"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 transition-colors">
            <Calendar className="h-5 w-5 mr-2" />
            Current
          </button>
          <button className="flex items-center bg-green-700 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-800 transition-colors">
            <Download className="h-5 w-5 mr-2" />
            Download Excel
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6" role="alert">
          <span className="font-bold">Error:</span>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}
      
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <PaysheetTable 
          title={paysheetData.title}
          employees={paysheetData.employees} 
        />
      )}
    </div>
  );
}
//