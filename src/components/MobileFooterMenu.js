import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaUser, FaCar, FaCalendarCheck, FaUsers } from 'react-icons/fa';

const menuItems = [
  { label: 'Attendance', icon: <FaCalendarCheck />, href: '/TalakondapallyAttendance' },
  { label: 'Employees', icon: <FaUsers />, href: '/Employeesoftalakondapally' },
  { label: 'Vehicles', icon: <FaCar />, href: '/Vehiclesoffarms' },
  { label: 'Profile', icon: <FaUser />, href: '/ProfileTalakondapally' },
];

export default function MobileFooterMenu() {
  const router = useRouter();
  const current = router.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow z-50 md:hidden">
      <ul className="flex justify-around items-center py-2">

        {menuItems.map((item) => {
          const isActive = current === item.href;

          const activeColor = isActive ? "text-amber-600 font-semibold" : "text-gray-600";

          return (
            <li key={item.label} className="flex-1 text-center">
              <Link href={item.href} legacyBehavior>
                <a className={`flex flex-col items-center transition ${activeColor}`}>
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs mt-0.5">{item.label}</span>
                </a>
              </Link>
            </li>
          );
        })}

      </ul>
    </nav>
  );
}
