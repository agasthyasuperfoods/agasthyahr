import React from 'react';
import { useRouter } from 'next/router';
import { FaMoneyBillAlt, FaFileInvoiceDollar, FaUserCheck, FaCalendarAlt } from 'react-icons/fa';

const navItems = [
  // { label: "Payslips", icon: <FaMoneyBillAlt />, href: "/Edash" },
  { label: "Reimbursement", icon: <FaFileInvoiceDollar />, href: "/ReimbursementRequest" },
  { label: "Logins", icon: <FaUserCheck />, href: "/Loginstime" },
  { label: "Leaves", icon: <FaCalendarAlt />, href: "/Employeeleaves" }
];

function Employeefooter() {
  const router = useRouter();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow flex justify-around items-center py-2"
      style={{ minHeight: 56 }}
    >
      {navItems.map(item => {
        // Check if it's active using router.pathname
        const isActive = router.pathname === item.href;
        return (
          <a
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center transition px-4 ${isActive ? 'text-red-600' : 'text-gray-800 hover:text-red-500'}`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-[11px] mt-1 font-medium">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

export default Employeefooter;
