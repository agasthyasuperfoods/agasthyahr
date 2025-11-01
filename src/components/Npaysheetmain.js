import React, { useState, useEffect } from 'react';
import Head from 'next/head';

function Npaysheetmain() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });
  const [tandurData, setTandurData] = useState([]);
  const [talakondapallyData, setTalakondapallyData] = useState([]);
  const [operationsData, setOperationsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const getMonthDays = (yyyyMM) => {
    const [y, m] = yyyyMM.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const designationOrder = {
    'HOD - Operations': 1,
    'Farm Manager': 2,
    'Live Stock Manager': 3,
    'Cattle Feed Manager': 4,
    'BMC-Supervisor': 5,
    'Supervisor': 6,
    'Jr. Accountant - F&A': 7,
    'Veterinary Assistant': 8,
    'Driver': 9,
    'Milker': 10,
    'Helper': 11,
    'Security': 12,
    'Employee': 99,
  };

  const getDesignationRank = (designation) => {
    const d = String(designation || '').trim();
    return designationOrder[d] !== undefined ? designationOrder[d] : 99;
  };

  const buildRow = (apiRow, yyyyMM) => {
    const daysInMonth = getMonthDays(yyyyMM);
    const workingDays = Number(apiRow.working_days || 0);
    const absentDays = Number(apiRow.absent_days || 0);
    
    const grossSalary = Number(apiRow.gross_salary || 0);
    const advances = Number(apiRow.advances || 0);

    const dailyRate = grossSalary / daysInMonth;
    const unpaidAbsences = Math.max(0, absentDays - 2);
    const lossOfPay = Math.round(unpaidAbsences * dailyRate);
    const netSalary = grossSalary - advances - lossOfPay;

    return {
      employeeId: apiRow.EmployeeId,
      name: apiRow.name || 'Employee',
      designation: apiRow.designation || 'Employee',
      designationRank: getDesignationRank(apiRow.designation),
      totalMonthDays: daysInMonth,
      workingDays: round2(workingDays),
      absentDays: round2(absentDays),
      grossSalary,
      advances,
      lossOfPay,
      netSalary: Math.round(netSalary),
    };
  };

  const fetchMonthly = async (month) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [tandurRes, talRes, opsRes] = await Promise.all([
        fetch(`/api/attendance/tandur?month=${month}`),
        fetch(`/api/attendance/talakondapally?month=${month}`),
        fetch(`/api/attendance/operations?month=${month}`),
      ]);
      
      if (!tandurRes.ok) throw new Error('Failed to load Tandur data');
      if (!talRes.ok) throw new Error('Failed to load Talakondapally data');
      if (!opsRes.ok) throw new Error('Failed to load Operations data');

      const tandurJson = await tandurRes.json();
      const talJson = await talRes.json();
      const opsJson = await opsRes.json();

      const tandurRows = (tandurJson.attendance || [])
        .map((r) => buildRow(r, month))
        .sort((a, b) => a.designationRank - b.designationRank);

      const talRows = (talJson.attendance || [])
        .map((r) => buildRow(r, month))
        .sort((a, b) => a.designationRank - b.designationRank);

      const opsRows = (opsJson.attendance || [])
        .map((r) => buildRow(r, month))
        .sort((a, b) => a.designationRank - b.designationRank);

      setTandurData(tandurRows);
      setTalakondapallyData(talRows);
      setOperationsData(opsRows);
    } catch (e) {
      setErrorMsg(e.message || 'Error fetching monthly pay sheet');
      setTandurData([]);
      setTalakondapallyData([]);
      setOperationsData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonth) fetchMonthly(selectedMonth);
  }, [selectedMonth]);

  const totals = (rows) =>
    rows.reduce(
      (acc, r) => {
        acc.gross += r.grossSalary;
        acc.adv += r.advances;
        acc.lop += r.lossOfPay;
        acc.net += r.netSalary;
        return acc;
      },
      { gross: 0, adv: 0, lop: 0, net: 0 }
    );

  const renderPaySheetTable = (data, locationName, headerColor) => {
    const locationTotals = totals(data);
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className={`${headerColor} text-white rounded-t-lg p-4`}>
          <h2 className="text-xl font-semibold">{locationName} - Pay Sheet for {selectedMonth}</h2>
        </div>

        <div className="p-4 overflow-x-auto">
          {data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No attendance records found for {selectedMonth}</div>
          ) : (
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 font-medium text-left">Name</th>
                  <th className="border border-gray-300 p-3 font-medium text-left">Designation</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Total Days</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Working Days</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Absent Days</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Gross Salary</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Advances</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Loss of Pay</th>
                  <th className="border border-gray-300 p-3 font-medium text-center">Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.employeeId} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3 font-medium">{e.name}</td>
                    <td className="border border-gray-300 p-3">{e.designation}</td>
                    <td className="border border-gray-300 p-3 text-center">{e.totalMonthDays}</td>
                    <td className="border border-gray-300 p-3 text-center">{e.workingDays}</td>
                    <td className="border border-gray-300 p-3 text-center">{e.absentDays}</td>
                    <td className="border border-gray-300 p-3 text-center">₹{e.grossSalary.toLocaleString()}</td>
                    <td className="border border-gray-300 p-3 text-center">₹{e.advances.toLocaleString()}</td>
                    <td className="border border-gray-300 p-3 text-center">₹{e.lossOfPay.toLocaleString()}</td>
                    <td className="border border-gray-300 p-3 text-center font-bold text-green-700">
                      ₹{e.netSalary.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="border border-gray-300 p-3" colSpan={5}>Total</td>
                  <td className="border border-gray-300 p-3 text-center">₹{locationTotals.gross.toLocaleString()}</td>
                  <td className="border border-gray-300 p-3 text-center">₹{locationTotals.adv.toLocaleString()}</td>
                  <td className="border border-gray-300 p-3 text-center">₹{locationTotals.lop.toLocaleString()}</td>
                  <td className="border border-gray-300 p-3 text-center text-green-700">₹{locationTotals.net.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Pay Sheet • Accounts</title>
        <meta name="description" content="Monthly employee salary calculation and pay sheet" />
      </Head>

      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Employee Pay Sheet</h1>
            <p className="text-gray-600">Monthly salary calculation based on attendance for all farms</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Month</h2>
                <p className="text-sm text-gray-600">Choose month for salary calculation</p>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C1272D] focus:border-transparent"
                  max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                />
                <button
                  onClick={() => {
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    setSelectedMonth(`${yyyy}-${mm}`);
                  }}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Current
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 mb-6">{errorMsg}</div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C1272D]"></div>
              <p className="mt-2 text-gray-600">Loading pay sheet data...</p>
            </div>
          )}

          {!loading && (
            <div className="space-y-8">
              {renderPaySheetTable(operationsData, 'Delivery Boys', 'bg-[#16a34a]')}
              {renderPaySheetTable(tandurData, 'Tandur Farm', 'bg-[#C1272D]')}
              {renderPaySheetTable(talakondapallyData, 'Talakondapally Farm', 'bg-[#1e40af]')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Npaysheetmain;
