import Link from 'next/link';
import { useRouter } from 'next/router'; // 👈 1. Import useRouter
import { FaUser, FaCar, FaCalendarCheck, FaUsers } from 'react-icons/fa';

const menuItems = [
  { label: 'Attendance', icon: <FaCalendarCheck />, href: '/TalakondapallyAttendance' },
  { label: 'Employees',  icon: <FaUsers />, href: '/Employeesoftalakondapally' },
  { label: 'Vehicles',   icon: <FaCar />, href: '/Vehiclesoffarms' },
  { label: 'Profile',    icon: <FaUser />, href: '/ProfileTalakondapally' },
];

export default function MobileFooterMenu() {
  const router = useRouter(); // 👈 2. Get the router object
  const currentPath = router.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow z-50 md:hidden">
      <ul className="flex justify-around items-center py-2">
        {menuItems.map(item => {
          // 3. Determine if the current item is active
          const isActive = currentPath === item.href;

          return (
            <li key={item.label} className="flex-1 text-center">
              <Link href={item.href} legacyBehavior>
                <a 
                  className={`
                    flex flex-col items-center transition-colors duration-150
                    // Conditional classes: If active, use amber-600 and bold, otherwise use gray-700
                    ${isActive 
                      ? 'text-amber-600 font-bold' 
                      : 'text-gray-700 hover:text-amber-500'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </a>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}