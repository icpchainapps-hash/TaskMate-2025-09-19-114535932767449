import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Shield, Award, ChevronDown } from 'lucide-react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile, useIsCallerAdmin } from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

interface UserIconProps {
  onProfileClick: () => void;
  onAdminClick: () => void;
  onNFTsClick: () => void;
}

export default function UserIcon({ onProfileClick, onAdminClick, onNFTsClick }: UserIconProps) {
  const { identity, clear, loginStatus } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: isAdmin = false } = useIsCallerAdmin();
  const queryClient = useQueryClient();
  const [showDropdown, setShowDropdown] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = !!identity;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showDropdown]);

  // Reset image error when profile picture changes
  useEffect(() => {
    setImageError(false);
  }, [userProfile?.profilePicture]);

  const handleLogout = async () => {
    setShowDropdown(false);
    try {
      await clear();
      queryClient.clear();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleProfileClick = () => {
    setShowDropdown(false);
    onProfileClick();
  };

  const handleAdminClick = () => {
    setShowDropdown(false);
    onAdminClick();
  };

  const handleNFTsClick = () => {
    setShowDropdown(false);
    onNFTsClick();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const getUserDisplayName = () => {
    if (!userProfile) return 'User';
    
    // For business accounts, show organization name if available
    if (userProfile.accountType === 'business' && userProfile.organizationName) {
      return userProfile.organizationName;
    }
    
    return userProfile.name || userProfile.displayName || 'User';
  };

  const getUserInitials = () => {
    if (!userProfile) return 'U';
    
    const displayName = getUserDisplayName();
    return getInitials(displayName);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Icon Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 p-2 rounded-lg transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        aria-label="User menu"
        aria-expanded={showDropdown}
        aria-haspopup="true"
      >
        {/* Profile Picture or Initials */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-orange-500 flex items-center justify-center flex-shrink-0">
          {userProfile?.profilePicture && !imageError ? (
            <img
              src={userProfile.profilePicture}
              alt="Profile"
              className="w-full h-full object-cover"
              onError={handleImageError}
              key={userProfile.profilePicture} // Force re-render when URL changes
            />
          ) : (
            <span className="text-white font-bold text-sm">
              {getUserInitials()}
            </span>
          )}
        </div>
        
        {/* Dropdown indicator - hidden on mobile for space */}
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 hidden sm:block ${
            showDropdown ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-750">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-orange-500 flex items-center justify-center flex-shrink-0">
                {userProfile?.profilePicture && !imageError ? (
                  <img
                    src={userProfile.profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                    key={userProfile.profilePicture} // Force re-render when URL changes
                  />
                ) : (
                  <span className="text-white font-bold">
                    {getUserInitials()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-gray-400 text-sm truncate">
                  {userProfile?.accountType === 'business' ? 'Business Account' : 'Individual Account'}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Profile */}
            <button
              onClick={handleProfileClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
            >
              <User size={18} className="flex-shrink-0" />
              <span>Profile Settings</span>
            </button>

            {/* My NFTs */}
            <button
              onClick={handleNFTsClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
            >
              <Award size={18} className="flex-shrink-0" />
              <span>My NFTs</span>
            </button>

            {/* Admin Panel - Only show for admin users */}
            {isAdmin && (
              <>
                <div className="border-t border-gray-700 my-2"></div>
                <button
                  onClick={handleAdminClick}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors text-orange-400 hover:text-orange-300"
                >
                  <Shield size={18} className="flex-shrink-0" />
                  <span>Admin Panel</span>
                </button>
              </>
            )}

            {/* Logout */}
            <div className="border-t border-gray-700 my-2"></div>
            <button
              onClick={handleLogout}
              disabled={loginStatus === 'logging-in'}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginStatus === 'logging-in' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 flex-shrink-0"></div>
              ) : (
                <LogOut size={18} className="flex-shrink-0" />
              )}
              <span>{loginStatus === 'logging-in' ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
