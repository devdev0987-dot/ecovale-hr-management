
import React, { useState } from 'react';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import { AppContextProvider } from './contexts/AppContext';

const App: React.FC = () => {
  // Check localStorage for existing auth on mount
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  return (
    <AppContextProvider>
      {isAuthenticated ? (
        <MainLayout onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </AppContextProvider>
  );
};

export default App;
