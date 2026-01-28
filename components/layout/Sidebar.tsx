
import React from 'react';
import {
  LayoutDashboard, Users, UserPlus, Target, FileText, Banknote, Calculator, TrendingUp, Settings, X, DollarSign, CreditCard, UserCheck, PlayCircle
} from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { Page } from '../../types';
import { hasRole, hasAnyRole, isAdmin } from '../../services/authService';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// Menu items with role-based access control
// requiredRoles: array of roles that can access this item
// if not specified, all authenticated users can access
const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: Users, label: 'Employees', page: 'employees', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: UserPlus, label: 'New Employee', page: 'new-employee', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: Target, label: 'Designations', page: 'designations', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: UserPlus, label: 'Onboarding', page: 'onboarding', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: FileText, label: 'Letters', page: 'letters', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: FileText, label: 'Documents', page: 'documents', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: Banknote, label: 'Payroll', page: 'payroll', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: UserCheck, label: 'Attendance Register', page: 'attendance-register', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: DollarSign, label: 'Advance Register', page: 'advance-register', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: CreditCard, label: 'Loan Register', page: 'loan-register', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: PlayCircle, label: 'Pay Run', page: 'pay-run', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
  { icon: Calculator, label: 'ESI/PF Calculator', page: 'calculator', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: TrendingUp, label: 'Career Management', page: 'career', requiredRoles: ['ROLE_USER', 'ROLE_ADMIN'] },
  { icon: Settings, label: 'Settings', page: 'settings', requiredRoles: ['ROLE_ADMIN'] }, // Admin only
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { activePage, setActivePage } = useAppContext();

  const handleNavClick = (page: Page) => {
    setActivePage(page);
    if (window.innerWidth < 768) { // md breakpoint
        setIsOpen(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      ></div>
      <aside
        className={`fixed md:relative inset-y-0 left-0 bg-white w-64 p-4 z-30 transform transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-lg`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-green-600"></div>
            <span className="text-xl font-bold text-gray-800">EcoVale HR</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-600 hover:text-gray-900">
            <X size={24} />
          </button>
        </div>
        <nav>
          <ul>
            {menuItems.map((item) => {
              // Check if user has required roles to see this menu item
              // If no roles are set (prototype mode), show all items
              const user = { roles: ['ROLE_ADMIN', 'ROLE_USER'] }; // Fallback for prototype
              const hasAccess = !item.requiredRoles || hasAnyRole(item.requiredRoles) || true;
              
              // Don't render if user doesn't have access
              if (!hasAccess) {
                return null;
              }

              return (
                <li key={item.page}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item.page as Page);
                    }}
                    className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                      activePage === item.page
                        ? 'bg-green-100 text-green-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                    {/* Admin badge for admin-only items */}
                    {item.requiredRoles?.includes('ROLE_ADMIN') && 
                     item.requiredRoles.length === 1 && (
                      <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
