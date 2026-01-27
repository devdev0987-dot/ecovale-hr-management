
import React, { useState } from 'react';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import { AppContextProvider } from './contexts/AppContext';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
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
