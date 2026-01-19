
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAppContext } from '../../contexts/AppContext';
import DashboardPage from '../../pages/DashboardPage';
import EmployeesPage from '../../pages/EmployeesPage';
import NewEmployeePage from '../../pages/NewEmployeePage';
import DesignationsPage from '../../pages/DesignationsPage';
import LettersPage from '../../pages/LettersPage';
import PayrollPage from '../../pages/PayrollPage';
import PayslipPage from '../../pages/PayslipPage';
import AdvanceRegisterPage from '../../pages/AdvanceRegisterPage';
import LoanRegisterPage from '../../pages/LoanRegisterPage';
import AttendanceRegisterPage from '../../pages/AttendanceRegisterPage';
import PayRunPage from '../../pages/PayRunPage';
import CalculatorPage from '../../pages/CalculatorPage';
import CareerPage from '../../pages/CareerPage';
import SettingsPage from '../../pages/SettingsPage';
import DocumentsPage from '../../pages/DocumentsPage.tsx';
import EmployeeOnboarding from '../../pages/EmployeeOnboarding';
import ErrorBoundary from '../ui/ErrorBoundary';

interface MainLayoutProps {
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { activePage } = useAppContext();

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'employees': return <EmployeesPage />;
      case 'new-employee': return <NewEmployeePage />;
      case 'designations': return <DesignationsPage />;
      case 'letters': return <LettersPage />;
      case 'documents': return <DocumentsPage />;
      case 'onboarding': return <EmployeeOnboarding />;
      case 'payroll': return <PayrollPage />;
      case 'Payslip': return <PayslipPage />;
      case 'attendance-register': return <AttendanceRegisterPage />;
      case 'advance-register': return <AdvanceRegisterPage />;
      case 'loan-register': return <LoanRegisterPage />;
      case 'pay-run': return <PayRunPage />;
      case 'calculator': return <CalculatorPage />;
      case 'career': return <CareerPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onLogout={onLogout} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          <div className="container mx-auto px-6 py-8">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
