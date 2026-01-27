
import React, { useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, User, Shield } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { getUser, getRoleDisplayName, isAdmin } from '../../services/authService';

interface NavbarProps {
  onLogout: () => void;
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogout, onMenuClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { pageTitle } = useAppContext();
  const user = getUser();
  const userIsAdmin = isAdmin();
  
  // Get display name from user data
  const displayName = user?.fullName || user?.username || 'User';
  const userRoles = user?.roles || [];
  
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b-2 border-gray-200 sticky top-0 z-10">
      <div className="flex items-center">
        <button onClick={onMenuClick} className="text-gray-500 focus:outline-none md:hidden">
          <Menu size={24} />
        </button>
        <h1 className="text-lg text-gray-700 font-semibold ml-4 md:ml-0">{pageTitle}</h1>
      </div>

      <div className="flex items-center">
        <div className="relative">
          <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-gray-800" />
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">3</span>
        </div>
        <div className="relative ml-6">
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center focus:outline-none">
            {/* User avatar with admin indicator */}
            <div className="relative">
              <img 
                src="https://picsum.photos/100" 
                alt={displayName} 
                className="w-10 h-10 rounded-full object-cover"
              />
              {userIsAdmin && (
                <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-1">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className="hidden md:flex flex-col items-start ml-2">
              <span className="font-medium text-gray-700">{displayName}</span>
              <span className="text-xs text-gray-500">
                {userIsAdmin ? 'Administrator' : 'User'}
              </span>
            </div>
            <ChevronDown className="hidden md:inline w-4 h-4 ml-1 text-gray-600" />
          </button>
          {isDropdownOpen && (
            <div 
              onMouseLeave={() => setIsDropdownOpen(false)}
              className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl z-20 border border-gray-200">
              {/* User info section */}
              <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user?.email || 'No email'}</p>
                {/* Role badges */}
                <div className="flex gap-1 mt-2">
                  {userRoles.map((role) => (
                    <span
                      key={role}
                      className={`text-xs px-2 py-0.5 rounded ${
                        role === 'ROLE_ADMIN'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {getRoleDisplayName(role)}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Menu items */}
              <a 
                href="#" 
                onClick={(e) => e.preventDefault()}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <User size={16} className="mr-2" />
                My Profile
              </a>
              
              <a 
                href="#" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  onLogout(); 
                }} 
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-200"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
