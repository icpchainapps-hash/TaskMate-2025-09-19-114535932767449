import React, { useState, useEffect } from 'react';
import { Star, Briefcase, Award, Edit3, X, Check, DollarSign, TrendingUp, Calendar, AlertCircle, RefreshCw, User, Upload, Camera, Shield, Clock, CheckCircle, ExternalLink, FileText, Scale, Building, Plus, Trash2, MapPin, Heart } from 'lucide-react';
import { useGetCallerUserProfile, useSaveCallerUserProfile, useGetPayments, useGetPoliceCheckStatus, useRequestPoliceCheck, useGetTasks, useAddAccreditation, useRemoveAccreditation, useUpdateAccreditation } from '../hooks/useQueries';
import { UserProfile, PaymentStatus, PoliceCheckStatus, AccountType, Accreditation, WorkHistory } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useFileUpload } from '../blob-storage/FileStorage';
import TermsOfServiceModal from './TermsOfServiceModal';
import PrivacyPolicyModal from './PrivacyPolicyModal';

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

export default function Profile() {
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading, error, refetch, isFetched } = useGetCallerUserProfile();
  const { data: payments = [] } = useGetPayments();
  const { data: tasks = [] } = useGetTasks();
  const { data: policeCheckStatus = PoliceCheckStatus.notRequested, refetch: refetchPoliceStatus } = useGetPoliceCheckStatus();
  const saveProfile = useSaveCallerUserProfile();
  const addAccreditation = useAddAccreditation();
  const removeAccreditation = useRemoveAccreditation();
  const updateAccreditation = useUpdateAccreditation();
  const requestPoliceCheck = useRequestPoliceCheck();
  const { uploadFile, isUploading } = useFileUpload();
  const [isEditing, setIsEditing] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    skills: [] as string[],
    customSkill: '',
    profilePicture: null as string | null,
    organizationName: '',
    abn: '',
    businessIndustry: ''
  });
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    email: '',
    phone: '',
    organizationName: ''
  });
  const [newAccreditation, setNewAccreditation] = useState({
    name: '',
    issuingOrganization: '',
    dateIssued: '',
    expirationDate: '',
    verified: false
  });
  const [showAddAccreditation, setShowAddAccreditation] = useState(false);

  // Auto-retry mechanism for profile loading
  useEffect(() => {
    if (error && retryCount < 3 && identity) {
      const timer = setTimeout(() => {
        console.log(`Retrying profile fetch (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        refetch();
      }, 1000 * (retryCount + 1));

      return () => clearTimeout(timer);
    }
  }, [error, retryCount, identity, refetch]);

  // Reset retry count on successful fetch
  useEffect(() => {
    if (userProfile && !error) {
      setRetryCount(0);
    }
  }, [userProfile, error]);

  // Refresh police check status periodically when in progress
  useEffect(() => {
    if (policeCheckStatus === PoliceCheckStatus.inProgress) {
      const interval = setInterval(() => {
        refetchPoliceStatus();
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [policeCheckStatus, refetchPoliceStatus]);

  // Clear upload feedback messages after 5 seconds
  useEffect(() => {
    if (uploadSuccess || uploadError) {
      const timer = setTimeout(() => {
        setUploadSuccess(null);
        setUploadError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess, uploadError]);

  // Filter payments for current user
  const userPayments = payments.filter(payment => 
    identity && (
      payment.tasker.toString() === identity.getPrincipal().toString() ||
      payment.requester.toString() === identity.getPrincipal().toString()
    )
  );

  const completedPayments = userPayments.filter(p => p.status === PaymentStatus.completed);
  const totalEarned = completedPayments
    .filter(p => identity && p.tasker.toString() === identity.getPrincipal().toString())
    .reduce((sum, p) => sum + Number(p.netAmount), 0);
  const totalSpent = completedPayments
    .filter(p => identity && p.requester.toString() === identity.getPrincipal().toString())
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Generate work history from completed tasks
  const workHistory: WorkHistory[] = React.useMemo(() => {
    if (!identity || !userProfile) return [];
    
    const userPrincipal = identity.getPrincipal().toString();
    
    // Find completed tasks where user was the assigned tasker
    const completedTasks = tasks.filter(task => 
      task.assignedTasker?.toString() === userPrincipal && 
      task.status === 'completed'
    );
    
    return completedTasks.map(task => ({
      taskId: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      budget: task.budget, // Keep as bigint to match WorkHistory type
      completionDate: task.createdAt, // Using createdAt as completion date for now
      taskType: task.taskType
    }));
  }, [tasks, identity, userProfile]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10;
  };

  const validateForm = (): boolean => {
    const errors = {
      name: '',
      email: '',
      phone: '',
      organizationName: ''
    };

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (userProfile?.accountType === AccountType.business && !formData.organizationName.trim()) {
      errors.organizationName = 'Organization name is required for business accounts';
    }

    if (formData.email && !validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number (at least 10 digits)';
    }

    setValidationErrors(errors);
    return !errors.name && !errors.email && !errors.phone && !errors.organizationName;
  };

  const handleEditClick = () => {
    if (userProfile) {
      setFormData({
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        bio: userProfile.bio,
        skills: [...userProfile.skills],
        customSkill: '',
        profilePicture: userProfile.profilePicture || null,
        organizationName: userProfile.organizationName || '',
        abn: userProfile.abn || '',
        businessIndustry: userProfile.businessIndustry || ''
      });
      setProfileImagePreview(userProfile.profilePicture || null);
    }
    setIsEditing(true);
    setValidationErrors({ name: '', email: '', phone: '', organizationName: '' });
    setUploadSuccess(null);
    setUploadError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      bio: '', 
      skills: [], 
      customSkill: '', 
      profilePicture: null,
      organizationName: '',
      abn: '',
      businessIndustry: ''
    });
    setValidationErrors({ name: '', email: '', phone: '', organizationName: '' });
    setSelectedProfileImage(null);
    setProfileImagePreview(null);
    setShowAddAccreditation(false);
    setNewAccreditation({
      name: '',
      issuingOrganization: '',
      dateIssued: '',
      expirationDate: '',
      verified: false
    });
    setUploadSuccess(null);
    setUploadError(null);
  };

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

  const handleAddAccreditation = async () => {
    if (!newAccreditation.name.trim() || !newAccreditation.issuingOrganization.trim() || !newAccreditation.dateIssued) {
      return;
    }

    const accreditation: Accreditation = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newAccreditation.name.trim(),
      issuingOrganization: newAccreditation.issuingOrganization.trim(),
      dateIssued: BigInt(new Date(newAccreditation.dateIssued).getTime() * 1000000),
      expirationDate: newAccreditation.expirationDate ? 
        BigInt(new Date(newAccreditation.expirationDate).getTime() * 1000000) : undefined,
      verified: newAccreditation.verified
    };

    try {
      await addAccreditation.mutateAsync(accreditation);
      
      // Reset form and close modal
      setNewAccreditation({
        name: '',
        issuingOrganization: '',
        dateIssued: '',
        expirationDate: '',
        verified: false
      });
      setShowAddAccreditation(false);
    } catch (error) {
      console.error('Failed to add accreditation:', error);
    }
  };

  const handleRemoveAccreditation = async (accreditationId: string) => {
    try {
      await removeAccreditation.mutateAsync(accreditationId);
    } catch (error) {
      console.error('Failed to remove accreditation:', error);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!userProfile) return;

    try {
      let profilePictureUrl = formData.profilePicture;

      // Upload new profile picture if selected
      if (selectedProfileImage) {
        setIsUploadingImage(true);
        setUploadError(null);
        setUploadSuccess(null);
        
        try {
          const imagePath = `profiles/${identity?.getPrincipal().toString()}_${Date.now()}.jpg`;
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

      const updatedProfile: UserProfile = {
        ...userProfile,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        bio: formData.bio.trim(),
        skills: formData.skills,
        profilePicture: profilePictureUrl || undefined,
        organizationName: userProfile.accountType === AccountType.business && formData.organizationName.trim()
          ? formData.organizationName.trim()
          : undefined,
        abn: userProfile.accountType === AccountType.business && formData.abn.trim()
          ? formData.abn.trim()
          : undefined,
        businessIndustry: userProfile.accountType === AccountType.business && formData.businessIndustry.trim()
          ? formData.businessIndustry.trim()
          : undefined,
        // Keep existing accreditations and work history - these are managed separately
        accreditations: userProfile.accreditations,
        workHistory: userProfile.workHistory
      };

      await saveProfile.mutateAsync(updatedProfile);
      
      // Show success message and close edit mode
      if (selectedProfileImage) {
        setUploadSuccess('Profile updated successfully with new picture!');
      } else {
        setUploadSuccess('Profile updated successfully!');
      }
      
      setIsEditing(false);
      setSelectedProfileImage(null);
      setProfileImagePreview(null);
      
      // Force a refetch to ensure UI updates immediately
      setTimeout(() => {
        refetch();
      }, 500);
      
    } catch (error) {
      console.error('Failed to update profile:', error);
      setUploadError('Failed to save profile changes. Please try again.');
    }
  };

  const handleRequestPoliceCheck = async () => {
    try {
      await requestPoliceCheck.mutateAsync();
      // Refresh the status immediately after request
      setTimeout(() => {
        refetchPoliceStatus();
      }, 1000);
    } catch (error) {
      console.error('Failed to request police check:', error);
    }
  };

  const handleRetryFetch = () => {
    setRetryCount(0);
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}
      />
    ));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const getPoliceCheckStatusDisplay = () => {
    switch (policeCheckStatus) {
      case PoliceCheckStatus.notRequested:
        return {
          text: 'Not Requested',
          color: 'text-gray-400',
          bgColor: 'bg-gray-700',
          icon: Shield,
          showButton: true,
          description: 'Enhance your profile credibility by completing a background verification through Checkr.'
        };
      case PoliceCheckStatus.inProgress:
        return {
          text: 'Verification in Progress',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          icon: Clock,
          showButton: false,
          description: 'Your background verification is being processed by Checkr. This may take several business days to complete.'
        };
      case PoliceCheckStatus.verified:
        return {
          text: 'Background Verified by Checkr',
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          icon: CheckCircle,
          showButton: false,
          description: 'Your background has been successfully verified by Checkr and is displayed on your profile.'
        };
      default:
        return {
          text: 'Not Requested',
          color: 'text-gray-400',
          bgColor: 'bg-gray-700',
          icon: Shield,
          showButton: true,
          description: 'Enhance your profile credibility by completing a background verification through Checkr.'
        };
    }
  };

  const policeCheckDisplay = getPoliceCheckStatusDisplay();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Profile</h2>
          <p className="text-gray-400">Loading your profile information...</p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4"></div>
            <div className="h-6 bg-gray-700 rounded w-1/2 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4 mx-auto"></div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-8 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !userProfile) {
    return (
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Profile</h2>
          <p className="text-gray-400">There was an issue loading your profile</p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Profile</h3>
            <p className="text-gray-400 mb-6">
              We couldn't load your profile information. This might be a temporary issue.
            </p>
            <button
              onClick={handleRetryFetch}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors mx-auto"
            >
              <RefreshCw size={16} />
              <span>Try Again</span>
            </button>
            {retryCount > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Retry attempt: {retryCount}/3
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isFetched && !userProfile && !isLoading && !error) {
    return (
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Profile</h2>
          <p className="text-gray-400">Your profile is not set up yet</p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center py-12">
            <User size={48} className="mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold text-white mb-2">Profile Not Found</h3>
            <p className="text-gray-400 mb-6">
              It looks like your profile hasn't been set up yet. Please complete the profile setup process.
            </p>
            <button
              onClick={handleRetryFetch}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors mx-auto"
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Profile</h2>
          <p className="text-gray-400">Loading...</p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading profile information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Profile</h2>
        {!isEditing && (
          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        )}
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

      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="text-center mb-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 bg-gray-700 flex items-center justify-center">
                  {profileImagePreview ? (
                    <img
                      src={profileImagePreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {formData.name ? getInitials(formData.name) : 
                       userProfile.accountType === AccountType.business && formData.organizationName ? 
                       getInitials(formData.organizationName) : 
                       getInitials(userProfile.name)}
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
                Click the camera icon to update your profile picture
                {selectedProfileImage && (
                  <span className="block text-orange-400 mt-1">
                    New image selected: {selectedProfileImage.name}
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

            {/* Account Type Display */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                {userProfile.accountType === AccountType.individual ? (
                  <User size={20} className="text-blue-500" />
                ) : (
                  <Building size={20} className="text-orange-500" />
                )}
                <div>
                  <h4 className="text-white font-medium">
                    {userProfile.accountType === AccountType.individual ? 'Individual Account' : 'Business Account'}
                  </h4>
                  <p className="text-gray-400 text-sm">
                    {userProfile.accountType === AccountType.individual 
                      ? 'Personal account for individual users'
                      : 'Business account for organizations and companies'
                    }
                  </p>
                </div>
              </div>
            </div>

            {userProfile.accountType === AccountType.business && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                  className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    validationErrors.organizationName ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="Enter your organization name"
                />
                {validationErrors.organizationName && (
                  <p className="text-red-400 text-sm mt-1">{validationErrors.organizationName}</p>
                )}
              </div>
            )}

            {userProfile.accountType === AccountType.business && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Industry <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <select
                  value={formData.businessIndustry}
                  onChange={(e) => setFormData({ ...formData, businessIndustry: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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

            {userProfile.accountType === AccountType.business && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ABN <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter your ABN (Australian Business Number)"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Australian Business Number for verification purposes
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {userProfile.accountType === AccountType.individual ? 'Full Name' : 'Contact Person Name'} *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  validationErrors.name ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder={userProfile.accountType === AccountType.individual ? 
                  "Enter your full name" : 
                  "Enter the contact person's name"
                }
              />
              {validationErrors.name && (
                <p className="text-red-400 text-sm mt-1">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  validationErrors.email ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder="your.email@example.com"
              />
              {validationErrors.email && (
                <p className="text-red-400 text-sm mt-1">{validationErrors.email}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Email addresses are masked for safety and only shared when necessary
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  validationErrors.phone ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder="Your contact number"
              />
              {validationErrors.phone && (
                <p className="text-red-400 text-sm mt-1">{validationErrors.phone}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Phone numbers are masked for safety and only shared when necessary. Accepts various formats with at least 10 digits.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {userProfile.accountType === AccountType.individual ? 'Bio' : 'Organization Description'}
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                placeholder={userProfile.accountType === AccountType.individual ? 
                  "Tell others about yourself and your experience" : 
                  "Describe your organization and the services you provide or need"
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Skills ({formData.skills.length} selected)
              </label>
              
              {/* Predefined Skills */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Popular Skills</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PREDEFINED_SKILLS.map((skill) => (
                    <label
                      key={skill}
                      className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.skills.includes(skill)}
                        onChange={() => handleSkillToggle(skill)}
                        className="w-4 h-4 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500 focus:ring-2"
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
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
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

            {/* Accreditations Section - Edit Mode */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Accreditations & Certifications ({userProfile.accreditations.length})
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddAccreditation(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>

              {/* Add Accreditation Form */}
              {showAddAccreditation && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4 border border-gray-600">
                  <h4 className="text-white font-medium mb-3">Add New Accreditation</h4>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={newAccreditation.name}
                        onChange={(e) => setNewAccreditation({ ...newAccreditation, name: e.target.value })}
                        placeholder="Certification name (e.g., Licensed Electrician)"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newAccreditation.issuingOrganization}
                        onChange={(e) => setNewAccreditation({ ...newAccreditation, issuingOrganization: e.target.value })}
                        placeholder="Issuing organization (e.g., Electrical Safety Office)"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Date Issued</label>
                        <input
                          type="date"
                          value={newAccreditation.dateIssued}
                          onChange={(e) => setNewAccreditation({ ...newAccreditation, dateIssued: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Expiration Date (optional)</label>
                        <input
                          type="date"
                          value={newAccreditation.expirationDate}
                          onChange={(e) => setNewAccreditation({ ...newAccreditation, expirationDate: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="verified"
                        checked={newAccreditation.verified}
                        onChange={(e) => setNewAccreditation({ ...newAccreditation, verified: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label htmlFor="verified" className="text-gray-300 text-sm">
                        This accreditation is verified/official
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddAccreditation}
                        disabled={!newAccreditation.name.trim() || !newAccreditation.issuingOrganization.trim() || !newAccreditation.dateIssued || addAccreditation.isPending}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                      >
                        {addAccreditation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Adding...</span>
                          </>
                        ) : (
                          <span>Add Accreditation</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAccreditation(false);
                          setNewAccreditation({
                            name: '',
                            issuingOrganization: '',
                            dateIssued: '',
                            expirationDate: '',
                            verified: false
                          });
                        }}
                        disabled={addAccreditation.isPending}
                        className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Accreditations */}
              {userProfile.accreditations.length > 0 && (
                <div className="space-y-3">
                  {userProfile.accreditations.map((accreditation) => (
                    <div key={accreditation.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h6 className="text-white font-medium text-sm">{accreditation.name}</h6>
                            {accreditation.verified && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                                <CheckCircle size={10} />
                                <span>Verified</span>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm mb-1">{accreditation.issuingOrganization}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span>Issued: {formatDateOnly(accreditation.dateIssued)}</span>
                            {accreditation.expirationDate && (
                              <span>Expires: {formatDateOnly(accreditation.expirationDate)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccreditation(accreditation.id)}
                          disabled={removeAccreditation.isPending}
                          className="text-red-400 hover:text-red-300 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {removeAccreditation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {userProfile.accreditations.length === 0 && !showAddAccreditation && (
                <div className="text-center py-4 text-gray-400 bg-gray-700 rounded-lg">
                  <Award size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No accreditations listed</p>
                </div>
              )}
            </div>

            {/* Background Verification Section in Edit Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Background Verification
              </label>
              <div className={`${policeCheckDisplay.bgColor} rounded-lg p-4 border border-gray-600`}>
                <div className="flex items-center gap-3 mb-3">
                  <policeCheckDisplay.icon size={20} className={policeCheckDisplay.color} />
                  <span className={`font-medium ${policeCheckDisplay.color}`}>
                    {policeCheckDisplay.text}
                  </span>
                </div>
                
                <p className="text-gray-300 text-sm mb-3">
                  {policeCheckDisplay.description}
                </p>
                
                {policeCheckDisplay.showButton && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleRequestPoliceCheck}
                      disabled={requestPoliceCheck.isPending}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed text-sm"
                    >
                      {requestPoliceCheck.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Requesting...</span>
                        </>
                      ) : (
                        <>
                          <Shield size={16} />
                          <span>Request Background Check</span>
                        </>
                      )}
                    </button>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                        <ExternalLink size={14} />
                        <span className="font-medium">Powered by Checkr</span>
                      </div>
                      <p className="text-gray-300 text-xs">
                        Background checks are processed through Checkr's secure platform. 
                        You'll receive real-time updates on your verification status.
                      </p>
                    </div>
                  </div>
                )}
                
                {policeCheckStatus === PoliceCheckStatus.inProgress && (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                      <Clock size={14} />
                      <span className="font-medium">Processing with Checkr</span>
                    </div>
                    <p className="text-gray-300 text-xs">
                      Your background verification is being processed by Checkr. 
                      Status updates will appear automatically when available.
                    </p>
                  </div>
                )}
                
                {policeCheckStatus === PoliceCheckStatus.verified && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                      <CheckCircle size={14} />
                      <span className="font-medium">Verified by Checkr</span>
                    </div>
                    <p className="text-gray-300 text-xs">
                      Your background has been successfully verified by Checkr and is displayed on your profile.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saveProfile.isPending || isUploadingImage}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
              >
                {saveProfile.isPending || isUploadingImage ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{isUploadingImage ? 'Uploading Image...' : 'Saving Profile...'}</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saveProfile.isPending || isUploadingImage}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 bg-gray-700 flex items-center justify-center">
                {userProfile.profilePicture ? (
                  <img
                    src={userProfile.profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <span 
                  className={`text-2xl font-bold text-white ${userProfile.profilePicture ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}
                >
                  {userProfile.accountType === AccountType.business && userProfile.organizationName ? 
                   getInitials(userProfile.organizationName) : 
                   getInitials(userProfile.name)}
                </span>
              </div>
              
              {/* Account Type Badge */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {userProfile.accountType === AccountType.individual ? (
                  <User size={16} className="text-blue-500" />
                ) : (
                  <Building size={16} className="text-orange-500" />
                )}
                <span className={`text-sm font-medium ${
                  userProfile.accountType === AccountType.individual ? 'text-blue-400' : 'text-orange-400'
                }`}>
                  {userProfile.accountType === AccountType.individual ? 'Individual' : 'Business'}
                </span>
              </div>

              {/* Display name based on account type */}
              {userProfile.accountType === AccountType.business && userProfile.organizationName ? (
                <div>
                  <h3 className="text-xl font-bold text-white">{userProfile.organizationName}</h3>
                  {userProfile.businessIndustry && (
                    <p className="text-gray-400 text-sm">{userProfile.businessIndustry}</p>
                  )}
                  {userProfile.abn && (
                    <p className="text-gray-400 text-sm">ABN: {userProfile.abn}</p>
                  )}
                  <p className="text-gray-300 text-sm mt-1">Contact: {userProfile.name}</p>
                </div>
              ) : (
                <h3 className="text-xl font-bold text-white">{userProfile.name}</h3>
              )}
              
              {userProfile.bio && (
                <p className="text-gray-300 mt-2">{userProfile.bio}</p>
              )}
              
              {/* Police Check Badge - Only show when verified */}
              {policeCheckStatus === PoliceCheckStatus.verified && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium">
                  <CheckCircle size={16} />
                  <span>Background Verified by Checkr</span>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="mb-6 space-y-4">
              <h4 className="text-lg font-semibold text-white">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {userProfile.email && (
                  <div className="bg-gray-700 rounded-lg p-3">
                    <span className="text-gray-400 text-sm">Email:</span>
                    <p className="text-white font-medium">{userProfile.email}</p>
                  </div>
                )}
                {userProfile.phone && (
                  <div className="bg-gray-700 rounded-lg p-3">
                    <span className="text-gray-400 text-sm">Phone:</span>
                    <p className="text-white font-medium">{userProfile.phone}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Star className="text-orange-500" size={20} />
                </div>
                <div className="text-lg font-bold text-white flex items-center justify-center gap-1">
                  <div className="flex items-center gap-1">
                    {renderStars(Math.round(userProfile.averageRating))}
                  </div>
                </div>
                <div className="text-xs text-gray-400">Rating</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Briefcase className="text-orange-500" size={20} />
                </div>
                <div className="text-lg font-bold text-white">
                  {Number(userProfile.completedJobs)}
                </div>
                <div className="text-xs text-gray-400">Jobs Done</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Award className="text-orange-500" size={20} />
                </div>
                <div className="text-lg font-bold text-white">
                  {userProfile.skills.length}
                </div>
                <div className="text-xs text-gray-400">Skills</div>
              </div>
            </div>

            {userProfile.skills.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {userProfile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Accreditations Section - View Mode */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Accreditations & Certifications</h4>
                {!isEditing && (
                  <button
                    onClick={() => setShowAddAccreditation(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {/* Add Accreditation Form - Also available in view mode */}
              {showAddAccreditation && !isEditing && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4 border border-gray-600">
                  <h4 className="text-white font-medium mb-3">Add New Accreditation</h4>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={newAccreditation.name}
                        onChange={(e) => setNewAccreditation({ ...newAccreditation, name: e.target.value })}
                        placeholder="Certification name (e.g., Licensed Electrician)"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newAccreditation.issuingOrganization}
                        onChange={(e) => setNewAccreditation({ ...newAccreditation, issuingOrganization: e.target.value })}
                        placeholder="Issuing organization (e.g., Electrical Safety Office)"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Date Issued</label>
                        <input
                          type="date"
                          value={newAccreditation.dateIssued}
                          onChange={(e) => setNewAccreditation({ ...newAccreditation, dateIssued: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Expiration Date (optional)</label>
                        <input
                          type="date"
                          value={newAccreditation.expirationDate}
                          onChange={(e) => setNewAccreditation({ ...newAccreditation, expirationDate: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="verified-view"
                        checked={newAccreditation.verified}
                        onChange={(e) => setNewAccreditation({ ...newAccreditation, verified: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label htmlFor="verified-view" className="text-gray-300 text-sm">
                        This accreditation is verified/official
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddAccreditation}
                        disabled={!newAccreditation.name.trim() || !newAccreditation.issuingOrganization.trim() || !newAccreditation.dateIssued || addAccreditation.isPending}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                      >
                        {addAccreditation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Adding...</span>
                          </>
                        ) : (
                          <span>Add Accreditation</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAccreditation(false);
                          setNewAccreditation({
                            name: '',
                            issuingOrganization: '',
                            dateIssued: '',
                            expirationDate: '',
                            verified: false
                          });
                        }}
                        disabled={addAccreditation.isPending}
                        className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {userProfile.accreditations.length > 0 ? (
                <div className="space-y-3">
                  {userProfile.accreditations.map((accreditation) => (
                    <div key={accreditation.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-white font-medium">{accreditation.name}</h5>
                            {accreditation.verified && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                                <CheckCircle size={12} />
                                <span>Verified</span>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm mb-2">{accreditation.issuingOrganization}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>Issued: {formatDateOnly(accreditation.dateIssued)}</span>
                            {accreditation.expirationDate && (
                              <span>Expires: {formatDateOnly(accreditation.expirationDate)}</span>
                            )}
                          </div>
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => handleRemoveAccreditation(accreditation.id)}
                            disabled={removeAccreditation.isPending}
                            className="text-red-400 hover:text-red-300 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {removeAccreditation.isPending ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 bg-gray-700 rounded-lg">
                  <Award size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No accreditations added yet</p>
                  <p className="text-xs">Add trade certifications to build credibility with clients</p>
                </div>
              )}
            </div>

            {/* Work History Section - View Mode */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-white mb-4">Work History on Taskmate</h4>
              {workHistory.length > 0 ? (
                <div className="space-y-3">
                  {workHistory
                    .sort((a, b) => Number(b.completionDate - a.completionDate))
                    .map((work) => (
                      <div key={work.taskId} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="text-white font-medium mb-1">{work.title}</h5>
                            <p className="text-gray-300 text-sm mb-2 line-clamp-2">{work.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                Completed: {formatDateOnly(work.completionDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {work.category}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {work.taskType === 'paid' ? (
                              <span className="text-green-400 font-semibold">
                                ${(Number(work.budget) / 100).toLocaleString()}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                                <Heart size={12} />
                                <span>Volunteer</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                              <CheckCircle size={12} />
                              <span>Completed</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 bg-gray-700 rounded-lg">
                  <Briefcase size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No completed tasks yet</p>
                  <p className="text-xs">Complete tasks on Taskmate to build your work history</p>
                </div>
              )}
            </div>

            {/* Background Verification Status - View Mode */}
            {policeCheckStatus !== PoliceCheckStatus.notRequested && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Background Verification</h4>
                <div className={`${policeCheckDisplay.bgColor} rounded-lg p-4 border border-gray-600`}>
                  <div className="flex items-center gap-3 mb-2">
                    <policeCheckDisplay.icon size={20} className={policeCheckDisplay.color} />
                    <span className={`font-medium ${policeCheckDisplay.color}`}>
                      {policeCheckDisplay.text}
                    </span>
                  </div>
                  
                  <p className="text-gray-300 text-sm">
                    {policeCheckDisplay.description}
                  </p>
                  
                  {policeCheckStatus === PoliceCheckStatus.verified && (
                    <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                      <ExternalLink size={14} />
                      <span>Verified by Checkr</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Terms of Service and Privacy Policy Links */}
            <div className="mb-6 border-t border-gray-700 pt-6">
              <h4 className="text-lg font-semibold text-white mb-4">Legal Information</h4>
              <div className="space-y-3">
                <button
                  onClick={() => setShowTermsModal(true)}
                  className="w-full flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
                >
                  <Scale size={20} className="text-orange-500 flex-shrink-0" />
                  <div>
                    <h5 className="text-white font-medium">Terms of Service</h5>
                    <p className="text-gray-400 text-sm">View our terms and conditions, including risk assumptions</p>
                  </div>
                  <ExternalLink size={16} className="text-gray-400 flex-shrink-0" />
                </button>

                <button
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
                >
                  <FileText size={20} className="text-blue-500 flex-shrink-0" />
                  <div>
                    <h5 className="text-white font-medium">Privacy Policy</h5>
                    <p className="text-gray-400 text-sm">Learn how we protect and handle your personal information</p>
                  </div>
                  <ExternalLink size={16} className="text-gray-400 flex-shrink-0" />
                </button>
              </div>
            </div>

            {/* Payment Summary */}
            {userPayments.length > 0 && (
              <div className="border-t border-gray-700 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Payment Summary</h4>
                  <button
                    onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                    className="text-orange-500 hover:text-orange-400 text-sm font-medium"
                  >
                    {showPaymentHistory ? 'Hide History' : 'View History'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-700 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="text-green-500" size={20} />
                    </div>
                    <div className="text-lg font-bold text-green-400">
                      {formatCurrency(totalEarned)}
                    </div>
                    <div className="text-xs text-gray-400">Total Earned</div>
                  </div>
                  
                  <div className="bg-gray-700 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <DollarSign className="text-blue-500" size={20} />
                    </div>
                    <div className="text-lg font-bold text-blue-400">
                      {formatCurrency(totalSpent)}
                    </div>
                    <div className="text-xs text-gray-400">Total Spent</div>
                  </div>
                </div>

                {showPaymentHistory && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-300">Recent Transactions</h5>
                    {userPayments.slice(0, 5).map((payment) => {
                      const isEarning = identity && payment.tasker.toString() === identity.getPrincipal().toString();
                      return (
                        <div key={payment.id} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-medium ${isEarning ? 'text-green-400' : 'text-blue-400'}`}>
                                  {isEarning ? 'Earned' : 'Paid'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  Task #{payment.taskId.slice(-8)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Calendar size={12} />
                                <span>{formatDate(payment.createdAt)}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold ${isEarning ? 'text-green-400' : 'text-blue-400'}`}>
                                {isEarning ? formatCurrency(Number(payment.netAmount)) : formatCurrency(Number(payment.amount))}
                              </div>
                              {isEarning && (
                                <div className="text-xs text-gray-400">
                                  (after {formatCurrency(Number(payment.fee))} fee)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {userPayments.length > 5 && (
                      <p className="text-xs text-gray-400 text-center">
                        Showing 5 most recent transactions
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-center text-sm text-gray-500">
        © 2025. Built with <span className="text-red-500">♥</span> using{' '}
        <a href="https://caffeine.ai" className="text-orange-500 hover:text-orange-400">
          caffeine.ai
        </a>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <TermsOfServiceModal onClose={() => setShowTermsModal(false)} />
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />
      )}
    </div>
  );
}
