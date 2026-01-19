
import React from 'react';
import {
  LayoutDashboard, Users, UserPlus, Target, FileText, Banknote, Calculator, TrendingUp, Settings, X, DollarSign, CreditCard, UserCheck, PlayCircle
} from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { Page } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
  { icon: Users, label: 'Employees', page: 'employees' },
  { icon: UserPlus, label: 'New Employee', page: 'new-employee' },
  { icon: Target, label: 'Designations', page: 'designations' },
  { icon: UserPlus, label: 'Onboarding', page: 'onboarding' },
  { icon: FileText, label: 'Letters', page: 'letters' },
  { icon: FileText, label: 'Documents', page: 'documents' },
  { icon: Banknote, label: 'Payroll', page: 'payroll' },
  { icon: UserCheck, label: 'Attendance Register', page: 'attendance-register' },
  { icon: DollarSign, label: 'Advance Register', page: 'advance-register' },
  { icon: CreditCard, label: 'Loan Register', page: 'loan-register' },
  { icon: PlayCircle, label: 'Pay Run', page: 'pay-run' },
  { icon: Calculator, label: 'ESI/PF Calculator', page: 'calculator' },
  { icon: TrendingUp, label: 'Career Management', page: 'career' },
  { icon: Settings, label: 'Settings', page: 'settings' },
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
            {menuItems.map((item) => (
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
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
