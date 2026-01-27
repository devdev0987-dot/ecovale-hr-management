
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

const Input: React.FC<InputProps> = ({ label, id, error, icon, containerClassName, ...props }) => {
  const hasIcon = !!icon;
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        {hasIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">{icon}</span>
          </div>
        )}
        <input
          id={id}
          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm ${hasIcon ? 'pl-10' : ''} ${error ? 'border-red-500' : ''}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Input;
