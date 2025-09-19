import React from 'react';
import { LogOut } from 'lucide-react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';

export default function LoginButton() {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  const isAuthenticated = !!identity;
  const disabled = loginStatus === 'logging-in';

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error: any) {
        console.error('Login error:', error);
        if (error.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <button
        onClick={handleAuth}
        disabled={disabled}
        className="w-full px-8 py-4 rounded-xl transition-all duration-200 font-semibold text-lg bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {loginStatus === 'logging-in' ? 'Logging in...' : 'Get Started'}
      </button>
    );
  }

  return (
    <button
      onClick={handleAuth}
      disabled={disabled}
      className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700 disabled:opacity-50"
      title="Logout"
    >
      <LogOut size={20} />
    </button>
  );
}
