
import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import { Page } from '../types';
import ToastContainer, { ToastMessage } from '../components/ui/Toast';

interface AppContextType {
  activePage: Page;
  setActivePage: (page: Page) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  pageTitle: string;
  selectedEmployeeId?: string | null;
  setSelectedEmployeeId: (id?: string | null) => void;
  employeesVersion: number;
  bumpEmployeesVersion: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  employees: 'Employee Management',
  'new-employee': 'New Employee Form',
  designations: 'Designations',
  letters: 'Letters & Documents',
  documents: 'Employee Documents',
  payroll: 'Payroll Management',
  calculator: 'ESI/PF Calculator',
  career: 'Career Management',
  onboarding: 'Employee Onboarding',
  settings: 'Settings',
  'advance-register': 'Advance Register',
  'loan-register': 'Loan Register',
  Payslip: 'Payslip',
  'attendance-register': 'Attendance Register',
  'pay-run': 'Pay Run'
};

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeesVersion, setEmployeesVersion] = useState<number>(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);
  
  const pageTitle = pageTitles[activePage] || 'EcoVale HR';

  const value = {
    activePage,
    setActivePage,
    showToast,
    isLoading,
    setIsLoading,
    pageTitle,
    selectedEmployeeId,
    setSelectedEmployeeId,
    employeesVersion,
    bumpEmployeesVersion: () => setEmployeesVersion(v => v + 1),
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} />
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
