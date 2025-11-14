import Link from 'next/link';
import { FaUser, FaCar, FaCalendarCheck, FaUsers } from 'react-icons/fa';

const menuItems = [
  { label: 'Attendance', icon: <FaCalendarCheck />, href: '/TalakondapallyAttendance' },
  { label: 'Employees',  icon: <FaUsers />, href: '/Employeesoftalakondapally' },
  { label: 'Vehicles',   icon: <FaCar />, href: '/Vehiclesoffarms' },
  { label: 'Profile',    icon: <FaUser />, href: '/ProfileTalakondapally' },
];

export default function MobileFooterMenu() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow z-50 md:hidden">
      <ul className="flex justify-around items-center py-2">
        {menuItems.map(item => (
          <li key={item.label} className="flex-1 text-center">
            <Link href={item.href} legacyBehavior>
              <a className="flex flex-col items-center text-gray-700 hover:text-blue-700">
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs">{item.label}</span>
              </a>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
