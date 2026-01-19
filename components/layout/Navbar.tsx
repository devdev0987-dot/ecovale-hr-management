
import React, { useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';

interface NavbarProps {
  onLogout: () => void;
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogout, onMenuClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { pageTitle } = useAppContext();
  
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
          <Bell className="w-6 h-6 text-gray-600" />
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">3</span>
        </div>
        <div className="relative ml-6">
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center focus:outline-none">
            <img src="https://picsum.photos/100" alt="Avatar" className="w-10 h-10 rounded-full object-cover"/>
            <span className="hidden md:inline ml-2 font-medium text-gray-700">Admin</span>
            <ChevronDown className="hidden md:inline w-4 h-4 ml-1 text-gray-600" />
          </button>
          {isDropdownOpen && (
            <div 
              onMouseLeave={() => setIsDropdownOpen(false)}
              className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl z-20">
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
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
