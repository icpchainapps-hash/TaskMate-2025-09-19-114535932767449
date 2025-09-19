import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { Plus, Filter, MapPin, Search, Navigation, AlertCircle, DollarSign, Heart } from 'lucide-react';
import { useGetTasks, useGetTasksWithinRadius } from '../hooks/useQueries';
import { Task, TaskStatus, TaskType } from '../backend';
import TaskCard from './TaskCard';

const CreateTaskModal = lazy(() => import('./CreateTaskModal'));
const LocationPermissionModal = lazy(() => import('./LocationPermissionModal'));

const FILTER_CATEGORIES = [
  'All Categories', 'Cleaning', 'Assembly', 'Painting', 'Yard Work', 'Plumbing', 
  'Electrical', 'Carpentry', 'Moving', 'Handyman', 'Delivery', 'Pet Care', 'Tutoring', 'Other'
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'completed', label: 'Completed' }
];

const TASK_TYPE_FILTERS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'paid', label: 'Paid Tasks Only' },
  { value: 'volunteer', label: 'Volunteer Tasks Only' }
];

interface BrowseTasksProps {
  onMessageOwnerClick: (taskId: string) => void;
}

// Optimized geocoding with caching
const geocodingCache = new Map<string, { lat: number; lng: number; timestamp: number } | null>();
let activeGeocodingCalls = 0;
const MAX_CONCURRENT_GEOCODING_CALLS = 2;
const CACHE_DURATION = 30 * 60 * 1000;

const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address?.trim()) return null;

  const normalizedAddress = address.trim().toLowerCase();
  const cached = geocodingCache.get(normalizedAddress);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached;
  }

  while (activeGeocodingCalls >= MAX_CONCURRENT_GEOCODING_CALLS) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  activeGeocodingCalls++;

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'Taskmate/1.0' } }
    );
    
    if (!response.ok) throw new Error('Geocoding request failed');
    
    const data = await response.json();
    let result: { lat: number; lng: number } | null = null;
    
    if (data?.length > 0) {
      const geocodeResult = data[0];
      result = {
        lat: parseFloat(geocodeResult.lat),
        lng: parseFloat(geocodeResult.lon)
      };
    }
    
    const cacheEntry = result ? { ...result, timestamp: Date.now() } : null;
    geocodingCache.set(normalizedAddress, cacheEntry);
    return result;
  } catch (error) {
    console.error('Geocoding error:', error);
    geocodingCache.set(normalizedAddress, null);
    return null;
  } finally {
    activeGeocodingCalls--;
  }
};

const reverseGeocodeCache = new Map<string, { address: string; timestamp: number } | null>();

const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cached = reverseGeocodeCache.get(coordKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.address;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'User-Agent': 'Taskmate/1.0' } }
    );
    
    if (!response.ok) throw new Error('Reverse geocoding request failed');
    
    const data = await response.json();
    let address: string | null = null;
    
    if (data?.address) {
      const addressParts: string[] = [];
      
      if (data.address.suburb) addressParts.push(data.address.suburb);
      else if (data.address.city) addressParts.push(data.address.city);
      else if (data.address.town) addressParts.push(data.address.town);
      else if (data.address.village) addressParts.push(data.address.village);
      
      if (data.address.state) addressParts.push(data.address.state);
      if (data.address.country && addressParts.length < 2) addressParts.push(data.address.country);
      
      address = addressParts.length > 0 ? addressParts.join(', ') : data.display_name;
    }
    
    const cacheEntry = address ? { address, timestamp: Date.now() } : null;
    reverseGeocodeCache.set(coordKey, cacheEntry);
    return address;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    reverseGeocodeCache.set(coordKey, null);
    return null;
  }
};

export default function BrowseTasks({ onMessageOwnerClick }: BrowseTasksProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [skillFilter, setSkillFilter] = useState('');
  const [budgetFilter, setBudgetFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasTriggeredProximityFilter, setHasTriggeredProximityFilter] = useState(false);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [isRetryingLocation, setIsRetryingLocation] = useState(false);
  const [isUsingGPSLocation, setIsUsingGPSLocation] = useState(false);

  const { data: allTasks = [], isLoading } = useGetTasks();
  const { 
    data: proximityTasks = [], 
    isLoading: isLoadingProximityTasks,
    error: proximityError 
  } = useGetTasksWithinRadius(
    hasTriggeredProximityFilter ? userLocation?.lat : undefined,
    hasTriggeredProximityFilter ? userLocation?.lng : undefined,
    hasTriggeredProximityFilter ? distanceFilter : undefined
  );

  const tasks = allTasks.filter(task => !task.isArchived);
  const tasksToFilter = useMemo(() => {
    if (hasTriggeredProximityFilter && userLocation) {
      return proximityTasks.filter(task => !task.isArchived);
    }
    return tasks;
  }, [hasTriggeredProximityFilter, userLocation, proximityTasks, tasks]);

  const filteredTasks = useMemo(() => {
    return tasksToFilter.filter((task: Task) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'open' && task.status !== TaskStatus.open) return false;
        if (statusFilter === 'assigned' && task.status !== TaskStatus.assigned) return false;
        if (statusFilter === 'completed' && task.status !== TaskStatus.completed) return false;
      }
      
      if (taskTypeFilter !== 'all') {
        if (taskTypeFilter === 'paid' && task.taskType !== TaskType.paid) return false;
        if (taskTypeFilter === 'volunteer' && task.taskType !== TaskType.volunteer) return false;
      }
      
      if (skillFilter && !task.requiredSkills.some(skill => 
        skill.toLowerCase().includes(skillFilter.toLowerCase())
      )) {
        return false;
      }

      if (budgetFilter && task.taskType === TaskType.paid) {
        const budget = Number(task.budget);
        const filterValue = parseInt(budgetFilter);
        if (filterValue && budget > filterValue) return false;
      }

      if (categoryFilter !== 'All Categories' && task.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [tasksToFilter, statusFilter, taskTypeFilter, skillFilter, budgetFilter, categoryFilter]);

  const handleLocationInputChange = useCallback((value: string) => {
    setLocationFilter(value);
    setLocationError(null);
    setGeolocationError(null);
    setHasTriggeredProximityFilter(false);
    setUserLocation(null);
    setIsUsingGPSLocation(false);
    
    if (!value.trim()) {
      setUserLocation(null);
      setHasTriggeredProximityFilter(false);
      setIsUsingGPSLocation(false);
    }
  }, []);

  const triggerProximityFilter = useCallback(async () => {
    if (!locationFilter.trim() || distanceFilter === 0) {
      setHasTriggeredProximityFilter(false);
      setUserLocation(null);
      setLocationError(null);
      return;
    }

    setIsGeocodingLocation(true);
    setLocationError(null);

    try {
      let userCoords: { lat: number; lng: number } | null = null;

      if (isUsingGPSLocation && userLocation) {
        userCoords = userLocation;
      } else {
        userCoords = await geocodeAddress(locationFilter);
        if (!userCoords) {
          setLocationError('Could not find the specified location');
          setIsGeocodingLocation(false);
          return;
        }
      }

      setUserLocation(userCoords);
      setHasTriggeredProximityFilter(true);
    } catch (error) {
      console.error('Proximity filtering error:', error);
      setLocationError('Error filtering by location');
    } finally {
      setIsGeocodingLocation(false);
    }
  }, [locationFilter, distanceFilter, isUsingGPSLocation, userLocation]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeolocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingCurrentLocation(true);
    setGeolocationError(null);
    setLocationError(null);
    
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const coords = { lat: latitude, lng: longitude };
          setUserLocation(coords);
          setIsUsingGPSLocation(true);
          
          try {
            const address = await reverseGeocode(latitude, longitude);
            
            if (address) {
              setLocationFilter(address);
              const normalizedAddress = address.toLowerCase();
              geocodingCache.set(normalizedAddress, { ...coords, timestamp: Date.now() });
            } else {
              setLocationFilter(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          } catch (reverseGeoError) {
            console.warn('Reverse geocoding failed, using coordinates:', reverseGeoError);
            setLocationFilter(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            const coordsKey = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            geocodingCache.set(coordsKey.toLowerCase(), { ...coords, timestamp: Date.now() });
          }
          
          setHasTriggeredProximityFilter(true);
          
        } catch (error) {
          console.error('Error processing current location:', error);
          setGeolocationError('Could not process your current location');
        } finally {
          setIsGettingCurrentLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsGettingCurrentLocation(false);
        
        if (error.code === error.PERMISSION_DENIED) {
          setShowLocationPermissionModal(true);
        } else {
          const errorMessages = {
            [error.POSITION_UNAVAILABLE]: 'Location information is unavailable. Please check your device\'s location settings.',
            [error.TIMEOUT]: 'Location request timed out. Please try again or enter your location manually.',
          };
          setGeolocationError(errorMessages[error.code] || 'An unknown error occurred while getting your location. Please try again or enter your location manually.');
        }
      },
      options
    );
  }, []);

  const handleRetryLocationAccess = useCallback(() => {
    setIsRetryingLocation(true);
    setShowLocationPermissionModal(false);
    
    setTimeout(() => {
      setIsRetryingLocation(false);
      handleUseCurrentLocation();
    }, 500);
  }, [handleUseCurrentLocation]);

  const clearAllFilters = useCallback(() => {
    setLocationFilter('');
    setDistanceFilter(25);
    setStatusFilter('all');
    setCategoryFilter('All Categories');
    setTaskTypeFilter('all');
    setSkillFilter('');
    setBudgetFilter('');
    setLocationError(null);
    setGeolocationError(null);
    setUserLocation(null);
    setHasTriggeredProximityFilter(false);
    setIsUsingGPSLocation(false);
  }, []);

  const hasActiveFilters = locationFilter.trim() || distanceFilter !== 25 || statusFilter !== 'all' || 
    categoryFilter !== 'All Categories' || taskTypeFilter !== 'all' || skillFilter.trim() || budgetFilter.trim();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Tasks</h2>
          <p className="text-gray-400">
            {isLoadingProximityTasks ? (
              'Loading nearby tasks...'
            ) : (
              <>
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} available
                {hasTriggeredProximityFilter && userLocation && locationFilter.trim() && (
                  <span className="ml-2 text-orange-400">
                    within {distanceFilter}km of {locationFilter}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 font-medium hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Create Task</span>
        </button>
      </div>

      {filteredTasks.length === 0 && !isLoading && !isLoadingProximityTasks && (
        <div className="text-center py-12 mb-6">
          <div className="text-gray-400 mb-6">
            <Search size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">
              {hasTriggeredProximityFilter && userLocation && locationFilter.trim()
                ? `No tasks found within ${distanceFilter}km of ${locationFilter}`
                : 'No tasks found'
              }
            </p>
            <p className="text-sm mb-6">
              {hasTriggeredProximityFilter && userLocation && locationFilter.trim()
                ? 'Try expanding your search radius or changing your location'
                : 'Be the first to post a task in your area'
              }
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 font-medium mx-auto hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus size={20} />
            <span>Create Your First Task</span>
          </button>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-4"
        >
          <Filter size={16} />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </button>

        {showFilters && (
          <div className="bg-gray-800 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Task Type</label>
              <select
                value={taskTypeFilter}
                onChange={(e) => setTaskTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {TASK_TYPE_FILTERS.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="location-filter-section">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-4">
                <MapPin size={16} className="text-orange-500" />
                Location & Distance
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location (suburb, state, postcode)
                  </label>
                  <div className="location-input-group">
                    <input
                      type="text"
                      value={locationFilter}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      placeholder="e.g. Melbourne VIC, Sydney NSW, 3000"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={handleUseCurrentLocation}
                      disabled={isGettingCurrentLocation || isGeocodingLocation || isRetryingLocation}
                      className="current-location-button"
                      title="Use current location"
                    >
                      {isGettingCurrentLocation || isRetryingLocation ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Navigation size={16} />
                      )}
                      <span className="hidden sm:inline">
                        {isGettingCurrentLocation || isRetryingLocation ? 'Getting...' : 'Current'}
                      </span>
                    </button>
                  </div>
                  
                  {locationError && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{locationError}</p>
                    </div>
                  )}
                  
                  {proximityError && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">Failed to load nearby tasks</p>
                    </div>
                  )}
                  
                  {geolocationError && (
                    <div className="flex items-start gap-2 mt-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 text-sm font-medium mb-1">Location Access Issue</p>
                        <p className="text-yellow-300 text-sm">{geolocationError}</p>
                        {geolocationError.includes('denied') && (
                          <p className="text-yellow-300 text-xs mt-2">
                            💡 Tip: Look for a location icon in your browser's address bar and click "Allow" to enable location access.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {userLocation && !geolocationError && !locationError && locationFilter && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                      <MapPin size={16} className="text-green-400 flex-shrink-0" />
                      <p className="text-green-400 text-sm">
                        Location set: {locationFilter}
                        {isUsingGPSLocation && <span className="ml-2 text-xs">(GPS)</span>}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Distance Radius: {distanceFilter}km
                  </label>
                  <div className="distance-slider-container">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={distanceFilter}
                      onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
                      disabled={!locationFilter.trim()}
                      className="distance-slider"
                    />
                    <div className="distance-slider-labels">
                      <span className="text-xs text-gray-400">5km</span>
                      <span className="text-xs text-gray-400">25km</span>
                      <span className="text-xs text-gray-400">50km</span>
                      <span className="text-xs text-gray-400">100km</span>
                    </div>
                  </div>
                  {!locationFilter.trim() && (
                    <p className="location-help-text">Enter a location to enable distance filtering</p>
                  )}
                </div>

                {locationFilter.trim() && distanceFilter > 0 && !isUsingGPSLocation && (
                  <div>
                    <button
                      onClick={triggerProximityFilter}
                      disabled={isGeocodingLocation || isGettingCurrentLocation}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                    >
                      {isGeocodingLocation ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Searching nearby tasks...</span>
                        </>
                      ) : (
                        <>
                          <Search size={16} />
                          <span>Search Tasks by Location</span>
                        </>
                      )}
                    </button>
                    {!hasTriggeredProximityFilter && (
                      <p className="location-help-text">
                        Click "Search" to find tasks within {distanceFilter}km of your location
                      </p>
                    )}
                  </div>
                )}

                {isUsingGPSLocation && userLocation && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                      <Navigation size={14} />
                      <span className="font-medium">Using GPS Location</span>
                    </div>
                    <p className="text-gray-300 text-xs">
                      Automatically searching for tasks within {distanceFilter}km of your current location.
                      Adjust the distance slider to change the search radius.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {FILTER_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Skill</label>
              <input
                type="text"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="e.g. plumbing, electrical"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            
            {taskTypeFilter !== 'volunteer' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Budget ($) {taskTypeFilter === 'paid' ? '' : '(Paid Tasks Only)'}
                </label>
                <input
                  type="number"
                  value={budgetFilter}
                  onChange={(e) => setBudgetFilter(e.target.value)}
                  placeholder="Enter maximum budget"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {taskTypeFilter === 'all' && (
                  <p className="text-xs text-gray-400 mt-1">Only applies to paid tasks</p>
                )}
              </div>
            )}

            {hasActiveFilters && (
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={clearAllFilters}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoadingProximityTasks && hasTriggeredProximityFilter && (
        <div className="text-center py-8 mb-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading tasks within {distanceFilter}km...</p>
        </div>
      )}

      {filteredTasks.length > 0 && !isLoadingProximityTasks && (
        <div className="space-y-4">
          {filteredTasks.map((task: Task) => (
            <TaskCard key={task.id} task={task} onMessageOwnerClick={onMessageOwnerClick} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}>
          <CreateTaskModal onClose={() => setShowCreateModal(false)} />
        </Suspense>
      )}

      {showLocationPermissionModal && (
        <Suspense fallback={null}>
          <LocationPermissionModal
            onClose={() => setShowLocationPermissionModal(false)}
            onRetry={handleRetryLocationAccess}
            isRetrying={isRetryingLocation}
          />
        </Suspense>
      )}
    </div>
  );
}
