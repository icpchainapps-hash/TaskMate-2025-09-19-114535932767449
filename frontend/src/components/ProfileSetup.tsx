import React, { useState } from 'react';
import { X, Camera, Building, User, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useSaveCallerUserProfile } from '../hooks/useQueries';
import { UserProfile, PoliceCheckStatus, AccountType } from '../backend';
import { useFileUpload } from '../blob-storage/FileStorage';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

const PREDEFINED_SKILLS = [
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Cleaning',
  'Painting',
  'Yard Work',
  'Assembly',
  'Moving',
  'Handyman',
  'Delivery',
  'Pet Care',
  'Tutoring',
  'Landscaping',
  'Roofing',
  'Flooring',
  'HVAC',
  'Appliance Repair',
  'Furniture Assembly',
  'Home Organization',
  'Window Cleaning'
];

const BUSINESS_INDUSTRIES = [
  'Construction & Building',
  'Home Services & Maintenance',
  'Landscaping & Gardening',
  'Cleaning Services',
  'Technology & IT',
  'Professional Services',
  'Healthcare & Wellness',
  'Education & Training',
  'Retail & E-commerce',
  'Food & Hospitality',
  'Transportation & Logistics',
  'Real Estate',
  'Finance & Insurance',
  'Marketing & Advertising',
  'Manufacturing',
  'Automotive',
  'Beauty & Personal Care',
  'Entertainment & Events',
  'Non-profit & Community',
  'Other'
];

export default function ProfileSetup() {
  const { identity } = useInternetIdentity();
  const { uploadFile, isUploading } = useFileUpload();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    skills: [] as string[],
    phone: '',
    email: '',
    customSkill: '',
    organizationName: '',
    abn: '',
    businessIndustry: ''
  });
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const saveProfile = useSaveCallerUserProfile();

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Image file must be smaller than 5MB');
        return;
      }

      setSelectedProfileImage(file);
      setUploadError(null);
      setUploadSuccess(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setProfileImagePreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setUploadError('Please select a valid image file (PNG, JPG, GIF)');
    }
  };

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleAddCustomSkill = () => {
    const customSkill = formData.customSkill.trim();
    if (customSkill && !formData.skills.includes(customSkill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, customSkill],
        customSkill: ''
      }));
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountType) return;

    try {
      let profilePictureUrl: string | undefined = undefined;

      // Upload profile picture if selected
      if (selectedProfileImage && identity) {
        setIsUploadingImage(true);
        setUploadError(null);
        setUploadSuccess(null);
        
        try {
          const imagePath = `profiles/${identity.getPrincipal().toString()}_${Date.now()}.jpg`;
          const { url } = await uploadFile(imagePath, selectedProfileImage);
          profilePictureUrl = url;
          setUploadSuccess('Profile picture uploaded successfully!');
        } catch (uploadErr) {
          console.error('Profile picture upload failed:', uploadErr);
          setUploadError('Failed to upload profile picture. Please try again.');
          setIsUploadingImage(false);
          return; // Don't save profile if image upload fails
        } finally {
          setIsUploadingImage(false);
        }
      }

      const profile: UserProfile = {
        name: formData.name,
        displayName: formData.name, // Use name as displayName initially
        bio: formData.bio,
        skills: formData.skills,
        phone: formData.phone,
        email: formData.email,
        averageRating: 0,
        completedJobs: BigInt(0),
        profilePicture: profilePictureUrl,
        policeCheckStatus: PoliceCheckStatus.notRequested,
        accountType: accountType,
        organizationName: accountType === AccountType.business && formData.organizationName.trim() 
          ? formData.organizationName.trim() 
          : undefined,
        abn: accountType === AccountType.business && formData.abn.trim() 
          ? formData.abn.trim() 
          : undefined,
        businessIndustry: accountType === AccountType.business && formData.businessIndustry.trim() 
          ? formData.businessIndustry.trim() 
          : undefined,
        workHistory: [], // Initialize empty work history
        accreditations: [] // Initialize empty accreditations
      };

      await saveProfile.mutateAsync(profile);
      
      if (selectedProfileImage) {
        setUploadSuccess('Profile created successfully with profile picture!');
      }
      
    } catch (error) {
      console.error('Failed to save profile:', error);
      setUploadError('Failed to create profile. Please try again.');
    }
  };

  // Account type selection screen
  if (!accountType) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          <div className="max-w-md mx-auto w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Welcome to Taskmate!</h1>
              <p className="text-gray-300">Choose your account type to get started</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setAccountType(AccountType.individual)}
                className="w-full p-6 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500 rounded-lg transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <User size={24} className="text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Individual</h3>
                    <p className="text-gray-400 text-sm">
                      Personal account for individuals offering services or posting tasks
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAccountType(AccountType.business)}
                className="w-full p-6 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500 rounded-lg transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                    <Building size={24} className="text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Business/Organization</h3>
                    <p className="text-gray-400 text-sm">
                      Business account for companies, trades, or organizations seeking services
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">
                You can update your account information later in your profile settings
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="max-w-md mx-auto w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setAccountType(null)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Back to account type selection"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2">
                {accountType === AccountType.individual ? (
                  <User size={24} className="text-blue-500" />
                ) : (
                  <Building size={24} className="text-orange-500" />
                )}
                <h1 className="text-3xl font-bold text-white">
                  {accountType === AccountType.individual ? 'Individual' : 'Business'} Profile
                </h1>
              </div>
            </div>
            <p className="text-gray-300">Complete your profile to get started</p>
          </div>

          {/* Upload Success/Error Messages */}
          {(uploadSuccess || uploadError) && (
            <div className={`mb-6 p-4 rounded-lg border ${
              uploadSuccess 
                ? 'bg-green-900/20 border-green-500/30 text-green-400' 
                : 'bg-red-900/20 border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                {uploadSuccess ? (
                  <CheckCircle size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span className="font-medium">
                  {uploadSuccess || uploadError}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto bg-gray-700 flex items-center justify-center">
                  {profileImagePreview ? (
                    <img
                      src={profileImagePreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {formData.name ? getInitials(formData.name) : 
                       accountType === AccountType.business ? 
                       (formData.organizationName ? getInitials(formData.organizationName) : '?') : '?'}
                    </span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full cursor-pointer transition-colors">
                  <Camera size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageSelect}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-gray-400">
                Add a profile picture (optional)
                {selectedProfileImage && (
                  <span className="block text-orange-400 mt-1">
                    Selected: {selectedProfileImage.name}
                  </span>
                )}
              </p>
              {uploadError && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={14} />
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}
            </div>

            {accountType === AccountType.business && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your organization name"
                />
              </div>
            )}

            {accountType === AccountType.business && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Industry <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <select
                  value={formData.businessIndustry}
                  onChange={(e) => setFormData({ ...formData, businessIndustry: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select an industry (optional)</option>
                  {BUSINESS_INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Help others understand your business focus
                </p>
              </div>
            )}

            {accountType === AccountType.business && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ABN <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your ABN (Australian Business Number)"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Australian Business Number for verification purposes
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {accountType === AccountType.individual ? 'Full Name' : 'Contact Person Name'} *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={accountType === AccountType.individual ? 
                  "Enter your full name" : 
                  "Enter the contact person's name"
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {accountType === AccountType.individual ? 'Bio' : 'Organization Description'}
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={accountType === AccountType.individual ? 
                  "Tell others about yourself and your experience" : 
                  "Describe your organization and the services you provide or need"
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Skills & Services ({formData.skills.length} selected)
              </label>
              
              {/* Predefined Skills */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Popular Skills</h4>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {PREDEFINED_SKILLS.map((skill) => (
                    <label
                      key={skill}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.skills.includes(skill)}
                        onChange={() => handleSkillToggle(skill)}
                        className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                      />
                      <span className="text-gray-300 text-sm">{skill}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Skills */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Add Custom Skill</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.customSkill}
                    onChange={(e) => setFormData({ ...formData, customSkill: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkill();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter a custom skill"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSkill}
                    disabled={!formData.customSkill.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Selected Skills */}
              {formData.skills.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Selected Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map((skill) => (
                      <div
                        key={skill}
                        className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full text-sm"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Your contact number"
              />
              <p className="text-xs text-gray-400 mt-1">
                Phone numbers are masked for safety and only shared when necessary
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="your.email@example.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                Email addresses are masked for safety and only shared when necessary
              </p>
            </div>

            <button
              type="submit"
              disabled={saveProfile.isPending || isUploadingImage || !formData.name || 
                       (accountType === AccountType.business && !formData.organizationName)}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {saveProfile.isPending || isUploadingImage ? 
                (isUploadingImage ? 'Uploading Image...' : 'Creating Profile...') : 
                'Complete Setup'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
