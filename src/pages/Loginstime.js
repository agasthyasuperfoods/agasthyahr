import Employeefooter from '@/components/Employeefooter'
import EmployeeHeader from '@/components/EmployeeHeader'
import Employeelogintime from '@/components/Employeelogintime'
import React from 'react'

function Loginstime() {
  return (
    <div className="min-h-screen pb-[70px] bg-white"> {/* ← add padding here */}
      <EmployeeHeader />
      <Employeelogintime />
      <Employeefooter />
    </div>
  );
}

export default Loginstime;
