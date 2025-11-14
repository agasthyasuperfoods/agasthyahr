import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// Import Lucide icons
import { Users, CheckCircle, XCircle, TrendingUp, Download } from 'lucide-react'

function Accountsmain() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  
  const [tandurData, setTandurData] = useState({
    attendance: [],
    totalEmployees: 0,
    loading: false,
    error: null
  })
  
  const [talakondapallyData, setTalakondapallyData] = useState({
    attendance: [],
    totalEmployees: 0,
    loading: false,
    error: null
  })

  const [adminName, setAdminName] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'present', 'absent'

  // Status color coding
  const getStatusColor = (status) => {
    const statusLower = String(status || '').toLowerCase()
    if (statusLower === 'present' || statusLower === 'p') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (statusLower === 'absent' || statusLower === 'a') return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Fetch Tandur data
  const fetchTandurData = async (date) => {
    setTandurData(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/attendance/accountant/tandur?date=${date}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch Tandur data')
      }
      const data = await response.json()
      setTandurData({
        attendance: data.attendance || [],
        totalEmployees: data.totalEmployees || 0,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Tandur fetch error:', error)
      setTandurData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  // Fetch Talakondapally data
  const fetchTalakondapallyData = async (date) => {
    setTalakondapallyData(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/attendance/accountant/talakondapally?date=${date}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch Talakondapally data')
      }
      const data = await response.json()
      setTalakondapallyData({
        attendance: data.attendance || [],
        totalEmployees: data.totalEmployees || 0,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Talakondapally fetch error:', error)
      setTalakondapallyData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  // Fetch data when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchTandurData(selectedDate)
      fetchTalakondapallyData(selectedDate)
    }
  }, [selectedDate])

  // Get admin name from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const name = localStorage.getItem('adminName') || 'Accountant'
      setAdminName(name)
    }
  }, [])

  // Calculate attendance summary
  const calculateSummary = (attendance) => {
    const present = attendance.filter(a => 
      String(a.status || '').toLowerCase() === 'present' || 
      String(a.status || '').toLowerCase() === 'p'
    ).length
    
    const absent = attendance.filter(a => 
      String(a.status || '').toLowerCase() === 'absent' || 
      String(a.status || '').toLowerCase() === 'a'
    ).length

    const notMarked = attendance.filter(a => 
      !a.status || a.status === '' || a.status.toLowerCase() === 'not marked'
    ).length

    return { present, absent, notMarked }
  }

  const tandurSummary = calculateSummary(tandurData.attendance)
  const talakondapallySummary = calculateSummary(talakondapallyData.attendance)

  // Combined totals
  const totalEmployees = tandurData.totalEmployees + talakondapallyData.totalEmployees
  const totalPresent = tandurSummary.present + talakondapallySummary.present
  const totalAbsent = tandurSummary.absent + talakondapallySummary.absent
  const totalMarked = tandurData.attendance.length + talakondapallyData.attendance.length

  // Filtered data based on status filter
  const getFilteredAttendance = (attendance) => {
    if (filterStatus === 'all') return attendance
    return attendance.filter(emp => {
      const status = String(emp.status || '').toLowerCase()
      switch (filterStatus) {
        case 'present': return status === 'present' || status === 'p'
        case 'absent': return status === 'absent' || status === 'a'
        default: return true
      }
    })
  }

  const filteredTandurData = getFilteredAttendance(tandurData.attendance)
  const filteredTalakondapallyData = getFilteredAttendance(talakondapallyData.attendance)

  // Calculate percentages for visual indicators
  const getPercentage = (value, total) => {
    return total > 0 ? (value / total) * 100 : 0
  }

  // Convert image to base64 for PDF
  const getBase64Image = async (imgUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      };
      img.onerror = reject;
      img.src = imgUrl;
    });
  }

  // Separate PDF Export functions for each farm
  const exportTandurPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = await import('jspdf-autotable').then(module => module.default)
      
      const doc = new jsPDF()
      
      // Add logo
      try {
        const logoUrl = '/logo.png'
        const logoBase64 = await getBase64Image(logoUrl)
        
        // Add logo to the header
        doc.addImage(logoBase64, 'PNG', 14, 10, 30, 30)
        
        // Company name and title
        doc.setFontSize(16)
        doc.setTextColor(193, 39, 45) // #C1272D
        doc.text('Agasthya Nutromilk', 50, 20)
        doc.setFontSize(12)
        doc.setTextColor(0, 0, 0)
        doc.text('Tandur Farm - Attendance Report', 50, 28)
        
      } catch (logoError) {
        console.warn('Could not load logo, using text only:', logoError)
        // Fallback: text only header
        doc.setFontSize(20)
        doc.setTextColor(193, 39, 45)
        doc.text('Agasthya Nutromilk', 105, 20, { align: 'center' })
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0)
        doc.text('Tandur Farm - Attendance Report', 105, 30, { align: 'center' })
      }
      
      // Date information
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Date: ${selectedDate}`, 14, 45)
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 50)
      doc.setTextColor(0, 0, 0)
      
      let startY = 60
      
      // Tandur Farm Table
      doc.setFontSize(14)
      doc.setTextColor(193, 39, 45)
      doc.text('ATTENDANCE RECORDS', 14, startY)
      doc.setTextColor(0, 0, 0)
      
      const tandurTableData = tandurData.attendance.map(emp => [
        emp.employeeid,
        emp.name || 'N/A',
        emp.designation || 'N/A',
        emp.employee_number || 'N/A',
        emp.status || 'Not Marked'
      ])
      
      autoTable(doc, {
        head: [['Employee ID', 'Name', 'Designation', 'Phone', 'Status']],
        body: tandurTableData,
        startY: startY + 5,
        headStyles: {
          fillColor: [193, 39, 45],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      })
      
      startY = doc.lastAutoTable.finalY + 10
      
      // Tandur Summary
      doc.setFontSize(12)
      doc.setTextColor(193, 39, 45)
      doc.text('SUMMARY', 14, startY)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Total Employees: ${tandurData.totalEmployees}`, 14, startY + 8)
      doc.text(`Present: ${tandurSummary.present} (${getPercentage(tandurSummary.present, tandurData.totalEmployees).toFixed(1)}%)`, 14, startY + 13)
      doc.text(`Absent: ${tandurSummary.absent} (${getPercentage(tandurSummary.absent, tandurData.totalEmployees).toFixed(1)}%)`, 14, startY + 18)
      doc.text(`Not Marked: ${tandurData.totalEmployees - tandurData.attendance.length} (${getPercentage(tandurData.totalEmployees - tandurData.attendance.length, tandurData.totalEmployees).toFixed(1)}%)`, 14, startY + 23)
      doc.setTextColor(0, 0, 0)
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' })
        doc.text(`Generated by Agasthya HR System`, 105, 290, { align: 'center' })
      }
      
      // Save the PDF
      doc.save(`tandur_attendance_${selectedDate}.pdf`)
      
    } catch (error) {
      console.error('Error generating Tandur PDF:', error)
      alert('Error generating Tandur PDF. Please try again.')
    }
  }

  const exportTalakondapallyPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = await import('jspdf-autotable').then(module => module.default)
      
      const doc = new jsPDF()
      
      // Add logo
      try {
        const logoUrl = '/logo.png'
        const logoBase64 = await getBase64Image(logoUrl)
        
        // Add logo to the header
        doc.addImage(logoBase64, 'PNG', 14, 10, 30, 30)
        
        // Company name and title
        doc.setFontSize(16)
        doc.setTextColor(30, 64, 175) // #1e40af
        doc.text('Agasthya Nutromilk', 50, 20)
        doc.setFontSize(12)
        doc.setTextColor(0, 0, 0)
        doc.text('Talakondapally Farm - Attendance Report', 50, 28)
        
      } catch (logoError) {
        console.warn('Could not load logo, using text only:', logoError)
        // Fallback: text only header
        doc.setFontSize(20)
        doc.setTextColor(30, 64, 175)
        doc.text('Agasthya Nutromilk', 105, 20, { align: 'center' })
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0)
        doc.text('Talakondapally Farm - Attendance Report', 105, 30, { align: 'center' })
      }
      
      // Date information
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Date: ${selectedDate}`, 14, 45)
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 50)
      doc.setTextColor(0, 0, 0)
      
      let startY = 60
      
      // Talakondapally Farm Table
      doc.setFontSize(14)
      doc.setTextColor(30, 64, 175)
      doc.text('ATTENDANCE RECORDS', 14, startY)
      doc.setTextColor(0, 0, 0)
      
      const talakondapallyTableData = talakondapallyData.attendance.map(emp => [
        emp.employeeid,
        emp.employee_name || emp.name || 'N/A',
        emp.designation || 'N/A',
        emp.employee_number || 'N/A',
        emp.status || 'Not Marked'
      ])
      
      autoTable(doc, {
        head: [['Employee ID', 'Name', 'Designation', 'Phone', 'Status']],
        body: talakondapallyTableData,
        startY: startY + 5,
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      })
      
      startY = doc.lastAutoTable.finalY + 10
      
      // Talakondapally Summary
      doc.setFontSize(12)
      doc.setTextColor(30, 64, 175)
      doc.text('SUMMARY', 14, startY)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Total Employees: ${talakondapallyData.totalEmployees}`, 14, startY + 8)
      doc.text(`Present: ${talakondapallySummary.present} (${getPercentage(talakondapallySummary.present, talakondapallyData.totalEmployees).toFixed(1)}%)`, 14, startY + 13)
      doc.text(`Absent: ${talakondapallySummary.absent} (${getPercentage(talakondapallySummary.absent, talakondapallyData.totalEmployees).toFixed(1)}%)`, 14, startY + 18)
      doc.text(`Not Marked: ${talakondapallyData.totalEmployees - talakondapallyData.attendance.length} (${getPercentage(talakondapallyData.totalEmployees - talakondapallyData.attendance.length, talakondapallyData.totalEmployees).toFixed(1)}%)`, 14, startY + 23)
      doc.setTextColor(0, 0, 0)
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' })
        doc.text(`Generated by Agasthya HR System`, 105, 290, { align: 'center' })
      }
      
      // Save the PDF
      doc.save(`talakondapally_attendance_${selectedDate}.pdf`)
      
    } catch (error) {
      console.error('Error generating Talakondapally PDF:', error)
      alert('Error generating Talakondapally PDF. Please try again.')
    }
  }

  const exportAllPDF = async () => {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = await import('jspdf-autotable').then(module => module.default)
    
    const doc = new jsPDF()
    
    // Add logo
    try {
      const logoUrl = '/logo.png'
      const logoBase64 = await getBase64Image(logoUrl)
      
      // Add logo to the header
      doc.addImage(logoBase64, 'PNG', 14, 10, 30, 30)
      
      // Company name and title
      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0)
      doc.text('Agasthya Nutromilk', 50, 20)
      doc.setFontSize(12)
      doc.text('Complete Farm Attendance Report', 50, 28)
      
    } catch (logoError) {
      console.warn('Could not load logo, using text only:', logoError)
      // Fallback: text only header
      doc.setFontSize(20)
      doc.setTextColor(0, 0, 0)
      doc.text('Agasthya Nutromilk', 105, 20, { align: 'center' })
      doc.setFontSize(16)
      doc.text('Complete Farm Attendance Report', 105, 30, { align: 'center' })
    }
    
    // Date information
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Date: ${selectedDate}`, 14, 45)
    doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 50)
    doc.setTextColor(0, 0, 0)
    
    let startY = 60
    
    // Tandur Farm Table
    doc.setFontSize(14)
    doc.setTextColor(193, 39, 45) // #C1272D
    doc.text('TANDUR FARM', 14, startY)
    doc.setTextColor(0, 0, 0)
    
    const tandurTableData = tandurData.attendance.map(emp => [
      emp.employeeid,
      emp.name || 'N/A',
      emp.designation || 'N/A',
      emp.employee_number || 'N/A',
      emp.status || 'Not Marked'
    ])
    
    autoTable(doc, {
      head: [['Employee ID', 'Name', 'Designation', 'Phone', 'Status']],
      body: tandurTableData,
      startY: startY + 5,
      headStyles: {
        fillColor: [193, 39, 45], // #C1272D
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    })
    
    startY = doc.lastAutoTable.finalY + 10
    
    // Tandur Summary - Left aligned
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Tandur Summary:`, 14, startY, { align: 'left' })
    doc.text(`Total Employees: ${tandurData.totalEmployees}`, 14, startY + 5, { align: 'left' })
    doc.text(`Present: ${tandurSummary.present} (${getPercentage(tandurSummary.present, tandurData.totalEmployees).toFixed(1)}%)`, 14, startY + 10, { align: 'left' })
    doc.text(`Absent: ${tandurSummary.absent} (${getPercentage(tandurSummary.absent, tandurData.totalEmployees).toFixed(1)}%)`, 14, startY + 15, { align: 'left' })
    doc.text(`Not Marked: ${tandurData.totalEmployees - tandurData.attendance.length} (${getPercentage(tandurData.totalEmployees - tandurData.attendance.length, tandurData.totalEmployees).toFixed(1)}%)`, 14, startY + 20, { align: 'left' })
    doc.setTextColor(0, 0, 0)
    
    startY += 30
    
    // Add new page if needed for Talakondapally
    if (startY > 200) {
      doc.addPage()
      startY = 20
      
      // Add logo and header to new page
      try {
        const logoUrl = '/logo.png'
        const logoBase64 = await getBase64Image(logoUrl)
        doc.addImage(logoBase64, 'PNG', 14, 10, 30, 30)
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0)
        doc.text('Agasthya Nutromilk', 50, 20)
        doc.setFontSize(12)
        doc.text('Complete Farm Attendance Report - Continued', 50, 28)
      } catch (logoError) {
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        doc.text('Agasthya Nutromilk - Continued', 105, 20, { align: 'center' })
      }
    }
    
    // Talakondapally Farm Table
    doc.setFontSize(14)
    doc.setTextColor(30, 64, 175) // #1e40af
    doc.text('TALAKONDAPALLY FARM', 14, startY)
    doc.setTextColor(0, 0, 0)
    
    const talakondapallyTableData = talakondapallyData.attendance.map(emp => [
      emp.employeeid,
      emp.employee_name || emp.name || 'N/A',
      emp.designation || 'N/A',
      emp.employee_number || 'N/A',
      emp.status || 'Not Marked'
    ])
    
    autoTable(doc, {
      head: [['Employee ID', 'Name', 'Designation', 'Phone', 'Status']],
      body: talakondapallyTableData,
      startY: startY + 5,
      headStyles: {
        fillColor: [30, 64, 175], // #1e40af
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    })
    
    startY = doc.lastAutoTable.finalY + 10
    
    // Talakondapally Summary - Left aligned
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Talakondapally Summary:`, 14, startY, { align: 'left' })
    doc.text(`Total Employees: ${talakondapallyData.totalEmployees}`, 14, startY + 5, { align: 'left' })
    doc.text(`Present: ${talakondapallySummary.present} (${getPercentage(talakondapallySummary.present, talakondapallyData.totalEmployees).toFixed(1)}%)`, 14, startY + 10, { align: 'left' })
    doc.text(`Absent: ${talakondapallySummary.absent} (${getPercentage(talakondapallySummary.absent, talakondapallyData.totalEmployees).toFixed(1)}%)`, 14, startY + 15, { align: 'left' })
    doc.text(`Not Marked: ${talakondapallyData.totalEmployees - talakondapallyData.attendance.length} (${getPercentage(talakondapallyData.totalEmployees - talakondapallyData.attendance.length, talakondapallyData.totalEmployees).toFixed(1)}%)`, 14, startY + 20, { align: 'left' })
    doc.setTextColor(0, 0, 0)
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' })
      doc.text(`Generated by Agasthya HR System`, 105, 290, { align: 'center' })
    }
    
    // Save the PDF
    doc.save(`complete_attendance_report_${selectedDate}.pdf`)
    
  } catch (error) {
    console.error('Error generating Complete PDF:', error)
    alert('Error generating Complete PDF. Please try again.')
  }
}

  return (
    <>
      <Head>
        <title>Farm Attendance • Accounts</title>
        <meta name="description" content="View farm attendance records" />
      </Head>


      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Farm Attendance Dashboard
            </h1>
            <p className="text-gray-600">
              Comprehensive view of daily attendance across all farms
            </p>
          </div>

          {/* Controls Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Select Date
                </h2>
                <p className="text-sm text-gray-600">
                  Choose a date to view attendance records
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-4">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C1272D] focus:border-transparent"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]
                      setSelectedDate(today)
                    }}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Today
                  </button>
                </div>

                {/* PDF Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportAllPDF}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Summary PDF
                  </button>
                  <button
                    onClick={exportTandurPDF}
                    className="px-4 py-2 bg-[#C1272D] text-white rounded-lg hover:bg-[#a02125] transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Tandur PDF
                  </button>
                  <button
                    onClick={exportTalakondapallyPDF}
                    className="px-4 py-2 bg-[#1e40af] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Talakondapally PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
                <div className="flex flex-wrap gap-2">
                  {['all', 'present', 'absent'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                        filterStatus === status
                          ? getStatusColor(status === 'all' ? '' : status) + ' border-2'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'all' ? 'All Status' : status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Employees */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {tandurData.totalEmployees} Tandur • {talakondapallyData.totalEmployees} Talakondapally
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Present Today */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Present Today</p>
                  <p className="text-2xl font-bold text-emerald-600">{totalPresent}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getPercentage(totalPresent, totalEmployees).toFixed(1)}% Attendance
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getPercentage(totalPresent, totalEmployees)}%` }}
                ></div>
              </div>
            </div>

            {/* Absent Today */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Absent Today</p>
                  <p className="text-2xl font-bold text-red-600">{totalAbsent}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getPercentage(totalAbsent, totalEmployees).toFixed(1)}% Absenteeism
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getPercentage(totalAbsent, totalEmployees)}%` }}
                ></div>
              </div>
            </div>

            {/* Marked Today */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Marked Today</p>
                  <p className="text-2xl font-bold text-blue-600">{totalMarked}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getPercentage(totalMarked, totalEmployees).toFixed(1)}% Marked
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getPercentage(totalMarked, totalEmployees)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Detailed Farm Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tandur Farm */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="bg-[#C1272D] text-white rounded-t-lg p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Tandur Farm</h2>
                  <div className="text-sm opacity-90">
                    {filteredTandurData.length} of {tandurData.attendance.length} shown
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm opacity-90">
                    Total Employees: {tandurData.totalEmployees}
                  </span>
                  <span className="text-sm opacity-90">
                    Marked: {tandurData.attendance.length}
                  </span>
                </div>
              </div>

              <div className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-emerald-700">{tandurSummary.present}</div>
                    <div className="text-xs text-emerald-600">Present</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-red-700">{tandurSummary.absent}</div>
                    <div className="text-xs text-red-600">Absent</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-gray-700">{tandurData.totalEmployees - tandurData.attendance.length}</div>
                    <div className="text-xs text-gray-600">Not Marked</div>
                  </div>
                </div>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                {tandurData.loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C1272D]"></div>
                    <p className="mt-2 text-gray-600">Loading Tandur attendance...</p>
                  </div>
                ) : tandurData.error ? (
                  <div className="text-center py-8 text-red-600">
                    <p className="mb-2">Error loading Tandur data</p>
                    <p className="text-sm text-red-500 mb-4">{tandurData.error}</p>
                    <button
                      onClick={() => fetchTandurData(selectedDate)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredTandurData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {filterStatus === 'all' 
                      ? `No attendance records found for ${selectedDate}`
                      : `No ${filterStatus} employees found for ${selectedDate}`
                    }
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTandurData.map((employee) => (
                      <div
                        key={employee.employeeid}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {employee.name || `Employee ${employee.employeeid}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {employee.employeeid} • {employee.designation || 'No designation'}
                          </div>
                          {employee.employee_number && (
                            <div className="text-sm text-gray-500">
                              Phone: {employee.employee_number}
                            </div>
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(employee.status)}`}>
                          {employee.status || 'Not Marked'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Talakondapally Farm */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="bg-[#1e40af] text-white rounded-t-lg p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Talakondapally Farm</h2>
                  <div className="text-sm opacity-90">
                    {filteredTalakondapallyData.length} of {talakondapallyData.attendance.length} shown
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm opacity-90">
                    Total Employees: {talakondapallyData.totalEmployees}
                  </span>
                  <span className="text-sm opacity-90">
                    Marked: {talakondapallyData.attendance.length}
                  </span>
                </div>
              </div>

              <div className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-emerald-700">{talakondapallySummary.present}</div>
                    <div className="text-xs text-emerald-600">Present</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-red-700">{talakondapallySummary.absent}</div>
                    <div className="text-xs text-red-600">Absent</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-gray-700">{talakondapallyData.totalEmployees - talakondapallyData.attendance.length}</div>
                    <div className="text-xs text-gray-600">Not Marked</div>
                  </div>
                </div>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                {talakondapallyData.loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af]"></div>
                    <p className="mt-2 text-gray-600">Loading Talakondapally attendance...</p>
                  </div>
                ) : talakondapallyData.error ? (
                  <div className="text-center py-8 text-red-600">
                    <p className="mb-2">Error loading Talakondapally data</p>
                    <p className="text-sm text-red-500 mb-4">{talakondapallyData.error}</p>
                    <button
                      onClick={() => fetchTalakondapallyData(selectedDate)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredTalakondapallyData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {filterStatus === 'all' 
                      ? `No attendance records found for ${selectedDate}`
                      : `No ${filterStatus} employees found for ${selectedDate}`
                    }
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTalakondapallyData.map((employee) => (
                      <div
                        key={employee.employeeid}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {employee.employee_name || employee.name || `Employee ${employee.employeeid}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {employee.employeeid} • {employee.designation || 'No designation'}
                          </div>
                          {employee.employee_number && (
                            <div className="text-sm text-gray-500">
                              Phone: {employee.employee_number}
                            </div>
                          )}
                          {employee.review && (
                            <div className="text-xs text-blue-600 mt-1">
                              Review: {employee.review}
                            </div>
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(employee.status)}`}>
                          {employee.status || 'Not Marked'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Overall Summary */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{totalMarked}</div>
                <div className="text-sm text-gray-600">Total Marked Today</div>
                <div className="text-xs text-gray-500 mt-1">
                  {getPercentage(totalMarked, totalEmployees).toFixed(1)}% of total
                </div>
              </div>
              
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-700">{totalPresent}</div>
                <div className="text-sm text-emerald-600">Present Across Farms</div>
                <div className="text-xs text-emerald-500 mt-1">
                  {tandurSummary.present} Tandur • {talakondapallySummary.present} Talakondapally
                </div>
              </div>

              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{totalAbsent}</div>
                <div className="text-sm text-red-600">Absent Across Farms</div>
                <div className="text-xs text-red-500 mt-1">
                  {tandurSummary.absent} Tandur • {talakondapallySummary.absent} Talakondapally
                </div>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{totalEmployees - totalMarked}</div>
                <div className="text-sm text-blue-600">Not Marked</div>
                <div className="text-xs text-blue-500 mt-1">
                  {tandurData.totalEmployees - tandurData.attendance.length} Tandur • {talakondapallyData.totalEmployees - talakondapallyData.attendance.length} Talakondapally
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export default Accountsmain