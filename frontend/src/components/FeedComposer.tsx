import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, ArrowRight, Users, Megaphone, Heart, Gift, HandHeart, MapPin, Eye, Upload, Trash2, Navigation, AlertCircle, Tag, Clock, CheckCircle } from 'lucide-react';
import { useGetTasks, useGetCallerUserProfile, useCreateNeighbourhoodPost } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Task, TaskType, FeedPostType, AvailabilityCalendar } from '../backend';
import { NeighbourhoodPost } from '../hooks/useQueries';
import { useFileUpload } from '../blob-storage/FileStorage';
import AvailabilityCalendarComponent from './AvailabilityCalendar';

interface FeedComposerProps {
  onClose: () => void;
}

type PostType = 'task_promo' | 'swap' | 'freecycle' | 'notice' | 'volunteer_slotpack';

interface PostFormData {
  postType: PostType | null;
  title: string;
  description: string;
  category: string;
  taskId: string; // For task_promo
  slotCount: string; // For volunteer_slotpack
  location: {
    address: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  postLocation: string; // Legacy field for backwards compatibility
  postCoordinates: { lat: number; lng: number } | null; // Geocoded coordinates
  visibilityRadius: number;
  tags: string[];
  customTag: string;
}

const POST_TYPES = [
  {
    type: 'task_promo' as PostType,
    title: 'Promote a Task',
    description: 'Boost visibility for one of your existing tasks',
    icon: Megaphone,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10 border-orange-500/30'
  },
  {
    type: 'swap' as PostType,
    title: 'Skill/Item Swap',
    description: 'Trade skills or items with neighbours',
    icon: Heart,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 border-purple-500/30'
  },
  {
    type: 'freecycle' as PostType,
    title: 'Freecycle',
    description: 'Give away items for free to the community',
    icon: Gift,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 border-green-500/30'
  },
  {
    type: 'notice' as PostType,
    title: 'Community Notice',
    description: 'Share announcements or information',
    icon: Megaphone,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30'
  },
  {
    type: 'volunteer_slotpack' as PostType,
    title: 'Volunteer Slots',
    description: 'Create multiple volunteer opportunities',
    icon: HandHeart,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10 border-pink-500/30'
  }
];

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

// Reverse geocoding function
const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Taskmate/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Reverse geocoding request failed');
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      const addressParts: string[] = [];
      
      if (data.address.suburb) {
        addressParts.push(data.address.suburb);
      } else if (data.address.city) {
        addressParts.push(data.address.city);
      } else if (data.address.town) {
        addressParts.push(data.address.town);
      } else if (data.address.village) {
        addressParts.push(data.address.village);
      }
      
      if (data.address.state) {
        addressParts.push(data.address.state);
      }
      
      if (data.address.country && addressParts.length < 2) {
        addressParts.push(data.address.country);
      }
      
      return addressParts.length > 0 ? addressParts.join(', ') : data.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

export default function FeedComposer({ onClose }: FeedComposerProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: tasks = [] } = useGetTasks();
  const createPost = useCreateNeighbourhoodPost();
  const { uploadFile, isUploading } = useFileUpload();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PostFormData>({
    postType: null,
    title: '',
    description: '',
    category: '',
    taskId: '',
    slotCount: '',
    location: {
      address: '',
      suburb: '',
      state: '',
      postcode: ''
    },
    postLocation: '', // Legacy field for backwards compatibility
    postCoordinates: null, // Geocoded coordinates
    visibilityRadius: 5,
    tags: [],
    customTag: ''
  });

  // Availability calendar state for freecycle, swap, and volunteer slot posts with safe initialization
  const [availabilityCalendar, setAvailabilityCalendar] = useState<AvailabilityCalendar>({
    availableDates: [],
    timeSlots: [],
    durationMinutes: BigInt(60),
    intervalMinutes: BigInt(30)
  });

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    general: '',
    images: ''
  });
  
  // Real-time geocoding state
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isRealTimeGeocoding, setIsRealTimeGeocoding] = useState(false);
  const geocodingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simplified calendar state - no error tracking needed since it's optional
  const [calendarSkipped, setCalendarSkipped] = useState(false);

  // Get user's tasks for task promotion
  const userTasks = tasks.filter(task => 
    identity && task.requester.toString() === identity.getPrincipal().toString() && 
    task.status === 'open' && !task.isArchived
  );

  // Get selected post type configuration
  const selectedType = POST_TYPES.find(t => t.type === formData.postType);

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
    if (formData.postType === 'task_promo' || currentStep !== 3) {
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
      setFormData(prev => ({ ...prev, postCoordinates: null }));
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
            setFormData(prev => ({
              ...prev,
              postCoordinates: coords
            }));
            
            // Create map URL for real-time display
            const newMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.01},${coords.lat - 0.01},${coords.lng + 0.01},${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat},${coords.lng}`;
            setMapUrl(newMapUrl);
          } else {
            setLocationError('Could not find the specified location');
            setMapUrl(null);
            setFormData(prev => ({ ...prev, postCoordinates: null }));
          }
        } catch (error) {
          console.error('Real-time geocoding error:', error);
          setLocationError('Error finding location');
          setMapUrl(null);
          setFormData(prev => ({ ...prev, postCoordinates: null }));
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
  }, [formData.location.address, formData.location.suburb, formData.location.state, formData.location.postcode, formData.postType, currentStep]);

  const handlePostTypeSelect = (postType: PostType) => {
    setFormData({ ...formData, postType });
    setCurrentStep(2);
    // Reset all error states when changing post type
    setValidationErrors({ general: '', images: '' });
    setCalendarSkipped(false);
    
    // Reset availability calendar for freecycle, swap, and volunteer slot posts
    if (postType === 'freecycle' || postType === 'swap' || postType === 'volunteer_slotpack') {
      setAvailabilityCalendar({
        availableDates: [],
        timeSlots: [],
        durationMinutes: BigInt(60),
        intervalMinutes: BigInt(30)
      });
    }

    // Reset image state when changing post type
    setSelectedImages([]);
    setImagePreviews([]);
    setUploadedImageUrls([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      // Validate file sizes (max 5MB each)
      const oversizedFiles = imageFiles.filter(file => file.size > 5 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        setValidationErrors(prev => ({ 
          ...prev, 
          images: `${oversizedFiles.length} file(s) exceed 5MB limit. Please select smaller images.` 
        }));
        return;
      }

      setSelectedImages(prev => [...prev, ...imageFiles]);
      setValidationErrors(prev => ({ ...prev, images: '' }));
      
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
    // Also remove from uploaded URLs if it was already uploaded
    if (index < uploadedImageUrls.length) {
      setUploadedImageUrls(prev => prev.filter((_, i) => i !== index));
    }
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
          setFormData(prev => ({
            ...prev,
            postCoordinates: { lat: latitude, lng: longitude }
          }));
          
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

  // Safe availability calendar change handler - never blocks form progression
  const handleAvailabilityCalendarChange = (newCalendar: AvailabilityCalendar) => {
    try {
      setAvailabilityCalendar(newCalendar);
    } catch (error) {
      console.error('Error updating availability calendar:', error);
      // Don't prevent form progression - calendar is optional for freecycle, swap, and volunteer slot posts
    }
  };

  // Enhanced step validation with better error handling
  const canProceedToStep3 = (): boolean => {
    if (!formData.postType) return false;
    
    try {
      switch (formData.postType) {
        case 'task_promo':
          return formData.taskId.trim() !== '';
        case 'volunteer_slotpack':
          return formData.title.trim() !== '' && formData.description.trim() !== '' && 
                 formData.slotCount.trim() !== '' && parseInt(formData.slotCount) > 0;
        case 'freecycle':
        case 'swap':
          // For freecycle and swap, only validate basic fields - calendar is optional
          return formData.title.trim() !== '' && formData.description.trim() !== '';
        default:
          return formData.title.trim() !== '' && formData.description.trim() !== '';
      }
    } catch (error) {
      console.error('Error checking step 3 requirements:', error);
      return false;
    }
  };

  const canProceedToStep4 = (): boolean => {
    try {
      // For task promotions, use existing task location validation (no additional input needed)
      if (formData.postType === 'task_promo') {
        return true; // Task promotions don't need additional location input
      }
      
      // For other post types, require structured address fields (all except street address)
      const hasRequiredLocation = formData.location.suburb.trim() !== '' && 
                                 formData.location.state.trim() !== '' && 
                                 formData.location.postcode.trim() !== '';

      return hasRequiredLocation;
    } catch (error) {
      console.error('Error checking step 4 requirements:', error);
      return false;
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) {
      return [];
    }

    console.log(`Starting upload of ${selectedImages.length} images for feed post...`);
    const imageUrls: string[] = [];
    
    try {
      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        console.log(`Uploading image ${i + 1}/${selectedImages.length}: ${file.name}`);
        
        try {
          const imagePath = `feed-posts/${Date.now()}_${i}_${file.name}`;
          const { url } = await uploadFile(imagePath, file);
          imageUrls.push(url);
          console.log(`Successfully uploaded image ${i + 1}/${selectedImages.length}: ${url}`);
        } catch (uploadError) {
          console.error(`Failed to upload image ${i + 1}:`, uploadError);
          throw new Error(`Failed to upload image ${i + 1}: ${file.name}`);
        }
      }
      
      console.log(`Successfully uploaded all ${imageUrls.length} images for feed post`);
      setUploadedImageUrls(imageUrls);
      return imageUrls;
    } catch (error) {
      console.error('Image upload process failed:', error);
      setValidationErrors(prev => ({ 
        ...prev, 
        images: error instanceof Error ? error.message : 'Failed to upload images. Please try again.' 
      }));
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!identity) {
      console.error('User not authenticated');
      setValidationErrors(prev => ({ ...prev, general: 'Please log in to create a post.' }));
      return;
    }

    try {
      setValidationErrors({ general: '', images: '' });

      // Upload images first if any are selected
      let imageUrls: string[] = [];
      
      if (selectedImages.length > 0) {
        try {
          imageUrls = await uploadImages();
        } catch (uploadError) {
          // Error already set in uploadImages function
          return;
        }
      }

      // Final geocoding check for non-task-promo posts if coordinates aren't set
      if (formData.postType !== 'task_promo' && !formData.postCoordinates) {
        setIsGeocodingLocation(true);
        setLocationError(null);

        try {
          const fullAddress = constructFullAddress();
          const coords = await geocodeAddress(fullAddress);
          if (coords) {
            setFormData(prev => ({
              ...prev,
              postCoordinates: coords
            }));
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

      // Prepare the post data for submission
      let postLocation = { lat: 0, lng: 0 };
      
      if (formData.postType === 'task_promo' && formData.taskId) {
        // Use task location for task promotions
        const selectedTask = tasks.find(t => t.id === formData.taskId);
        if (selectedTask) {
          postLocation = { lat: selectedTask.latitude, lng: selectedTask.longitude };
        }
      } else if (formData.postCoordinates) {
        // Use geocoded coordinates for other post types
        postLocation = formData.postCoordinates;
      }

      const postData: Omit<NeighbourhoodPost, 'id' | 'author' | 'createdAt'> = {
        postType: formData.postType!,
        title: formData.postType === 'task_promo' && formData.taskId ? 
          tasks.find(t => t.id === formData.taskId)?.title || formData.title : 
          formData.title,
        description: formData.postType === 'task_promo' && formData.taskId ? 
          tasks.find(t => t.id === formData.taskId)?.description || formData.description : 
          formData.description,
        category: formData.category,
        location: formData.postType === 'task_promo' && formData.taskId ? {
          // Use task location for task promotions
          address: tasks.find(t => t.id === formData.taskId)?.address || '',
          suburb: tasks.find(t => t.id === formData.taskId)?.address.split(',')[1]?.trim() || '',
          state: tasks.find(t => t.id === formData.taskId)?.address.split(',')[2]?.trim() || '',
          postcode: tasks.find(t => t.id === formData.taskId)?.address.split(',')[3]?.trim() || '',
          latitude: postLocation.lat,
          longitude: postLocation.lng
        } : {
          address: formData.location.address,
          suburb: formData.location.suburb,
          state: formData.location.state,
          postcode: formData.location.postcode,
          latitude: postLocation.lat,
          longitude: postLocation.lng
        },
        visibilityRadius: formData.visibilityRadius,
        taskId: formData.postType === 'task_promo' ? formData.taskId : undefined,
        slotCount: formData.postType === 'volunteer_slotpack' ? parseInt(formData.slotCount) : undefined,
        pledgedSlots: formData.postType === 'volunteer_slotpack' ? 0 : undefined,
        images: imageUrls, // Include uploaded image URLs
        tags: formData.tags,
        isSaved: false,
        commentCount: 0,
        // Include availability calendar for freecycle, swap, and volunteer slot posts only if it has data and wasn't skipped
        availabilityCalendar: ((formData.postType === 'freecycle' || formData.postType === 'swap' || formData.postType === 'volunteer_slotpack') && 
                              !calendarSkipped && availabilityCalendar.availableDates.length > 0) ? 
                              availabilityCalendar : undefined
      };

      console.log('Creating feed post with uploaded images:', imageUrls);

      // Submit the post to backend
      await createPost.mutateAsync(postData);
      
      // Close the composer
      onClose();
    } catch (error) {
      console.error('Failed to create feed post:', error);
      setValidationErrors(prev => ({ ...prev, general: 'Failed to create post. Please try again.' }));
    }
  };

  const hasAddressData = formData.location.suburb.trim() || formData.location.state.trim() || formData.location.postcode.trim();

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Choose Post Type</h3>
              <p className="text-gray-400">What would you like to share with your community?</p>
            </div>

            <div className="space-y-3">
              {POST_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.type}
                    onClick={() => handlePostTypeSelect(type.type)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left hover:border-gray-500 ${type.bgColor}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <Icon size={24} className={type.color} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">{type.title}</h4>
                        <p className="text-gray-400 text-sm">{type.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        const Icon = selectedType?.icon || Users;
        
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Icon size={24} className={selectedType?.color} />
                <h3 className="text-xl font-bold text-white">{selectedType?.title}</h3>
              </div>
              <p className="text-gray-400">Fill in the details for your post</p>
            </div>

            {/* General validation error display */}
            {validationErrors.general && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle size={16} />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-gray-300 text-sm mt-1">{validationErrors.general}</p>
              </div>
            )}

            {/* Image validation error display */}
            {validationErrors.images && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle size={16} />
                  <span className="font-medium">Image Upload Error</span>
                </div>
                <p className="text-gray-300 text-sm mt-1">{validationErrors.images}</p>
              </div>
            )}

            {/* Task Promotion - Select existing task */}
            {formData.postType === 'task_promo' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select Task to Promote *
                </label>
                {userTasks.length === 0 ? (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                      <AlertCircle size={16} />
                      <span className="font-medium">No Available Tasks</span>
                    </div>
                    <p className="text-gray-300 text-sm">
                      You need to have open tasks to promote them. Create a task first, then come back to promote it.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {userTasks.map((task) => (
                      <label
                        key={task.id}
                        className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.taskId === task.id
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="taskId"
                          value={task.id}
                          checked={formData.taskId === task.id}
                          onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                          className="sr-only"
                        />
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-1">{task.title}</h4>
                            <p className="text-gray-400 text-sm line-clamp-2 mb-2">{task.description}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{task.category}</span>
                              {task.taskType === TaskType.paid ? (
                                <span className="text-orange-500 font-bold text-sm">
                                  ${(Number(task.budget) / 100).toLocaleString()}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                                  <Heart size={10} />
                                  <span>Volunteer</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Regular post fields for other types */}
            {formData.postType !== 'task_promo' && (
              <>
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
                    placeholder={
                      formData.postType === 'swap' ? 'e.g. Trade: Web design for plumbing help' :
                      formData.postType === 'freecycle' ? 'e.g. Free: Moving boxes and packing materials' :
                      formData.postType === 'notice' ? 'e.g. Road closure on Main Street this weekend' :
                      formData.postType === 'volunteer_slotpack' ? 'e.g. Community Garden Cleanup Day' :
                      'Enter a descriptive title'
                    }
                  />
                </div>

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
                    placeholder={
                      formData.postType === 'swap' ? 'Describe what you\'re offering and what you need in return...' :
                      formData.postType === 'freecycle' ? 'Describe the items you\'re giving away and pickup details...' :
                      formData.postType === 'notice' ? 'Provide details about the announcement or information...' :
                      formData.postType === 'volunteer_slotpack' ? 'Describe the volunteer opportunity and what help is needed...' :
                      'Provide details about your post...'
                    }
                  />
                </div>

                {/* Volunteer slot count */}
                {formData.postType === 'volunteer_slotpack' && (
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
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each</p>
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

                    {selectedImages.length > 0 && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                          <CheckCircle size={14} />
                          <span className="font-medium">Images Ready for Upload</span>
                        </div>
                        <p className="text-gray-300 text-xs">
                          {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected. 
                          Images will be uploaded and permanently saved when you publish your post.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Availability Calendar for Freecycle, Swap, and Volunteer Slot Posts - Enhanced with comprehensive error handling */}
                {(formData.postType === 'freecycle' || formData.postType === 'swap' || formData.postType === 'volunteer_slotpack') && (
                  <div className="border-t border-gray-700 pt-6">
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <Clock size={16} />
                        <span className="font-medium">
                          {formData.postType === 'freecycle' ? 'Pickup Availability' : 
                           formData.postType === 'swap' ? 'Exchange Availability' :
                           'Volunteer Activity Availability'}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm">
                        {formData.postType === 'freecycle' 
                          ? 'Specify when items are available for pickup. This information will be saved with your post and visible to interested users.'
                          : formData.postType === 'swap'
                          ? 'Specify when you\'re available for the skill/item exchange. This information will be saved with your post and visible to interested users.'
                          : 'Specify when volunteer activities are scheduled. This information will be saved with your post and visible to interested volunteers.'
                        }
                      </p>
                    </div>
                    
                    <AvailabilityCalendarComponent
                      value={availabilityCalendar}
                      onChange={handleAvailabilityCalendarChange}
                      disabled={false}
                      optional={true} // Make it truly optional for freecycle, swap, and volunteer slot posts
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MapPin size={24} className="text-orange-500" />
                <h3 className="text-xl font-bold text-white">Set Location</h3>
              </div>
              <p className="text-gray-400">
                {formData.postType === 'task_promo' 
                  ? 'Task promotions use the existing task location' 
                  : 'Enter the location for your post'
                }
              </p>
            </div>

            {/* Task Promotion - Show existing task location info */}
            {formData.postType === 'task_promo' && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <MapPin size={16} />
                  <span className="font-medium">Using Task Location</span>
                </div>
                <p className="text-gray-300 text-sm">
                  This post will use the location from your selected task. No additional location input is needed.
                </p>
              </div>
            )}

            {/* Structured Address Input for other post types with real-time map */}
            {formData.postType !== 'task_promo' && (
              <div className="space-y-4">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <MapPin size={16} />
                    <span className="font-medium">Location Information</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Enter the location where this post is relevant. The map will update as you type. Your exact address will only be shared when necessary.
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
                      
                      {mapUrl && formData.postCoordinates ? (
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
                              Location found: {formData.postCoordinates.lat.toFixed(4)}, {formData.postCoordinates.lng.toFixed(4)}
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
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Eye size={24} className="text-orange-500" />
                <h3 className="text-xl font-bold text-white">Visibility & Tags</h3>
              </div>
              <p className="text-gray-400">Set who can see your post and add tags</p>
            </div>

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
                Only people within {formData.visibilityRadius}km of {
                  formData.postType === 'task_promo' 
                    ? 'the task location' 
                    : (formData.location.suburb || 'your location')
                } will see this post
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
          </div>
        );

      case 5:
        const selectedTaskForReview = formData.postType === 'task_promo' ? 
          tasks.find(t => t.id === formData.taskId) : null;
        const ReviewIcon = selectedType?.icon || Users;
        
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Review & Publish</h3>
              <p className="text-gray-400">Check your post before publishing</p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-3">
                <ReviewIcon size={16} className={selectedType?.color} />
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${selectedType?.bgColor}`}>
                  {selectedType?.title}
                </span>
              </div>

              <h4 className="text-white font-semibold mb-2">
                {formData.postType === 'task_promo' && selectedTaskForReview ? 
                  selectedTaskForReview.title : formData.title}
              </h4>
              
              <p className="text-gray-300 text-sm mb-3 line-clamp-3">
                {formData.postType === 'task_promo' && selectedTaskForReview ? 
                  selectedTaskForReview.description : formData.description}
              </p>

              {/* Show image previews in review */}
              {imagePreviews.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-gray-400 text-sm mb-2">Images ({imagePreviews.length})</h5>
                  <div className="grid grid-cols-3 gap-2">
                    {imagePreviews.slice(0, 3).map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-16 object-cover rounded-lg border border-gray-600"
                        />
                        {index === 2 && imagePreviews.length > 3 && (
                          <div className="absolute inset-0 bg-black bg-opacity-60 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-medium">+{imagePreviews.length - 3}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 text-xs">
                      <CheckCircle size={12} />
                      <span className="font-medium">Images will be uploaded and permanently saved with your post</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <MapPin size={12} />
                  <span>
                    {formData.postType === 'task_promo' && selectedTaskForReview
                      ? `${selectedTaskForReview.address.split(',').slice(-3, -1).join(', ')}`
                      : `${formData.location.suburb}, ${formData.location.state}`
                    }
                  </span>
                  <span>• {formData.visibilityRadius}km radius</span>
                </div>
                
                {formData.category && (
                  <div className="flex items-center gap-1">
                    <Tag size={12} />
                    <span>{formData.category}</span>
                  </div>
                )}

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Show coordinates for non-task-promo posts */}
                {formData.postType !== 'task_promo' && formData.postCoordinates && (
                  <div className="flex items-center gap-1 text-green-400">
                    <MapPin size={12} />
                    <span>
                      Coordinates: {formData.postCoordinates.lat.toFixed(4)}, {formData.postCoordinates.lng.toFixed(4)}
                    </span>
                  </div>
                )}

                {/* Show availability summary for freecycle, swap, and volunteer slot posts - with safe handling */}
                {(formData.postType === 'freecycle' || formData.postType === 'swap' || formData.postType === 'volunteer_slotpack') && 
                 !calendarSkipped && availabilityCalendar && availabilityCalendar.availableDates && 
                 availabilityCalendar.availableDates.length > 0 && (
                  <div className="flex items-center gap-1 text-green-400">
                    <Clock size={12} />
                    <span>
                      {formData.postType === 'freecycle' ? 'Pickup' : 
                       formData.postType === 'swap' ? 'Exchange' : 
                       'Activity'} availability: {availabilityCalendar.availableDates.length} date{availabilityCalendar.availableDates.length !== 1 ? 's' : ''}, {availabilityCalendar.timeSlots ? availabilityCalendar.timeSlots.length : 0} time slot{(availabilityCalendar.timeSlots ? availabilityCalendar.timeSlots.length : 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Show fallback message for freecycle, swap, and volunteer slot posts without calendar */}
                {(formData.postType === 'freecycle' || formData.postType === 'swap' || formData.postType === 'volunteer_slotpack') && 
                 (calendarSkipped || !availabilityCalendar.availableDates || availabilityCalendar.availableDates.length === 0) && (
                  <div className="flex items-center gap-1 text-blue-400">
                    <Clock size={12} />
                    <span>
                      {formData.postType === 'freecycle' ? 'Pickup' : 
                       formData.postType === 'swap' ? 'Exchange' : 
                       'Activity'} times will be arranged through messaging
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Eye size={16} />
                <span className="font-medium">Visibility</span>
              </div>
              <p className="text-gray-300 text-sm">
                This post will be visible to community members within {formData.visibilityRadius}km of{' '}
                {formData.postType === 'task_promo' 
                  ? 'the task location'
                  : `${formData.location.suburb}, ${formData.location.state}`
                }.
                Your exact address will only be shared when necessary.
              </p>
              {(formData.postType === 'freecycle' || formData.postType === 'swap' || formData.postType === 'volunteer_slotpack') && 
               !calendarSkipped && availabilityCalendar && availabilityCalendar.availableDates && 
               availabilityCalendar.availableDates.length > 0 && (
                <p className="text-gray-300 text-sm mt-2">
                  {formData.postType === 'freecycle' ? 'Items' : 
                   formData.postType === 'swap' ? 'Exchange' : 
                   'Activities'} will be available on {availabilityCalendar.availableDates.length} selected date{availabilityCalendar.availableDates.length !== 1 ? 's' : ''} 
                  during {availabilityCalendar.timeSlots ? availabilityCalendar.timeSlots.length : 0} time slot{(availabilityCalendar.timeSlots ? availabilityCalendar.timeSlots.length : 0) !== 1 ? 's' : ''}.
                </p>
              )}
              {selectedImages.length > 0 && (
                <p className="text-gray-300 text-sm mt-2">
                  {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} will be uploaded and permanently saved with your post.
                </p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStepNavigation = () => {
    return (
      <div className="flex justify-between pt-6">
        {currentStep > 1 ? (
          <button
            onClick={() => {
              setCurrentStep(currentStep - 1);
              // Clear validation errors when going back
              setValidationErrors({ general: '', images: '' });
            }}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        ) : (
          <div></div>
        )}

        {currentStep < 5 ? (
          <button
            onClick={() => {
              try {
                let canProceed = false;
                
                if (currentStep === 2) {
                  canProceed = canProceedToStep3();
                  if (!canProceed) {
                    setValidationErrors(prev => ({ ...prev, general: 'Please complete all required fields before proceeding.' }));
                  }
                } else if (currentStep === 3) {
                  canProceed = canProceedToStep4();
                  if (!canProceed) {
                    setValidationErrors(prev => ({ ...prev, general: 'Please complete the location information before proceeding.' }));
                  }
                } else {
                  canProceed = true;
                }

                if (canProceed) {
                  setCurrentStep(currentStep + 1);
                  // Clear validation errors when proceeding successfully
                  setValidationErrors({ general: '', images: '' });
                }
              } catch (error) {
                console.error('Error proceeding to next step:', error);
                setValidationErrors(prev => ({ ...prev, general: 'Error proceeding to next step. Please try again.' }));
              }
            }}
            disabled={
              (currentStep === 2 && !canProceedToStep3()) ||
              (currentStep === 3 && !canProceedToStep4())
            }
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <span>Next</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => {
              try {
                handleSubmit();
              } catch (error) {
                console.error('Error submitting post:', error);
                setValidationErrors(prev => ({ ...prev, general: 'Error creating post. Please try again.' }));
              }
            }}
            disabled={isGeocodingLocation || isRealTimeGeocoding || createPost.isPending || isUploading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
          >
            {isGeocodingLocation || isRealTimeGeocoding || createPost.isPending || isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>
                  {isUploading ? 'Uploading Images...' : 
                   createPost.isPending ? 'Publishing...' : 'Processing Location...'}
                </span>
              </>
            ) : (
              <span>Publish Post</span>
            )}
          </button>
        )}
      </div>
    );
  };

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
        <h2 className="text-lg font-bold text-white">Create Feed Post</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors sm:block hidden"
        >
          <X size={24} />
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {step}
              </div>
              {step < 5 && (
                <div className={`w-8 h-1 mx-2 ${
                  step < currentStep ? 'bg-orange-500' : 'bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center mt-2">
          <span className="text-sm text-gray-400">
            Step {currentStep} of 5: {
              currentStep === 1 ? 'Post Type' :
              currentStep === 2 ? 'Details' :
              currentStep === 3 ? 'Location' :
              currentStep === 4 ? 'Visibility' :
              'Review'
            }
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          {renderStepContent()}
          {renderStepNavigation()}
        </div>
      </div>
    </div>
  );
}
