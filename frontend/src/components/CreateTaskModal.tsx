import React, { useState } from 'react';
import { X, ArrowLeft, Upload, Trash2, MapPin, DollarSign, Heart, Calendar, AlertCircle } from 'lucide-react';
import { useCreateTask } from '../hooks/useQueries';
import { Task, TaskStatus, TaskType, AvailabilityCalendar } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useFileUpload } from '../blob-storage/FileStorage';
import { Principal } from '@dfinity/principal';
import AvailabilityCalendarComponent from './AvailabilityCalendar';

interface CreateTaskModalProps {
  onClose: () => void;
}

const PREDEFINED_CATEGORIES = [
  'Cleaning',
  'Assembly',
  'Painting',
  'Yard Work',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Moving',
  'Handyman',
  'Delivery',
  'Pet Care',
  'Tutoring',
  'Other'
];

// Geocoding function using Nominatim (OpenStreetMap)
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
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

export default function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { identity } = useInternetIdentity();
  const createTask = useCreateTask();
  const { uploadFile, isUploading } = useFileUpload();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    customCategory: '',
    taskType: TaskType.paid,
    budget: '',
    dueDate: '',
    requiredSkills: '',
    address: '',
    suburb: '',
    state: '',
    postcode: ''
  });

  const [availabilityCalendar, setAvailabilityCalendar] = useState<AvailabilityCalendar>({
    availableDates: [],
    timeSlots: [],
    durationMinutes: BigInt(60),
    intervalMinutes: BigInt(30)
  });

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    availability: ''
  });

  const handleCategoryChange = (value: string) => {
    setFormData({ 
      ...formData, 
      category: value,
      customCategory: value === 'Other' ? formData.customCategory : ''
    });
  };

  const handleTaskTypeChange = (type: TaskType) => {
    setFormData({
      ...formData,
      taskType: type,
      budget: type === TaskType.volunteer ? '' : formData.budget
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...imageFiles]);
      
      // Create previews
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

  // Construct full address from structured fields
  const constructFullAddress = () => {
    const parts = [
      formData.address.trim(),
      formData.suburb.trim(),
      formData.state.trim(),
      formData.postcode.trim()
    ].filter(part => part.length > 0);
    
    return parts.join(', ');
  };

  const validateAvailability = () => {
    if (availabilityCalendar.availableDates.length === 0) {
      setValidationErrors(prev => ({ ...prev, availability: 'Please select at least one available date' }));
      return false;
    }
    
    if (availabilityCalendar.timeSlots.length === 0) {
      setValidationErrors(prev => ({ ...prev, availability: 'Please add at least one time slot' }));
      return false;
    }
    
    setValidationErrors(prev => ({ ...prev, availability: '' }));
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identity) return;

    // Validate availability calendar
    if (!validateAvailability()) {
      return;
    }

    const finalCategory = formData.category === 'Other' && formData.customCategory 
      ? formData.customCategory 
      : formData.category;

    setIsGeocoding(true);

    try {
      // Upload images first
      const imageUrls: string[] = [];
      
      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const imagePath = `tasks/${Date.now()}_${i}_${file.name}`;
        const { url } = await uploadFile(imagePath, file);
        imageUrls.push(url);
      }

      // Construct full address for backend storage and geocoding
      const fullAddress = constructFullAddress();

      // Geocode the address to get coordinates
      let coordinates = { lat: 0, lng: 0 }; // Default coordinates
      
      if (fullAddress) {
        const geocodedCoords = await geocodeAddress(fullAddress);
        if (geocodedCoords) {
          coordinates = geocodedCoords;
        }
      }

      const task: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title,
        description: formData.description,
        category: finalCategory,
        taskType: formData.taskType,
        budget: formData.taskType === TaskType.paid ? BigInt(parseInt(formData.budget) * 100) : BigInt(0), // Convert to cents for paid tasks, 0 for volunteer
        dueDate: BigInt(new Date(formData.dueDate).getTime() * 1000000), // Convert to nanoseconds
        requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()).filter(s => s.length > 0),
        status: TaskStatus.open,
        requester: identity.getPrincipal(),
        assignedTasker: undefined,
        createdAt: BigInt(Date.now() * 1000000),
        images: imageUrls,
        isArchived: false,
        address: fullAddress, // Store constructed full address
        latitude: coordinates.lat, // Add required latitude
        longitude: coordinates.lng, // Add required longitude
        availabilityCalendar: availabilityCalendar
      };

      await createTask.mutateAsync(task);
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const hasAddressData = formData.suburb.trim() || formData.state.trim() || formData.postcode.trim();

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="sm:hidden">Back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Create New Task</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors sm:block hidden"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                placeholder="e.g. Fix leaky kitchen faucet"
              />
            </div>

            {/* Task Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Task Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTaskTypeChange(TaskType.paid)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.taskType === TaskType.paid
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign size={24} className={formData.taskType === TaskType.paid ? 'text-orange-500' : 'text-gray-400'} />
                  </div>
                  <h3 className="font-semibold mb-1">Paid Task</h3>
                  <p className="text-xs text-gray-400">Set a budget and pay for the work</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleTaskTypeChange(TaskType.volunteer)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.taskType === TaskType.volunteer
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <Heart size={24} className={formData.taskType === TaskType.volunteer ? 'text-green-500' : 'text-gray-400'} />
                  </div>
                  <h3 className="font-semibold mb-1">Volunteer Task</h3>
                  <p className="text-xs text-gray-400">Community help, no payment</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
              >
                <option value="">Select a category</option>
                {PREDEFINED_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {formData.category === 'Other' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Custom Category *
                </label>
                <input
                  type="text"
                  required
                  value={formData.customCategory}
                  onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                  placeholder="Enter your custom category"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base resize-none"
                placeholder="Describe what needs to be done, any specific requirements, and location details..."
              />
            </div>

            {/* Structured Address Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-300 flex items-center gap-2">
                <MapPin size={20} className="text-orange-500" />
                Task Location
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Street Address <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
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
                    value={formData.suburb}
                    onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
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
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
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
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                  placeholder="e.g. 3000"
                />
              </div>

              <p className="text-xs text-gray-400">
                Your exact address will only be shared with the assigned tasker. Others will see an approximate location.
              </p>

              {/* Map Preview Toggle */}
              {hasAddressData && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMapPreview(!showMapPreview)}
                    className="flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors text-sm font-medium"
                  >
                    <MapPin size={16} />
                    <span>{showMapPreview ? 'Hide' : 'Preview'} Location</span>
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    Preview how your location will appear on the map (geocoding will occur when you create the task)
                  </p>
                </div>
              )}
            </div>

            {/* Map Preview - Only shown when toggled and has address data */}
            {showMapPreview && hasAddressData && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Location Preview
                </label>
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm mb-3">
                    <MapPin size={16} />
                    <span>Map will be generated when you create the task</span>
                  </div>
                  <div className="bg-gray-600 rounded-lg h-48 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Map preview will appear after task creation</p>
                      <p className="text-xs mt-1">Address: {constructFullAddress()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Availability Calendar */}
            <div className="border-t border-gray-700 pt-6">
              <AvailabilityCalendarComponent
                value={availabilityCalendar}
                onChange={setAvailabilityCalendar}
                disabled={false}
              />
              {validationErrors.availability && (
                <div className="flex items-center gap-2 text-red-400 text-sm mt-2">
                  <AlertCircle size={16} />
                  <span>{validationErrors.availability}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Task Images
              </label>
              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> task images
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

                {/* Image Previews */}
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
              </div>
            </div>

            {/* Budget Field - Only show for paid tasks */}
            {formData.taskType === TaskType.paid && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Budget ($) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                  placeholder="Enter your budget"
                />
              </div>
            )}

            {/* Volunteer Task Info */}
            {formData.taskType === TaskType.volunteer && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Heart size={16} />
                  <span className="font-medium">Volunteer Task</span>
                </div>
                <p className="text-gray-300 text-sm">
                  This is a volunteer task with no payment. Community members can offer to help for free.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Required Skills
              </label>
              <input
                type="text"
                value={formData.requiredSkills}
                onChange={(e) => setFormData({ ...formData, requiredSkills: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                placeholder="e.g. Plumbing, Basic tools (comma separated)"
              />
            </div>

            <div className="flex flex-col gap-3 pt-6">
              <button
                type="submit"
                disabled={createTask.isPending || isUploading || isGeocoding}
                className="w-full px-6 py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
              >
                {createTask.isPending || isUploading || isGeocoding ? 
                  (isGeocoding ? 'Creating Task & Finding Location...' : 
                   isUploading ? 'Uploading Images...' : 'Creating Task...') : 
                  'Create Task'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full px-6 py-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium text-base"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
