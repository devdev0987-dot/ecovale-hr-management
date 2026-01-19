
import React, { useState } from 'react';
import { Eye, EyeOff, Leaf } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { validateEmail } from '../utils/helpers';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // persist last password only if rememberMe is checked
      try {
        if (rememberMe) {
          localStorage.setItem('ecovale_last_password', password);
        } else {
          localStorage.removeItem('ecovale_last_password');
        }
      } catch (err) {
        // ignore storage errors
      }
      onLogin();
    }, 1000);
  };

  React.useEffect(() => {
    // load last-entered password (only the most recent) if present
    try {
      const last = localStorage.getItem('ecovale_last_password');
      if (last) {
        setPassword(last);
        setRememberMe(true);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-600 mb-4 flex items-center justify-center">
            <Leaf className="text-white" size={28} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">EcoVale HR</h1>
          <p className="text-sm text-gray-600">Employee Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Input
              id="email"
              type="email"
              label="Email Address"
              placeholder="admin@ecovale.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5"
            >
              {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">Remember last password</label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-green-600 hover:text-green-500">Forgot your password?</a>
            </div>
          </div>
          
          <div>
            <Button type="submit" isLoading={isLoading} className="w-full">
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
