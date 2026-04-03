import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLoginUser } from '../lib/api';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);

  // Auto-hide error message after 8 seconds
  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => {
        setShowError(false);
        setError('');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowError(false);
    setLoading(true);

    try {
      // Call backend API to login (backend handles auth verification + role fetch)
      const result = await apiLoginUser({ email, password });

      if (!result.success) {
        setError(result.message || 'Login failed');
        setShowError(true);
        return;
      }

      // Redirect based on user role returned from backend
      switch (result.user?.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'manager':
          navigate('/manager');
          break;
        case 'staff':
          navigate('/staff');
          break;
        default:
          setError('User role not found. Please contact administrator.');
          setShowError(true);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Left side - Login Form (35%) */}
      <div className="w-full lg:w-[35%] bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Company Name */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">FYP ERP SYSTEM</h1>
          <h2 className="text-xl text-gray-600 mb-8">Log in to your account</h2>

          {/* Error Message Popup */}
          {showError && error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Optional: Link to registration if needed (but admin only) */}
          <p className="mt-4 text-center text-sm text-gray-600">
            Don't have an account? Contact your administrator.
          </p>
        </div>
      </div>

      {/* Right side - Branding (65%) */}
      <div className="hidden lg:block lg:w-[65%] relative bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80')" }}>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
        
        {/* Content overlay */}
        <div className="relative h-full flex flex-col items-center justify-center text-white p-12">
          <div className="max-w-2xl text-center">
            <h1 className="text-5xl font-bold mb-6">Inventory Management System</h1>
            <p className="text-xl mb-8">
              Real-time tracking, predictive analytics, and stockout prevention for modern businesses.
            </p>
            <div className="grid grid-cols-2 gap-6 text-left">
              <div className="bg-white bg-opacity-10 p-6 rounded-lg backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-2">📊 Real-time Analytics</h3>
                <p className="text-sm opacity-90">Monitor inventory levels and sales in real-time.</p>
              </div>
              <div className="bg-white bg-opacity-10 p-6 rounded-lg backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-2">🔮 Predictive Stockout</h3>
                <p className="text-sm opacity-90">AI-powered predictions to prevent stockouts.</p>
              </div>
              <div className="bg-white bg-opacity-10 p-6 rounded-lg backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-2">👥 Role-based Access</h3>
                <p className="text-sm opacity-90">Admin, Manager, and Staff portals.</p>
              </div>
              <div className="bg-white bg-opacity-10 p-6 rounded-lg backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-2">⚡ Fast & Secure</h3>
                <p className="text-sm opacity-90">Built with React, Node.js, and Supabase.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;