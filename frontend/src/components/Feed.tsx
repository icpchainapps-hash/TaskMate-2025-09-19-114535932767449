import React, { useState } from 'react';
import { X, ArrowLeft, Upload, Trash2, MapPin, AlertCircle } from 'lucide-react';
import { useUpdateTask } from '../hooks/useQueries';
import { Task, TaskStatus, AvailabilityCalendar } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useFileUpload } from '../blob-storage/FileStorage';
import AvailabilityCalendarComponent from './AvailabilityCalendar';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: () => void;
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

// Function to parse existing address into structured fields
function parseAddressFields(fullAddress: string) {
  if (!fullAddress || fullAddress.trim() === '') {
    return { address: '', suburb: '', state: '', postcode: '' };
  }
  
  const parts = fullAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
  
  if (parts.length === 0) {
    return { address: '', suburb: '', state: '', postcode: '' };
  }
  
  if (parts.length === 1) {
    return { address: '', suburb: parts[0], state: '', postcode: '' };
  }
  
  if (parts.length === 2) {
    return { address: '', suburb: parts[0], state: parts[1], postcode: '' };
  }
  
  if (parts.length === 3) {
    return { address: '', suburb: parts[0], state: parts[1], postcode: parts[2] };
  }
  
  // 4 or more parts
  return {
    address: parts[0],
    suburb: parts[1],
    state: parts[2],
    postcode: parts[3]
  };
}

export default function EditTaskModal({ task, onClose, onTaskUpdated }: EditTaskModalProps) {
  const { identity } = useInternetIdentity();
  const updateTask = useUpdateTask();
  const { uploadFile, isUploading } = useFileUpload();

  // Parse existing address into structured fields
  const parsedAddress = parseAddressFields(task.address);

  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    category: task.category,
    customCategory: PREDEFINED_CATEGORIES.includes(task.category) ? '' : task.category,
    budget: (Number(task.budget) / 100).toString(), // Convert from cents to dollars
    dueDate: new Date(Number(task.dueDate) / 1000000).toISOString().split('T')[0], // Convert from nanoseconds
    requiredSkills: task.requiredSkills.join(', '),
    address: parsedAddress.address,
    suburb: parsedAddress.suburb,
    state: parsedAddress.state,
    postcode: parsedAddress.postcode
  });

  const [availabilityCalendar, setAvailabilityCalendar] = useState<AvailabilityCalendar>(task.availabilityCalendar);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showMapPreview, setShowMapPreview] = useState(false);
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

    try {
      // Upload new images
      const newImageUrls: string[] = [];
      
      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const imagePath = `tasks/${Date.now()}_${i}_${file.name}`;
        const { url } = await uploadFile(imagePath, file);
        newImageUrls.push(url);
      }

      // Combine existing images with new ones
      const allImages = [...task.images, ...newImageUrls];

      // Construct full address for backend storage
      const fullAddress = constructFullAddress();

      const updatedTask: Task = {
        ...task,
        title: formData.title,
        description: formData.description,
        category: finalCategory,
        budget: BigInt(parseInt(formData.budget) * 100), // Convert to cents
        dueDate: BigInt(new Date(formData.dueDate).getTime() * 1000000), // Convert to nanoseconds
        requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()).filter(s => s.length > 0),
        images: allImages,
        address: fullAddress, // Store constructed full address
        availabilityCalendar: availabilityCalendar
      };

      await updateTask.mutateAsync(updatedTask);
      onTaskUpdated();
    } catch (error) {
      console.error('Failed to update task:', error);
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
        <h2 className="text-lg font-bold text-white">Edit Task</h2>
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
                    <span>{showMapPreview ? 'Hide' : 'Preview'} Updated Location</span>
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    Preview how your updated location will appear (geocoding will occur when you save changes)
                  </p>
                </div>
              )}
            </div>

            {/* Map Preview - Only shown when toggled and has address data */}
            {showMapPreview && hasAddressData && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Updated Location Preview
                </label>
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm mb-3">
                    <MapPin size={16} />
                    <span>Map will be updated when you save changes</span>
                  </div>
                  <div className="bg-gray-600 rounded-lg h-48 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Updated map will appear after saving</p>
                      <p className="text-xs mt-1">New address: {constructFullAddress()}</p>
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
                Add More Images
              </label>
              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> additional images
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

                {/* New Image Previews */}
                {imagePreviews.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">New Images to Add:</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`New preview ${index + 1}`}
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
                  </div>
                )}

                {/* Existing Images Info */}
                {task.images.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-sm text-gray-300">
                      <strong>Current images:</strong> {task.images.length} image{task.images.length !== 1 ? 's' : ''} already attached to this task
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      New images will be added to the existing ones
                    </p>
                  </div>
                )}
              </div>
            </div>

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
                disabled={updateTask.isPending || isUploading}
                className="w-full px-6 py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
              >
                {updateTask.isPending || isUploading ? 'Updating Task...' : 'Save Changes'}
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
