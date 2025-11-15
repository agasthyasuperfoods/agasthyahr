import Employeefooter from '@/components/Employeefooter'
import EmployeeHeader from '@/components/EmployeeHeader'
import ReimbursementRequestmain from '@/components/ReimbursementRequestmain'
import React from 'react'

function ReimbursementRequest() {
  return (
    <div><EmployeeHeader />
    <ReimbursementRequestmain />
      <Employeefooter />
    </div>
  )
}

export default ReimbursementRequest
