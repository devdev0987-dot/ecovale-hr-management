
import React from 'react';
import { Loader2 } from 'lucide-react';

// Fix: Added 'size' prop to support different button sizes.
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'default';
  isLoading?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  isLoading = false,
  children,
  className,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const sizeClasses = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-2 py-1 text-xs',
  };
  
  const variantClasses = {
    primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
