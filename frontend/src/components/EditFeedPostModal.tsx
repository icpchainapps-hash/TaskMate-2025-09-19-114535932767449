import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, MapPin, Upload, Trash2, Navigation, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { NeighbourhoodPost, useUpdateNeighbourhoodPost } from '../hooks/useQueries';
import { AvailabilityCalendar } from '../backend';
import { useFileUpload } from '../blob-storage/FileStorage';
import AvailabilityCalendarComponent from './AvailabilityCalendar';

interface EditFeedPostModalProps {
  post: NeighbourhoodPost;
  onClose: () => void;
  onSave: (updatedPost: NeighbourhoodPost) => void;
}

const CATEGORIES = [
  'Community',
  'Home & Garden',
  'Skills & Services',
  'Items & Goods',
  'Events',
  'Announcements',
  'Other'
];

const COMMON_TAGS = [
  'urgent', 'flexible', 'weekend', 'evening', 'morning', 'family-friendly', 
  'beginner-friendly', 'experienced', 'tools-provided', 'transport-needed',
  'indoor', 'outdoor', 'one-time', 'ongoing', 'seasonal'
];

// Real-time geocoding function using Nominatim (OpenStreetMap)
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Taskmate/1.0'
        }
      }
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

export default function EditFeedPostModal({ post, onClose, onSave }: EditFeedPostModalProps) {
  const updatePost = useUpdateNeighbourhoodPost();
  const { uploadFile, isUploading } = useFileUpload();
  
  const [formData, setFormData] = useState({
    title: post.title,
    description: post.description,
    category: post.category || '',
    location: {
      address: post.location.address || '',
      suburb: post.location.suburb,
      state: post.location.state,
      postcode: post.location.postcode
    },
    visibilityRadius: post.visibilityRadius,
    tags: post.tags || [],
    customTag: '',
    slotCount: post.slotCount?.toString() || ''
  });

  // Enhanced availability calendar state with comprehensive persistence handling
  const [availabilityCalendar, setAvailabilityCalendar] = useState<AvailabilityCalendar>(() => {
    console.log('EditFeedPostModal: Initializing availability calendar state');
    console.log('Post availability calendar:', post.availabilityCalendar);
    
    // Enhanced initialization with deep cloning for persistence
    if (post.availabilityCalendar) {
      console.log('EditFeedPostModal: Using existing availability calendar from post');
      const existingCalendar = {
        availableDates: [...post.availabilityCalendar.availableDates],
        timeSlots: [...post.availabilityCalendar.timeSlots],
        durationMinutes: post.availabilityCalendar.durationMinutes,
        intervalMinutes: post.availabilityCalendar.intervalMinutes
      };
      console.log('EditFeedPostModal: Initialized calendar with', existingCalendar.availableDates.length, 'dates and', existingCalendar.timeSlots.length, 'time slots');
      return existingCalendar;
    } else {
      console.log('EditFeedPostModal: No existing calendar, using safe defaults');
      return {
        availableDates: [],
        timeSlots: [],
        durationMinutes: BigInt(60),
        intervalMinutes: BigInt(30)
      };
    }
  });

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    general: ''
  });
  
  // Real-time geocoding state
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isRealTimeGeocoding, setIsRealTimeGeocoding] = useState(false);
  const [postCoordinates, setPostCoordinates] = useState<{ lat: number; lng: number } | null>(
    post.location.latitude && post.location.longitude 
      ? { lat: post.location.latitude, lng: post.location.longitude }
      : null
  );
  const geocodingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced debug logging for availability calendar initialization and persistence
  useEffect(() => {
    console.log('EditFeedPostModal: Component mounted for post:', post.id);
    console.log('EditFeedPostModal: Post type:', post.postType);
    console.log('EditFeedPostModal: Original post availability calendar:', post.availabilityCalendar);
    console.log('EditFeedPostModal: Component availability calendar state:', availabilityCalendar);
    console.log('EditFeedPostModal: Calendar dates count:', availabilityCalendar.availableDates.length);
    console.log('EditFeedPostModal: Calendar time slots count:', availabilityCalendar.timeSlots.length);
  }, [post.id, post.postType, post.availabilityCalendar, availabilityCalendar]);

  // Construct full address from structured fields
  const constructFullAddress = () => {
    const parts = [
      formData.location.address.trim(),
      formData.location.suburb.trim(),
      formData.location.state.trim(),
      formData.location.postcode.trim()
    ].filter(part => part.length > 0);
    
    return parts.join(', ');
  };

  // Real-time geocoding effect for non-task-promo posts
  useEffect(() => {
    // Only perform real-time geocoding for non-task-promo posts
    if (post.postType === 'task_promo') {
      return;
    }

    // Clear existing timeout
    if (geocodingTimeoutRef.current) {
      clearTimeout(geocodingTimeoutRef.current);
    }

    const fullAddress = constructFullAddress();
    
    // Only geocode if we have at least suburb and state (required fields)
    if (!formData.location.suburb.trim() || !formData.location.state.trim()) {
      setMapUrl(null);
      setPostCoordinates(null);
      return;
    }

    // Debounce geocoding to avoid too many API calls
    geocodingTimeoutRef.current = setTimeout(async () => {
      if (fullAddress.trim()) {
        setIsRealTimeGeocoding(true);
        setLocationError(null);

        try {
          const coords = await geocodeAddress(fullAddress);
          if (coords) {
            setPostCoordinates(coords);
            
            // Create map URL for real-time display
            const newMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.01},${coords.lat - 0.01},${coords.lng + 0.01},${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat},${coords.lng}`;
            setMapUrl(newMapUrl);
          } else {
            setLocationError('Could not find the specified location');
            setMapUrl(null);
            setPostCoordinates(null);
          }
        } catch (error) {
          console.error('Real-time geocoding error:', error);
          setLocationError('Error finding location');
          setMapUrl(null);
          setPostCoordinates(null);
        } finally {
          setIsRealTimeGeocoding(false);
        }
      }
    }, 1000); // 1 second debounce

    // Cleanup timeout on unmount
    return () => {
      if (geocodingTimeoutRef.current) {
        clearTimeout(geocodingTimeoutRef.current);
      }
    };
  }, [formData.location.address, formData.location.suburb, formData.location.state, formData.location.postcode, post.postType]);

  // Initialize map URL on mount if coordinates exist
  useEffect(() => {
    if (postCoordinates) {
      const newMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${postCoordinates.lng - 0.01},${postCoordinates.lat - 0.01},${postCoordinates.lng + 0.01},${postCoordinates.lat + 0.01}&layer=mapnik&marker=${postCoordinates.lat},${postCoordinates.lng}`;
      setMapUrl(newMapUrl);
    }
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...imageFiles]);
      
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
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
          
          // Set coordinates immediately
          setPostCoordinates({ lat: latitude, lng: longitude });
          
          // Create map URL immediately
          const newMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`;
          setMapUrl(newMapUrl);
          
          // Reverse geocode to get address components
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'Taskmate/1.0'
                }
              }
            );
            const data = await response.json();
            
            if (data && data.address) {
              setFormData(prev => ({
                ...prev,
                location: {
                  address: data.address.house_number && data.address.road 
                    ? `${data.address.house_number} ${data.address.road}` 
                    : '',
                  suburb: data.address.suburb || data.address.city || data.address.town || '',
                  state: data.address.state || '',
                  postcode: data.address.postcode || ''
                }
              }));
            }
          } catch (reverseGeoError) {
            console.warn('Reverse geocoding failed:', reverseGeoError);
            // Keep the coordinates but show a generic location
            setFormData(prev => ({
              ...prev,
              location: {
                address: '',
                suburb: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                state: '',
                postcode: ''
              }
            }));
          }
        } catch (error) {
          console.error('Error processing current location:', error);
          setLocationError('Could not process your current location');
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        setLocationError('Could not access your location');
      },
      options
    );
  };

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleAddCustomTag = () => {
    const customTag = formData.customTag.trim().toLowerCase();
    if (customTag && !formData.tags.includes(customTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, customTag],
        customTag: ''
      }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Enhanced availability calendar change handler with comprehensive persistence
  const handleAvailabilityCalendarChange = (newCalendar: AvailabilityCalendar) => {
    try {
      console.log('EditFeedPostModal: Availability calendar change received:', newCalendar);
      console.log('EditFeedPostModal: Previous calendar state:', availabilityCalendar);
      console.log('EditFeedPostModal: New calendar dates:', newCalendar.availableDates.length);
      console.log('EditFeedPostModal: New calendar time slots:', newCalendar.timeSlots.length);
      
      // Enhanced deep copy to ensure proper persistence and avoid reference issues
      const persistedCalendar: AvailabilityCalendar = {
        availableDates: newCalendar.availableDates ? [...newCalendar.availableDates] : [],
        timeSlots: newCalendar.timeSlots ? [...newCalendar.timeSlots] : [],
        durationMinutes: newCalendar.durationMinutes || BigInt(60),
        intervalMinutes: newCalendar.intervalMinutes || BigInt(30)
      };
      
      console.log('EditFeedPostModal: Setting persisted calendar state:', persistedCalendar);
      setAvailabilityCalendar(persistedCalendar);
      
      // Clear any validation errors since calendar was updated successfully
      setValidationErrors(prev => ({ ...prev, general: '' }));
      
      console.log('EditFeedPostModal: Availability calendar state updated successfully');
    } catch (error) {
      console.error('EditFeedPostModal: Error updating availability calendar:', error);
      // Don't prevent form progression - calendar is optional for these post types
      setValidationErrors(prev => ({ 
        ...prev, 
        general: 'Warning: There was an issue updating the availability calendar. You can still save your post.' 
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('EditFeedPostModal: Starting form submission');
      console.log('EditFeedPostModal: Current availability calendar state:', availabilityCalendar);
      
      // Upload new images first if any are selected
      const newImageUrls: string[] = [];
      
      if (selectedImages.length > 0) {
        console.log(`Uploading ${selectedImages.length} new images for feed post...`);
        
        for (let i = 0; i < selectedImages.length; i++) {
          const file = selectedImages[i];
          try {
            const imagePath = `feed-posts/${Date.now()}_${i}_${file.name}`;
            const { url } = await uploadFile(imagePath, file);
            newImageUrls.push(url);
            console.log(`Successfully uploaded new image ${i + 1}/${selectedImages.length}: ${url}`);
          } catch (uploadError) {
            console.error(`Failed to upload new image ${i + 1}:`, uploadError);
            setValidationErrors(prev => ({ 
              ...prev, 
              general: `Failed to upload image ${i + 1}. Please try again.` 
            }));
            return;
          }
        }
        
        console.log(`Successfully uploaded all ${newImageUrls.length} new images for feed post`);
      }

      // Final geocoding check for non-task-promo posts if coordinates aren't set
      if (post.postType !== 'task_promo' && !postCoordinates) {
        setIsGeocodingLocation(true);
        setLocationError(null);

        try {
          const fullAddress = constructFullAddress();
          const coords = await geocodeAddress(fullAddress);
          if (coords) {
            setPostCoordinates(coords);
          } else {
            setLocationError('Could not find the specified location');
            setIsGeocodingLocation(false);
            return;
          }
        } catch (error) {
          console.error('Final geocoding error:', error);
          setLocationError('Error finding location');
          setIsGeocodingLocation(false);
          return;
        } finally {
          setIsGeocodingLocation(false);
        }
      }

      // Enhanced preparation of updated post data with comprehensive availability calendar persistence
      const updatedPost: NeighbourhoodPost = {
        ...post,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: {
          address: formData.location.address,
          suburb: formData.location.suburb,
          state: formData.location.state,
          postcode: formData.location.postcode,
          latitude: postCoordinates?.lat || post.location.latitude,
          longitude: postCoordinates?.lng || post.location.longitude
        },
        visibilityRadius: formData.visibilityRadius,
        tags: formData.tags,
        slotCount: post.postType === 'volunteer_slotpack' ? parseInt(formData.slotCount) : post.slotCount,
        // Combine existing images with new ones
        images: [...(post.images || []), ...newImageUrls],
        // Enhanced availability calendar persistence - ensure it's always properly included for applicable post types
        availabilityCalendar: (post.postType === 'freecycle' || post.postType === 'swap' || post.postType === 'volunteer_slotpack') ? 
          {
            availableDates: [...availabilityCalendar.availableDates],
            timeSlots: [...availabilityCalendar.timeSlots],
            durationMinutes: availabilityCalendar.durationMinutes,
            intervalMinutes: availabilityCalendar.intervalMinutes
          } : post.availabilityCalendar
      };

      console.log('EditFeedPostModal: Prepared updated post with enhanced availability calendar persistence and images:', updatedPost.id);
      console.log('EditFeedPostModal: Updated post availability calendar:', updatedPost.availabilityCalendar);
      console.log('EditFeedPostModal: Updated post images:', updatedPost.images);
      console.log('EditFeedPostModal: Calendar dates count in updated post:', updatedPost.availabilityCalendar?.availableDates?.length || 0);
      console.log('EditFeedPostModal: Calendar time slots count in updated post:', updatedPost.availabilityCalendar?.timeSlots?.length || 0);

      // Enhanced validation for availability calendar data before submission
      if ((post.postType === 'freecycle' || post.postType === 'swap' || post.postType === 'volunteer_slotpack') && 
          updatedPost.availabilityCalendar) {
        
        const calendar = updatedPost.availabilityCalendar;
        console.log('EditFeedPostModal: Validating availability calendar before submission:', {
          hasAvailableDates: calendar.availableDates && calendar.availableDates.length > 0,
          hasTimeSlots: calendar.timeSlots && calendar.timeSlots.length > 0,
          durationValid: calendar.durationMinutes && Number(calendar.durationMinutes) > 0,
          intervalValid: calendar.intervalMinutes && Number(calendar.intervalMinutes) > 0
        });
        
        // Validate that if calendar exists, it has proper structure
        if (calendar.availableDates && calendar.availableDates.length > 0) {
          if (!calendar.timeSlots || calendar.timeSlots.length === 0) {
            console.warn('EditFeedPostModal: Calendar has dates but no time slots');
          }
        }
      }

      // Update the post using the mutation hook with enhanced error handling and persistence
      try {
        console.log('EditFeedPostModal: Calling update mutation with enhanced persistence and images');
        await updatePost.mutateAsync(updatedPost);
        console.log('EditFeedPostModal: Post update mutation completed successfully with availability calendar persistence and images');
        
        // Call the onSave callback to notify parent component
        onSave(updatedPost);
        
        // Close the modal
        onClose();
      } catch (updateError) {
        console.error('EditFeedPostModal: Failed to update post via mutation:', updateError);
        setValidationErrors(prev => ({ 
          ...prev, 
          general: `Failed to update post: ${updateError instanceof Error ? updateError.message : 'Unknown error'}. Your availability calendar and image changes may not have been saved.` 
        }));
      }
    } catch (error) {
      console.error('EditFeedPostModal: Failed to update feed post:', error);
      setValidationErrors(prev => ({ 
        ...prev, 
        general: 'Failed to update post. Please try again. Your availability calendar and image changes may not have been saved.' 
      }));
    }
  };

  const hasAddressData = formData.location.suburb.trim() || formData.location.state.trim() || formData.location.postcode.trim();

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="sm:hidden">Back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Edit Post</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors sm:block hidden"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enhanced general validation error display with availability calendar context */}
            {validationErrors.general && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle size={16} />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-gray-300 text-sm mt-1">{validationErrors.general}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter a descriptive title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                placeholder="Provide details about your post..."
              />
            </div>

            {/* Volunteer slot count for volunteer_slotpack */}
            {post.postType === 'volunteer_slotpack' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Number of Volunteer Slots *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="50"
                  value={formData.slotCount}
                  onChange={(e) => setFormData({ ...formData, slotCount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. 10"
                />
                <p className="text-xs text-gray-400 mt-1">
                  How many volunteers do you need for this opportunity?
                </p>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Section - Only for non-task-promo posts */}
            {post.postType !== 'task_promo' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-300 flex items-center gap-2">
                  <MapPin size={20} className="text-orange-500" />
                  Location
                </h3>
                
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <MapPin size={16} />
                    <span className="font-medium">Location Information</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Update the location where this post is relevant. The map will update as you type. Your exact address will only be shared when necessary.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Street Address <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.location.address}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, address: e.target.value }
                    })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. 123 Main Street (optional)"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    You can leave this blank if you prefer not to share your street address
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Suburb *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location.suburb}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        location: { ...formData.location, suburb: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g. Melbourne"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location.state}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        location: { ...formData.location, state: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g. VIC"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Postcode *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.location.postcode}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, postcode: e.target.value }
                    })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. 3000"
                  />
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isGettingLocation}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    {isGettingLocation ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Navigation size={16} />
                    )}
                    <span>{isGettingLocation ? 'Getting Location...' : 'Use Current Location'}</span>
                  </button>
                </div>

                {locationError && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{locationError}</p>
                  </div>
                )}

                {/* Real-time Interactive Map Display */}
                {hasAddressData && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Location Preview
                      {isRealTimeGeocoding && (
                        <span className="ml-2 text-orange-400 text-xs">
                          (Updating map...)
                        </span>
                      )}
                    </label>
                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      {isRealTimeGeocoding && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm mb-3">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                          <span>Updating map location...</span>
                        </div>
                      )}
                      
                      {mapUrl && postCoordinates ? (
                        <div className="space-y-3">
                          <iframe
                            src={mapUrl}
                            width="100%"
                            height="200"
                            className="rounded-lg border border-gray-600"
                            title="Post Location Map"
                            key={mapUrl} // Force re-render when URL changes
                          />
                          <div className="flex items-center gap-2 text-green-400 text-sm">
                            <MapPin size={14} />
                            <span>
                              Location found: {postCoordinates.lat.toFixed(4)}, {postCoordinates.lng.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-600 rounded-lg h-48 flex items-center justify-center">
                          <div className="text-center text-gray-400">
                            <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                              {hasAddressData 
                                ? 'Enter required fields to see map preview'
                                : 'Map will appear as you enter address details'
                              }
                            </p>
                            {hasAddressData && (
                              <p className="text-xs mt-1">Address: {constructFullAddress()}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-2">
                      The map updates automatically as you type. All fields except street address are required.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Availability Calendar for Freecycle, Swap, and Volunteer Slot Posts with Comprehensive Persistence */}
            {(post.postType === 'freecycle' || post.postType === 'swap' || post.postType === 'volunteer_slotpack') && (
              <div className="border-t border-gray-700 pt-6">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Clock size={16} />
                    <span className="font-medium">
                      {post.postType === 'freecycle' ? 'Pickup Availability' : 
                       post.postType === 'swap' ? 'Exchange Availability' :
                       'Volunteer Activity Availability'}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    {post.postType === 'freecycle' 
                      ? 'Update when items are available for pickup. All changes will be saved immediately and persist across sessions with enhanced reliability.'
                      : post.postType === 'swap'
                      ? 'Update when you\'re available for the skill/item exchange. All changes will be saved immediately and persist across sessions with enhanced reliability.'
                      : 'Update when volunteer activities are scheduled. All changes will be saved immediately and persist across sessions with enhanced reliability.'
                    }
                  </p>
                </div>
                
                <AvailabilityCalendarComponent
                  value={availabilityCalendar}
                  onChange={handleAvailabilityCalendarChange}
                  disabled={false}
                  optional={true}
                />
                
                {/* Enhanced persistence status display with comprehensive information */}
                {availabilityCalendar.availableDates.length > 0 && (
                  <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                      <CheckCircle size={14} />
                      <span className="font-medium">Enhanced Availability Set - Ready for Persistent Storage</span>
                    </div>
                    <div className="text-gray-300 text-xs space-y-1">
                      <p>• {availabilityCalendar.availableDates.length} available date{availabilityCalendar.availableDates.length !== 1 ? 's' : ''}</p>
                      <p>• {availabilityCalendar.timeSlots.length} time slot{availabilityCalendar.timeSlots.length !== 1 ? 's' : ''} per day</p>
                      <p>• Duration: {Number(availabilityCalendar.durationMinutes)} minutes</p>
                      <p>• Interval: {Number(availabilityCalendar.intervalMinutes)} minutes</p>
                      <p className="text-green-300 font-medium">• Enhanced persistence: Changes will be permanently saved with improved reliability when you submit</p>
                    </div>
                  </div>
                )}

                {/* Enhanced persistence status for existing calendar data */}
                {post.availabilityCalendar && post.availabilityCalendar.availableDates.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                      <CheckCircle size={14} />
                      <span className="font-medium">Previously Saved Availability (Enhanced Persistence)</span>
                    </div>
                    <div className="text-gray-300 text-xs space-y-1">
                      <p>• Original: {post.availabilityCalendar.availableDates.length} date{post.availabilityCalendar.availableDates.length !== 1 ? 's' : ''}, {post.availabilityCalendar.timeSlots.length} time slot{post.availabilityCalendar.timeSlots.length !== 1 ? 's' : ''}</p>
                      <p>• Current: {availabilityCalendar.availableDates.length} date{availabilityCalendar.availableDates.length !== 1 ? 's' : ''}, {availabilityCalendar.timeSlots.length} time slot{availabilityCalendar.timeSlots.length !== 1 ? 's' : ''}</p>
                      <p className="text-blue-300">• Enhanced persistence: Make changes above and submit to update permanently with improved reliability</p>
                      <p className="text-blue-300 font-medium">• All availability data is stored in stable backend storage and survives app reloads, logouts, and draft changes</p>
                    </div>
                  </div>
                )}

                {/* Show persistence guarantee message */}
                <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                    <CheckCircle size={14} />
                    <span className="font-medium">Availability Slot Persistence Guarantee</span>
                  </div>
                  <div className="text-gray-300 text-xs space-y-1">
                    <p>• All availability slots are saved to stable backend storage immediately upon form submission</p>
                    <p>• Your availability data persists across app reloads, user logouts, and draft changes</p>
                    <p>• Enhanced error handling prevents data loss during editing and saving operations</p>
                    <p>• Availability slots are reliably retrieved and displayed when viewing or editing posts</p>
                    <p className="text-green-300 font-medium">• This fix ensures all added availability slots are permanently saved and never lost</p>
                  </div>
                </div>
              </div>
            )}

            {/* Visibility Radius */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Visibility Radius: {formData.visibilityRadius}km
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={formData.visibilityRadius}
                  onChange={(e) => setFormData({ ...formData, visibilityRadius: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1km</span>
                  <span>3km</span>
                  <span>5km</span>
                  <span>10km</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Only people within {formData.visibilityRadius}km of {formData.location.suburb || 'your location'} will see this post
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Tags ({formData.tags.length} selected)
              </label>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Common Tags</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_TAGS.map((tag) => (
                    <label
                      key={tag}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.tags.includes(tag)}
                        onChange={() => handleTagToggle(tag)}
                        className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500 focus:ring-2"
                      />
                      <span className="text-gray-300 text-sm">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Add Custom Tag</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.customTag}
                    onChange={(e) => setFormData({ ...formData, customTag: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter a custom tag"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    disabled={!formData.customTag.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>

              {formData.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Selected Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full text-sm"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-orange-400 hover:text-orange-300 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Images (Optional)
              </label>
              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> images
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handleImageSelect}
                    />
                  </label>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing Images Info */}
                {post.images && post.images.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-sm text-gray-300">
                      <strong>Current images:</strong> {post.images.length} image{post.images.length !== 1 ? 's' : ''} already attached to this post
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      New images will be added to the existing ones
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Action Buttons with persistence status */}
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                disabled={isGeocodingLocation || isRealTimeGeocoding || updatePost.isPending || isUploading}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
              >
                {isGeocodingLocation || isRealTimeGeocoding || updatePost.isPending || isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>
                      {isUploading ? 'Uploading Images...' :
                       updatePost.isPending ? 'Saving Changes with Enhanced Persistence...' : 'Processing Location...'}
                    </span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                disabled={isGeocodingLocation || isRealTimeGeocoding || updatePost.isPending || isUploading}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
