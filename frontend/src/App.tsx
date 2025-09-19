import React, { useState, Suspense, lazy } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile, useHasDisplayName } from './hooks/useQueries';
import LoginButton from './components/LoginButton';

// Lazy load non-critical components
const ProfileSetup = lazy(() => import('./components/ProfileSetup'));
const MainApp = lazy(() => import('./components/MainApp'));

// Loading component for lazy-loaded components
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p className="text-gray-300">Loading Taskmate...</p>
    </div>
  </div>
);

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: hasDisplayName, isLoading: displayNameLoading, isFetched: displayNameFetched } = useHasDisplayName();

  const isAuthenticated = !!identity;
  
  // Show profile setup only if:
  // 1. User is authenticated
  // 2. DisplayName status has been fetched from backend
  // 3. User does NOT have a displayName according to backend
  const showProfileSetup = isAuthenticated && displayNameFetched && !displayNameLoading && hasDisplayName === false;

  if (isInitializing) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="taskmate-logo">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="64" height="64" rx="12" fill="#f97316"/>
                    <path d="M16 32h32M32 16v32M24 24l16 16M40 24L24 40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">Taskmate</h1>
              <p className="text-orange-500 text-lg font-medium">DIY Jobs Marketplace</p>
            </div>
            
            <div className="mb-8">
              <p className="text-gray-300 text-lg leading-relaxed">
                Connect with local taskers for your DIY projects, or offer your skills to help others.
              </p>
            </div>

            <div className="space-y-4">
              <LoginButton />
              <p className="text-sm text-gray-400">
                Secure authentication powered by Internet Identity
              </p>
            </div>
          </div>
        </div>

        <footer className="p-6 text-center text-sm text-gray-500">
          © 2025. Built with <span className="text-red-500">♥</span> using{' '}
          <a href="https://caffeine.ai" className="text-orange-500 hover:text-orange-400">
            caffeine.ai
          </a>
        </footer>
      </div>
    );
  }

  // Show loading while checking displayName status
  if (displayNameLoading || !displayNameFetched) {
    return <LoadingSpinner />;
  }

  if (showProfileSetup) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ProfileSetup />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MainApp />
    </Suspense>
  );
}
