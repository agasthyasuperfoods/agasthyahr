import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  UploadCloud, 
  Printer,     
  Edit,        
  X,
  CheckCircle,
  Save 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2'; 

// --- HELPERS ---
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || amount === '') return '₹0';
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',    
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatCurrencyForPDF = (amount) => {
  if (amount === undefined || amount === null || amount === '') return '0';
  const num = Number(amount);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const getColumnTotal = (employees, key) => {
  if (!employees) return 0;
  return employees.reduce((acc, emp) => acc + (Number(emp[key]) || 0), 0);
};

const formatDateToYearMonth = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

const recalculateEmployee = (emp, daysInMonth) => {
  const safeNum = (val) => {
    if (val === '' || val === null || val === undefined) return 0;
    return Number(val);
  };

  // 1. Leaves CF
  let rawLeaves = emp.Leaves_cf;
  if (rawLeaves === undefined) {
     const empKeys = Object.keys(emp);
     const leavesKey = empKeys.find(key => 
       key.toLowerCase() === 'leaves_cf' || 
       key.toLowerCase() === 'cf_leaves' ||
       key.toLowerCase() === 'leavescf'
     );
     if (leavesKey) rawLeaves = emp[leavesKey];
  }
  const carryForwardLeaves = safeNum(rawLeaves);
  const totalAllowedLeave = carryForwardLeaves;

  // 2. Gross Salary
  const grossInput = emp.grossSalary !== undefined ? emp.grossSalary : emp.gross_salary;
  const grossSalary = safeNum(grossInput);
 
  // 3. Total Days
  let rawReq = emp.requiredDays;
  if (rawReq === undefined) rawReq = emp.required_days || emp.actual_working_days; 
  const requiredDays = safeNum(rawReq) || daysInMonth || 30; 
  
  // 4. Absent
  let rawAbsent = emp.absent;
  if (rawAbsent === undefined) rawAbsent = emp.leaves_taken;
  const absentDays = safeNum(rawAbsent);
  
  // 5. Calculations
  const dailyRate = requiredDays > 0 ? grossSalary / requiredDays : 0;
  const lopDaysCount = Math.max(0, absentDays - totalAllowedLeave); 
  const lossOfPay = Math.round(lopDaysCount * dailyRate);

  const pf = grossSalary < 15000 ? grossSalary * 0.12 : 1800;
  
  let pt = 0;
  if (grossSalary > 20000) pt = 200;
  else if (grossSalary > 15000) pt = 150;

  // Other Expenses
  let rawOther = emp.otherExpenses;
  if (rawOther === undefined) rawOther = emp.other_expenses;
  const otherExpenses = safeNum(rawOther);

  const netSalary = Math.round(grossSalary - lossOfPay - pf - pt - otherExpenses);
  const workingDays = requiredDays - absentDays;

  return { 
    ...emp, 
    grossSalary: grossInput,
    requiredDays: rawReq,
    absent: rawAbsent,
    otherExpenses: rawOther,
    Leaves_cf: rawLeaves,
    lossOfPay,
    lopDaysCount, 
    pf,           
    pt,           
    netSalary, 
    workingDays,
  };
};

const calculateSalary = (employees, daysInMonth) => {
  if (!employees) return [];
  return employees.map(emp => recalculateEmployee(emp, daysInMonth));
};

// --- 3. NEW "LIGHT GLASS" ANIMATION ---
const SubmitOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-md transition-all duration-500">
    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
      
      {/* Pulsing Ripple Effect */}
      <div className="relative flex items-center justify-center h-24 w-24 mb-6">
         {/* Outer expanding ring */}
         <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-20 animate-ping"></span>
         
         {/* Middle static ring */}
         <div className="relative inline-flex rounded-full h-20 w-20 bg-white items-center justify-center border-4 border-green-100 shadow-lg">
            {/* Spinning Arc */}
            <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
            
            {/* Center Brand Dot */}
            <div className="h-6 w-6 bg-red-600 rounded-full shadow-md animate-pulse"></div>
         </div>
      </div>

      <h3 className="text-2xl font-bold text-gray-800 tracking-tight">Saving Changes</h3>
      <p className="text-gray-500 text-sm mt-2 font-medium animate-pulse">Syncing securely with database...</p>
    </div>
  </div>
);

// --- 4. TABLE COMPONENT ---
const PaysheetTable = ({ title, employees, onEmployeeChange, isEditMode }) => {
  const totalGross = getColumnTotal(employees, 'grossSalary');
  const totalLossOfPay = getColumnTotal(employees, 'lossOfPay');
  const totalPF = getColumnTotal(employees, 'pf');
  const totalPT = getColumnTotal(employees, 'pt');
  const totalOther = getColumnTotal(employees, 'otherExpenses');
  const totalNet = getColumnTotal(employees, 'netSalary');

  const headers = [
    { name: "ID", width: "w-[5%]", align: "text-left" }, 
    { name: "Name", width: "w-[16%]", align: "text-left" }, 
    { name: "Desg", width: "w-[9%]", align: "text-left" }, 
    { name: "Leaves CF", width: "w-[6%]", align: "text-center" }, 
    { name: "Total Days", width: "w-[6%]", align: "text-center" }, 
    { name: "Present", width: "w-[6%]", align: "text-center" },   
    { name: "Absent", width: "w-[6%]", align: "text-center" },    
    { name: "Gross", width: "w-[9%]", align: "text-right" }, 
    { name: "LoP", width: "w-[7%]", align: "text-right" }, 
    { name: "PF", width: "w-[6%]", align: "text-right" },      
    { name: "PT", width: "w-[5%]", align: "text-right" },      
    { name: "Other", width: "w-[7%]", align: "text-right" },   
    { name: "Net Salary", width: "w-[12%]", align: "text-right" }  
  ];

  const handleInputChange = (index, field, value) => {
    onEmployeeChange(index, field, value);
  };

  const cellBase = "px-2 py-2 border border-gray-300 text-sm whitespace-nowrap overflow-hidden truncate";
  
  const inputBase = "w-full p-1 border border-blue-300 rounded bg-blue-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-center hover:bg-blue-100 transition-colors font-medium text-gray-700";
  const inputRight = "w-full p-1 border border-blue-300 rounded bg-blue-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-right hover:bg-blue-100 transition-colors font-medium text-gray-700";

  return (
    <div className="bg-white rounded shadow-lg border border-gray-300 overflow-x-auto">
      <div className="px-4 py-3 bg-green-700 text-white border-b border-green-800">
        <h2 className="text-lg font-bold uppercase tracking-wide">{title}</h2>
      </div>
      
      <table className="min-w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((header, idx) => (
              <th key={idx} className={`px-1 py-3 border border-gray-300 text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap ${header.width} ${header.align}`}>
                {header.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {employees && employees.length > 0 ? (
            employees.map((emp, index) => (
              <tr key={emp.employeeid || index} className="hover:bg-gray-50">
                {/* Read-Only Columns */}
                <td className={`${cellBase} text-left font-bold text-gray-700`}>{emp.employeeid}</td>
                <td className={`${cellBase} text-left font-medium text-gray-900`} title={emp.name}>{emp.name}</td>
                <td className={`${cellBase} text-left text-gray-600 text-xs`} title={emp.designation}>{emp.designation}</td>
                
                {/* Editable Columns */}
                <td className={`${cellBase} text-center`}>
                  {isEditMode ? (
                    <input 
                      type="number"
                      min="0" 
                      value={emp.Leaves_cf !== undefined ? emp.Leaves_cf : ''} 
                      onChange={(e) => handleInputChange(index, 'Leaves_cf', e.target.value)} 
                      className={inputBase}
                    />
                  ) : (Number(emp.Leaves_cf) || 0)}
                </td>

                <td className={`${cellBase} text-center`}>
                  {isEditMode ? (
                    <input 
                      type="number"
                      min="0"
                      value={emp.requiredDays !== undefined ? emp.requiredDays : ''} 
                      onChange={(e) => handleInputChange(index, 'requiredDays', e.target.value)} 
                      className={inputBase}
                    />
                  ) : (Number(emp.requiredDays) || 0)}
                </td>

                <td className={`${cellBase} text-center font-medium`}>{emp.workingDays}</td>
                
                <td className={`${cellBase} text-center text-red-600`}>
                  {isEditMode ? (
                    <input 
                      type="number"
                      min="0"
                      value={emp.absent !== undefined ? emp.absent : ''} 
                      onChange={(e) => handleInputChange(index, 'absent', e.target.value)} 
                      className={inputBase}
                    />
                  ) : (Number(emp.absent) || 0)}
                </td>
                
                <td className={`${cellBase} text-right`}>
                   {isEditMode ? (
                     <input 
                       type="number"
                       min="0"
                       value={emp.grossSalary !== undefined ? emp.grossSalary : ''} 
                       onChange={(e) => handleInputChange(index, 'grossSalary', e.target.value)} 
                       className={inputRight}
                     />
                   ) : formatCurrency(emp.grossSalary)}
                </td>
                
                <td className={`${cellBase} text-right text-red-600`}>{formatCurrency(emp.lossOfPay)}</td>
                <td className={`${cellBase} text-right text-gray-600`}>{formatCurrency(emp.pf)}</td>
                <td className={`${cellBase} text-right text-gray-600`}>{formatCurrency(emp.pt)}</td>

                <td className={`${cellBase} text-right`}>
                   {isEditMode ? (
                     <input 
                       type="number"
                       value={emp.otherExpenses !== undefined ? emp.otherExpenses : ''} 
                       onChange={(e) => handleInputChange(index, 'otherExpenses', e.target.value)} 
                       className={inputRight}
                     />
                   ) : formatCurrency(emp.otherExpenses)}
                </td>
                
                <td className={`${cellBase} text-right font-bold text-green-700 bg-green-50`}>{formatCurrency(emp.netSalary)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-6 py-10 text-center text-gray-500 border border-gray-300">
                No employee data found for this month.
              </td>
            </tr>
          )}
          
          {/* Footer */}
          {employees && employees.length > 0 && (
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
              <td colSpan={7} className="px-2 py-3 border border-gray-300 text-center text-gray-800 uppercase text-xs">Total Values</td>
              <td className="px-2 py-3 border border-gray-300 text-right text-xs">{formatCurrency(totalGross)}</td>
              <td className="px-2 py-3 border border-gray-300 text-right text-red-700 text-xs">{formatCurrency(totalLossOfPay)}</td>
              <td className="px-2 py-3 border border-gray-300 text-right text-gray-600 text-xs">{formatCurrency(totalPF)}</td>
              <td className="px-2 py-3 border border-gray-300 text-right text-gray-600 text-xs">{formatCurrency(totalPT)}</td>
              <td className="px-2 py-3 border border-gray-300 text-right text-gray-600 text-xs">{formatCurrency(totalOther)}</td>
              <td className="px-2 py-3 border border-gray-300 text-right text-green-800 text-sm">{formatCurrency(totalNet)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- 5. MAIN COMPONENT ---
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-600 border-solid"></div>
    <span className="ml-4 text-lg font-medium text-gray-700">Loading Paysheets...</span>
  </div>
);

export default function PaysheetPage() { 
  const [selectedDate, setSelectedDate] = useState(new Date('2025-10-01T00:00:00'));
  const [originalEmployees, setOriginalEmployees] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [title, setTitle] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = (date) => {
    setIsLoading(true);
    setError(null);
    const monthYear = formatDateToYearMonth(date);
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    const apiUrl = `/api/finance/Accpayshe?month=${monthYear}&_t=${new Date().getTime()}`;
    
    fetch(apiUrl, { headers: { 'Cache-Control': 'no-store' } })
      .then(res => {
        if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.details || data.error);
        const processedEmployees = calculateSalary(JSON.parse(JSON.stringify(data.employees || [])), daysInMonth);
        setOriginalEmployees(JSON.parse(JSON.stringify(processedEmployees)));
        setEmployees(processedEmployees);
        setTitle(data.title || `Main Employee Pay Sheet - ${monthYear}`);
      })
      .catch(err => {
        console.error("Failed to fetch paysheet data:", err);
        setError(err.message);
        setOriginalEmployees([]);
        setEmployees([]);
        setTitle(`Error loading data`);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setIsEditMode(false);
    fetchData(selectedDate);
  }, [selectedDate]);

  const changeMonth = (direction) => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate.getFullYear(), prevDate.getMonth() + direction, 1);
      return newDate;
    });
  };

  const handleEmployeeChange = (index, field, value) => {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    
    setEmployees(prevEmployees => {
      const newEmployees = [...prevEmployees];
      const emp = { ...newEmployees[index] };
      
      emp[field] = value; 
      
      const recalculated = recalculateEmployee(emp, daysInMonth);
      newEmployees[index] = recalculated;
      
      return newEmployees;
    });
  };

  const handleCheckData = () => {
    let issues = [];
    let count = 0;
    
    employees.forEach(emp => {
      if (emp.netSalary < 0) {
        issues.push(`ID ${emp.employeeid}: Negative Net Salary`);
        count++;
      }
      if (emp.absent > 31) {
        issues.push(`ID ${emp.employeeid}: Absent days > 31`);
        count++;
      }
    });

    if (count > 0) {
      Swal.fire({
        title: 'Validation Issues Found',
        html: `<div style="text-align: left; max-height: 200px; overflow-y: auto;">${issues.join('<br>')}</div>`,
        icon: 'warning',
        confirmButtonText: 'I will fix them'
      });
    } else {
      Swal.fire({
        title: 'All Good!',
        text: 'Data looks valid. You can proceed to submit.',
        icon: 'success',
        confirmButtonColor: '#16a34a', 
        confirmButtonText: 'Great'
      });
    }
  };
  const handleSaveLocal = () => {
    setIsEditMode(false);
    Swal.fire({
      title: 'View Saved',
      text: 'Changes are now visible in the table. Click "Submit" to save to database.',
      icon: 'info',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleSubmitChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    const monthYear = formatDateToYearMonth(selectedDate);
    
    const dataToSubmit = {
      month: monthYear,
      employees: employees.map((emp, index) => {
        const original = originalEmployees[index] || {};
        
        let cleanDoj = emp.doj || original.doj;
        if (cleanDoj === '-' || cleanDoj === '') {
           cleanDoj = null;
        }

        return {
          ...original,
          id: emp.id || original.id, 
          month: monthYear,
          employeeid: emp.employeeid,
          name: emp.name,
          designation: emp.designation,
          
          doj: cleanDoj,
          
          gross_salary: Number(emp.grossSalary) || 0,
          actual_working_days: Number(emp.requiredDays) || 30,
          leaves_taken: Number(emp.absent) || 0,
          leaves_cf: Number(emp.Leaves_cf) || 0, 
          lop_days: Number(emp.lopDaysCount) || 0,
          working_days: Number(emp.workingDays) || 0,
          
          current_month_eligibility: Number(emp.current_month_eligibility || 0),
          late_adj_days: Number(emp.late_adj_days || 0),

          net_pay: Number(emp.netSalary) || 0,
          pf: Number(emp.pf) || 0,
          pt: Number(emp.pt) || 0,
          other_expenses: String(emp.otherExpenses || 0),
        };
      }),
    };
    try {
      const response = await fetch('/api/finance/UpdateAccPays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      const responseJson = await response.json();
      if (!response.ok) throw new Error(responseJson.message || 'Failed to submit changes.');
      
      Swal.fire({ 
        icon: 'success', 
        title: 'Saved Successfully', 
        text: 'Paysheet data has been updated.', 
        timer: 1500, 
        showConfirmButton: false,
        confirmButtonColor: '#16a34a' 
      });
      
      setTimeout(() => { fetchData(selectedDate); }, 500);

    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message);
      Swal.fire({ icon: 'error', title: 'Error', text: `Error saving changes: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelChanges = () => {
    setEmployees(JSON.parse(JSON.stringify(originalEmployees)));
    setIsEditMode(false);
    setError(null);
  };

  const handleDownloadExcel = () => {
    const dataForSheet = employees.map(emp => ({
      "Employee ID": emp.employeeid, "Name": emp.name, "Designation": emp.designation,
      "Leaves CF": emp.Leaves_cf || 0, "Total Days": emp.requiredDays, "Present": emp.workingDays,
      "Absent": emp.absent, "Gross Salary": emp.grossSalary, "Loss of Pay": emp.lossOfPay,
      "PF": emp.pf, "PT": emp.pt, "Other Exp": emp.otherExpenses, "Net Salary": emp.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(dataForSheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paysheet");
    XLSX.writeFile(wb, `Paysheet_${formatDateToYearMonth(selectedDate)}.xlsx`);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); 
    doc.text(title, 14, 20);
    const tableHeaders = ["ID","Name", "Desg.", "Leaves CF", "Total Days", "Present", "Absent", "Gross", "LoP", "PF", "PT", "Other", "Net Salary"];
    const tableBody = employees.map(emp => [
      emp.employeeid, emp.name, emp.designation, emp.Leaves_cf || 0, emp.requiredDays,
      emp.workingDays, emp.absent, formatCurrencyForPDF(emp.grossSalary), formatCurrencyForPDF(emp.lossOfPay),
      formatCurrencyForPDF(emp.pf), formatCurrencyForPDF(emp.pt), formatCurrencyForPDF(emp.otherExpenses), formatCurrencyForPDF(emp.netSalary),
    ]);
    autoTable(doc, { startY: 25, head: [tableHeaders], body: tableBody, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 } });
    doc.save(`Paysheet_${formatDateToYearMonth(selectedDate)}.pdf`);
  };

  const displayMonth = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen relative">
      {/* NEW LIGHT GLASS ANIMATION */}
      {isSubmitting && <SubmitOverlay />}

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center border border-gray-300 rounded-md bg-white shadow-sm">
          <button onClick={() => changeMonth(-1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-l-md"><ChevronLeft className="h-5 w-5" /></button>
          <div className="px-4 py-2 text-sm font-bold text-gray-800 border-l border-r border-gray-200 w-40 text-center">{displayMonth}</div>
          <button onClick={() => changeMonth(1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-r-md"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEditMode ? (
            <>
              <button onClick={handleSaveLocal} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 text-sm font-medium">
                <Save className="h-4 w-4 mr-2" /> Save View
              </button>
              <button onClick={handleCancelChanges} disabled={isSubmitting} className="flex items-center bg-gray-500 text-white px-4 py-2 rounded shadow hover:bg-gray-600 text-sm font-medium">
                <X className="h-4 w-4 mr-2" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCheckData} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm font-medium">
                <CheckCircle className="h-4 w-4 mr-2" /> Check
              </button>
              <button onClick={handleSubmitChanges} disabled={isSubmitting} className="flex items-center bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 text-sm font-medium">
                <UploadCloud className="h-4 w-4 mr-2" /> Submit
              </button>
              <div className="h-6 w-px bg-gray-300 mx-2"></div>
              <button onClick={() => setIsEditMode(true)} className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 text-sm font-medium"><Edit className="h-4 w-4 mr-2" /> Edit</button>
              <button onClick={handleDownloadExcel} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm font-medium"><Download className="h-4 w-4 mr-2" /> Excel</button>
              <button onClick={handleDownloadPDF} className="flex items-center bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 text-sm font-medium"><Printer className="h-4 w-4 mr-2" /> PDF</button>
            </>
          )}
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm">{error}</div>}
      {isLoading ? <LoadingSpinner /> : <PaysheetTable title={title} employees={employees} onEmployeeChange={handleEmployeeChange} isEditMode={isEditMode} />}
    </div>
  );
}