import React, { useState, useEffect } from 'react';
import { MapPin, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Task } from '../backend';

interface TaskLocationMapProps {
  task: Task;
  isTaskOwner: boolean;
  isAssignedTasker: boolean;
  currentAddress?: string; // For real-time address updates in edit mode
}

// Real geocoding function using a public geocoding service
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    // Use Nominatim (OpenStreetMap) geocoding service - free and no API key required
    const encodedAddress = encodeURIComponent(address.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Function to add random offset for privacy (approximate location)
const addPrivacyOffset = (lat: number, lng: number): { lat: number; lng: number } => {
  // Add random offset of up to ~1km (0.01 degrees is roughly 1km)
  const latOffset = (Math.random() - 0.5) * 0.02;
  const lngOffset = (Math.random() - 0.5) * 0.02;
  
  return {
    lat: lat + latOffset,
    lng: lng + lngOffset
  };
};

export default function TaskLocationMap({ task, isTaskOwner, isAssignedTasker, currentAddress }: TaskLocationMapProps) {
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [showPreciseLocation, setShowPreciseLocation] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Determine if user can see precise location based on task status and completion
  const canSeePreciseLocation = React.useMemo(() => {
    // Only task owner can see precise location after completion
    if (task.status === 'completed') {
      return isTaskOwner;
    }
    
    // Before completion, both task owner and assigned tasker can see precise location when task is assigned
    return isTaskOwner || (isAssignedTasker && task.status !== 'open');
  }, [isTaskOwner, isAssignedTasker, task.status]);
  
  // Use currentAddress if provided (for edit mode), otherwise use task address from backend
  const addressToUse = currentAddress || task.address;

  useEffect(() => {
    // Real geocoding using actual address data from backend
    const performGeocoding = async () => {
      if (!addressToUse || addressToUse.trim() === '') {
        setMapError('No address provided');
        setCoordinates(null);
        return;
      }

      setIsGeocoding(true);
      setMapError(null);

      try {
        const coords = await geocodeAddress(addressToUse);
        if (coords) {
          setCoordinates(coords);
          setMapError(null);
        } else {
          setMapError('Unable to locate address on map');
          setCoordinates(null);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setMapError('Failed to load location');
        setCoordinates(null);
      } finally {
        setIsGeocoding(false);
      }
    };

    performGeocoding();
  }, [addressToUse]); // Update when address changes in real time

  if (isGeocoding) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-64 bg-gray-700 rounded-lg mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        </div>
        <p className="text-gray-400 text-sm mt-2">Loading location...</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle size={16} />
          <span className="font-medium">Location Unavailable</span>
        </div>
        <p className="text-gray-400 text-sm">{mapError}</p>
        {addressToUse && (
          <p className="text-gray-500 text-xs mt-2">
            Address: {addressToUse}
          </p>
        )}
      </div>
    );
  }

  if (!coordinates) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-2 text-yellow-400 mb-2">
          <AlertCircle size={16} />
          <span className="font-medium">Location Not Found</span>
        </div>
        <p className="text-gray-400 text-sm">Could not find coordinates for the provided address</p>
        {addressToUse && (
          <p className="text-gray-500 text-xs mt-2">
            Address: {addressToUse}
          </p>
        )}
      </div>
    );
  }

  // Determine which coordinates to show based on privacy settings
  const displayCoords = (canSeePreciseLocation && showPreciseLocation) 
    ? coordinates 
    : addPrivacyOffset(coordinates.lat, coordinates.lng);

  // Create a map URL using OpenStreetMap
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${displayCoords.lng - 0.01},${displayCoords.lat - 0.01},${displayCoords.lng + 0.01},${displayCoords.lat + 0.01}&layer=mapnik&marker=${displayCoords.lat},${displayCoords.lng}`;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Map Container */}
      <div className="relative mb-4">
        <iframe
          src={mapUrl}
          width="100%"
          height="300"
          className="rounded-lg border border-gray-600"
          title="Task Location Map"
          key={mapUrl} // Force re-render when URL changes
        />
        
        {/* Privacy overlay for approximate location */}
        {!canSeePreciseLocation && (
          <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg flex items-center justify-center">
            <div className="bg-gray-900 bg-opacity-90 text-white px-3 py-2 rounded-lg text-sm font-medium">
              Approximate Location
            </div>
          </div>
        )}
      </div>

      {/* Location Controls and Info */}
      <div className="space-y-3">
        {/* Address Display */}
        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {canSeePreciseLocation ? (
              <div>
                <p className="text-white font-medium text-sm">
                  {showPreciseLocation ? addressToUse : 'General Area'}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {showPreciseLocation 
                    ? 'Exact address visible to you' 
                    : 'Click to show precise location'
                  }
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-300 text-sm">General area shown for privacy</p>
                <p className="text-gray-400 text-xs mt-1">
                  {task.status === 'completed'
                    ? 'Only task owner can view exact address after completion'
                    : task.status === 'open' 
                      ? 'Exact address will be shared when task is assigned'
                      : 'Approximate location shown'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button for Precise Location */}
        {canSeePreciseLocation && (
          <button
            onClick={() => setShowPreciseLocation(!showPreciseLocation)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            {showPreciseLocation ? (
              <>
                <EyeOff size={14} />
                <span>Show Approximate</span>
              </>
            ) : (
              <>
                <Eye size={14} />
                <span>Show Precise Location</span>
              </>
            )}
          </button>
        )}

        {/* Privacy Notice */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
            <MapPin size={14} />
            <span className="font-medium">Location Privacy</span>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed">
            {task.status === 'completed' 
              ? 'Task is completed. Only the task owner can view the exact address for privacy.'
              : canSeePreciseLocation 
                ? 'You can view the exact address because you are the task owner or assigned tasker.'
                : 'For privacy, only an approximate location is shown. The exact address will be shared with the assigned tasker.'
            }
          </p>
        </div>

        {/* Real-time Address Display */}
        {currentAddress && currentAddress !== task.address && (
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-400 text-sm mb-1">
              <MapPin size={14} />
              <span className="font-medium">Address Updated</span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Map is showing the updated address in real-time. Save your changes to update the task location.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
