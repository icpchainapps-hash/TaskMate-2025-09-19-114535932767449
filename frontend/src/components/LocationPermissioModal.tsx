import React from 'react';
import { X, MapPin, Smartphone, Monitor, RefreshCw, AlertCircle, Navigation } from 'lucide-react';

interface LocationPermissionModalProps {
  onClose: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}

export default function LocationPermissionModal({ onClose, onRetry, isRetrying }: LocationPermissionModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
              <MapPin size={20} className="text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Location Access Required</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Explanation */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <AlertCircle size={16} />
              <span className="font-medium">Why We Need Location Access</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              To show you nearby tasks and provide accurate distance calculations, we need access to your device's location. 
              Your location is only used for finding relevant tasks and is never shared with other users.
            </p>
          </div>

          {/* Mobile Instructions */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-3">
              <Smartphone size={20} className="text-green-500" />
              <h3 className="text-white font-semibold">On Mobile Devices</h3>
            </div>
            
            <div className="space-y-3 ml-8">
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium text-sm mb-2">Chrome/Safari Mobile:</h4>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Look for the location icon (📍) in your browser's address bar</li>
                  <li>Tap the icon and select "Allow" or "Always Allow"</li>
                  <li>If no icon appears, refresh the page and try again</li>
                </ol>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium text-sm mb-2">If Location is Blocked:</h4>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Go to your browser settings</li>
                  <li>Find "Site Settings" or "Privacy & Security"</li>
                  <li>Select "Location" permissions</li>
                  <li>Find this website and change to "Allow"</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Desktop Instructions */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-3">
              <Monitor size={20} className="text-blue-500" />
              <h3 className="text-white font-semibold">On Desktop Browsers</h3>
            </div>
            
            <div className="space-y-3 ml-8">
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium text-sm mb-2">Chrome:</h4>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Click the location icon (📍) in the address bar</li>
                  <li>Select "Always allow" and click "Done"</li>
                  <li>Or go to Settings → Privacy → Site Settings → Location</li>
                </ol>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium text-sm mb-2">Firefox:</h4>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Click the shield icon in the address bar</li>
                  <li>Click "Allow Location Access"</li>
                  <li>Or go to Preferences → Privacy → Permissions → Location</li>
                </ol>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium text-sm mb-2">Safari:</h4>
                <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Go to Safari → Preferences → Websites</li>
                  <li>Select "Location" from the left sidebar</li>
                  <li>Find this website and set to "Allow"</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Alternative Option */}
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Navigation size={16} />
              <span className="font-medium">Alternative</span>
            </div>
            <p className="text-gray-300 text-sm">
              You can also manually enter your location (suburb, state, or postcode) in the location search field 
              to find nearby tasks without using GPS.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-700 space-y-3">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
          >
            {isRetrying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Checking Location Access...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Retry Location Access</span>
              </>
            )}
          </button>
          
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
          >
            <span>Continue Without Location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
