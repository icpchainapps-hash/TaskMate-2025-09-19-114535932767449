import React, { useState, useMemo } from 'react';
import { X, ArrowLeft, Clock, MapPin, Tag, MessageCircle, Bookmark, Share, Flag, Heart, Gift, Megaphone, HandHeart, Users, Eye, DollarSign, Calendar, EyeOff, AlertCircle, CheckCircle, Edit3 } from 'lucide-react';
import { useGetTasks, useGetCallerUserProfile, useGetUserProfiles, useClaimSwap, useClaimFreecycleItem, usePledgeVolunteerSlot } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Task, TaskType, TimeSlot } from '../backend';
import { NeighbourhoodPost } from '../hooks/useQueries';
import { Principal } from '@dfinity/principal';
import FeedPostReactions from './FeedPostReactions';
import FeedPostComments from './FeedPostComments';
import EditFeedPostModal from './EditFeedPostModal';
import FeedTimeSlotPicker from './FeedTimeSlotPicker';

interface PostDetailModalProps {
  post: NeighbourhoodPost;
  onClose: () => void;
  onNavigateToMessages?: (authorPrincipal: string, authorName: string) => void;
}

// Mock interaction status for demonstration - in real app this would come from backend
interface PostInteractionStatus {
  isApprovedForSwap?: boolean;
  isRejectedFromSwap?: boolean;
  isApprovedForPickup?: boolean;
  isApprovedForVolunteering?: boolean;
  isActivityFinalized?: boolean; // When swap/pickup/volunteering is completed
}

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

export default function PostDetailModal({ post, onClose, onNavigateToMessages }: PostDetailModalProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: tasks = [] } = useGetTasks();
  const claimSwap = useClaimSwap();
  const claimFreecycleItem = useClaimFreecycleItem();
  const pledgeVolunteerSlot = usePledgeVolunteerSlot();
  const [showComments, setShowComments] = useState(false);
  const [showPreciseLocation, setShowPreciseLocation] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Toast notification state for user feedback
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Time slot picker state for swap posts
  const [timeSlotPicker, setTimeSlotPicker] = useState<{
    show: boolean;
    post: NeighbourhoodPost | null;
    action: 'swap' | 'freecycle' | 'volunteer_slot' | null;
    selectedTimeSlot: TimeSlot | null;
  }>({
    show: false,
    post: null,
    action: null,
    selectedTimeSlot: null
  });

  // Action loading states for immediate feedback
  const [actionStates, setActionStates] = useState<{
    claimingSwap?: boolean;
    claimingFreecycle?: boolean;
    pledgingVolunteer?: boolean;
    messagingAuthor?: boolean;
  }>({});

  // Mock interaction status - in real app this would be fetched from backend
  const [interactionStatus] = useState<PostInteractionStatus>({
    isApprovedForSwap: false,
    isRejectedFromSwap: false,
    isApprovedForPickup: false,
    isApprovedForVolunteering: false,
    isActivityFinalized: false
  });

  // Get linked task for task promotions
  const linkedTask = useMemo(() => {
    if (post.postType === 'task_promo' && post.taskId) {
      return tasks.find(t => t.id === post.taskId);
    }
    return null;
  }, [post.postType, post.taskId, tasks]);

  // Get user profiles for post author
  const { data: userProfiles = new Map() } = useGetUserProfiles([post.author]);

  // Determine if current user is the post owner
  const isPostOwner = useMemo(() => {
    return identity && post.author.toString() === identity.getPrincipal().toString();
  }, [identity, post.author]);

  // Check if post can be edited (only by owner and certain post types)
  const canEditPost = useMemo(() => {
    return isPostOwner && (post.postType === 'freecycle' || post.postType === 'swap' || 
                          post.postType === 'notice' || post.postType === 'volunteer_slotpack');
  }, [isPostOwner, post.postType]);

  // Check if post has availability slots that require time slot selection
  const hasAvailabilitySlots = (post: NeighbourhoodPost): boolean => {
    return !!(post.availabilityCalendar && 
              post.availabilityCalendar.availableDates.length > 0 && 
              post.availabilityCalendar.timeSlots.length > 0);
  };

  // Determine if user can see the precise location based on post type and interaction status
  const canSeePreciseLocation = useMemo(() => {
    // Post owner can always see precise location
    if (isPostOwner) {
      return true;
    }

    // If activity is finalized, only post owner can see precise location (for safety)
    if (interactionStatus.isActivityFinalized) {
      return false;
    }

    // Check based on post type and interaction status
    switch (post.postType) {
      case 'swap':
        // Show map to users who have been approved for swap or rejected
        return interactionStatus.isApprovedForSwap || interactionStatus.isRejectedFromSwap;
      
      case 'freecycle':
        // Show map to users who have been approved to pick up the item
        return interactionStatus.isApprovedForPickup;
      
      case 'volunteer_slotpack':
        // Show map to users who have been approved to volunteer
        return interactionStatus.isApprovedForVolunteering;
      
      case 'notice':
        // Notice posts follow general privacy rules - only approximate location for non-owners
        return false;
      
      case 'task_promo':
        // Task promotion posts follow existing task location privacy rules
        if (linkedTask) {
          const isTaskOwner = identity && linkedTask.requester.toString() === identity.getPrincipal().toString();
          const isAssignedTasker = identity && linkedTask.assignedTasker?.toString() === identity.getPrincipal().toString();
          
          // After task completion, only task owner can see precise location
          if (linkedTask.status === 'completed') {
            return isTaskOwner;
          }
          
          // When task is assigned, both task owner and assigned tasker can see precise location
          return isTaskOwner || (isAssignedTasker && linkedTask.status !== 'open');
        }
        return false;
      
      default:
        return false;
    }
  }, [isPostOwner, interactionStatus, post.postType, linkedTask, identity]);

  // Determine which coordinates to show based on privacy settings
  const displayCoords = useMemo(() => {
    if (!post.location.latitude || !post.location.longitude) {
      return null;
    }

    if (canSeePreciseLocation && showPreciseLocation) {
      return { lat: post.location.latitude, lng: post.location.longitude };
    } else {
      return addPrivacyOffset(post.location.latitude, post.location.longitude);
    }
  }, [post.location.latitude, post.location.longitude, canSeePreciseLocation, showPreciseLocation]);

  // Create map URL
  const mapUrl = useMemo(() => {
    if (!displayCoords) return null;
    
    return `https://www.openstreetmap.org/export/embed.html?bbox=${displayCoords.lng - 0.01},${displayCoords.lat - 0.01},${displayCoords.lng + 0.01},${displayCoords.lat + 0.01}&layer=mapnik&marker=${displayCoords.lat},${displayCoords.lng}`;
  }, [displayCoords]);

  const formatTimeAgo = (timestamp: bigint) => {
    const now = Date.now();
    const postTime = Number(timestamp) / 1000000; // Convert from nanoseconds to milliseconds
    const diffInHours = (now - postTime) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return new Date(postTime).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatTimeSlot = (startTime: bigint, endTime: bigint) => {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  // Enhanced function to format date and time together in user-friendly format
  const formatDateAndTime = (dateTimestamp: bigint, timeSlot: any): string => {
    const date = new Date(Number(dateTimestamp) / 1000000);
    const startTime = new Date(Number(timeSlot.startTime) / 1000000);
    const endTime = new Date(Number(timeSlot.endTime) / 1000000);
    
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
    
    const startTimeStr = startTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    const endTimeStr = endTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${dateStr} at ${startTimeStr} - ${endTimeStr}`;
  };

  const formatDateOnly = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'task_promo': return Megaphone;
      case 'swap': return Heart;
      case 'freecycle': return Gift;
      case 'notice': return Megaphone;
      case 'volunteer_slotpack': return HandHeart;
      default: return Users;
    }
  };

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case 'task_promo': return 'text-orange-500';
      case 'swap': return 'text-purple-500';
      case 'freecycle': return 'text-green-500';
      case 'notice': return 'text-blue-500';
      case 'volunteer_slotpack': return 'text-pink-500';
      default: return 'text-gray-500';
    }
  };

  const getPostTypeBadge = (postType: string) => {
    switch (postType) {
      case 'task_promo': return { text: 'Task Promo', bg: 'bg-orange-900/20 text-orange-400 border-orange-500/30' };
      case 'swap': return { text: 'Skill Swap', bg: 'bg-purple-900/20 text-purple-400 border-purple-500/30' };
      case 'freecycle': return { text: 'Freecycle', bg: 'bg-green-900/20 text-green-400 border-green-500/30' };
      case 'notice': return { text: 'Notice', bg: 'bg-blue-900/20 text-blue-400 border-blue-500/30' };
      case 'volunteer_slotpack': return { text: 'Volunteer Slots', bg: 'bg-pink-900/20 text-pink-400 border-pink-500/30' };
      default: return { text: 'Post', bg: 'bg-gray-900/20 text-gray-400 border-gray-500/30' };
    }
  };

  // Get post author display name - always show actual name, never "You"
  const getAuthorDisplayName = () => {
    const authorPrincipal = post.author.toString();
    const profile = userProfiles.get(authorPrincipal);
    
    if (profile?.displayName && profile.displayName.trim() !== '') {
      return profile.displayName;
    }
    
    if (profile?.name && profile.name.trim() !== '') {
      return profile.name;
    }
    
    // If it's the current user and we have their profile from userProfile hook
    if (identity && authorPrincipal === identity.getPrincipal().toString() && userProfile) {
      if (userProfile.displayName && userProfile.displayName.trim() !== '') {
        return userProfile.displayName;
      }
      if (userProfile.name && userProfile.name.trim() !== '') {
        return userProfile.name;
      }
    }
    
    return `${authorPrincipal.slice(0, 8)}...`;
  };

  // Get post author profile picture - always show actual picture, even for current user
  const getAuthorProfilePicture = () => {
    const authorPrincipal = post.author.toString();
    const profile = userProfiles.get(authorPrincipal);
    
    // If we have the profile picture from the fetched profiles, use it
    if (profile?.profilePicture) {
      return profile.profilePicture;
    }
    
    // If it's the current user and we have their profile from userProfile hook
    if (identity && authorPrincipal === identity.getPrincipal().toString() && userProfile?.profilePicture) {
      return userProfile.profilePicture;
    }
    
    return undefined;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const getLocationPrivacyMessage = () => {
    if (isPostOwner) {
      return 'You can view the exact location because you are the post owner.';
    }

    if (interactionStatus.isActivityFinalized) {
      return 'Activity has been completed. Only the post owner can view the exact address for safety.';
    }

    switch (post.postType) {
      case 'swap':
        if (interactionStatus.isApprovedForSwap) {
          return 'You can view the exact location because your swap request was approved.';
        } else if (interactionStatus.isRejectedFromSwap) {
          return 'You can view the exact location because you previously made a swap request.';
        } else {
          return 'Exact location will be shared if your swap request is approved.';
        }
      
      case 'freecycle':
        if (interactionStatus.isApprovedForPickup) {
          return 'You can view the exact location because you were approved to pick up this item.';
        } else {
          return 'Exact location will be shared if you are approved to pick up this item.';
        }
      
      case 'volunteer_slotpack':
        if (interactionStatus.isApprovedForVolunteering) {
          return 'You can view the exact location because you were approved to volunteer.';
        } else {
          return 'Exact location will be shared if you are approved to volunteer.';
        }
      
      case 'notice':
        return 'For privacy, only an approximate location is shown for community notices.';
      
      case 'task_promo':
        if (linkedTask) {
          if (linkedTask.status === 'completed') {
            return 'Task is completed. Only the task owner can view the exact address.';
          } else if (linkedTask.status === 'open') {
            return 'Exact address will be shared with the assigned tasker when the task is accepted.';
          } else {
            return 'Approximate location shown for privacy.';
          }
        }
        return 'Location information follows task privacy rules.';
      
      default:
        return 'For privacy, only an approximate location is shown.';
    }
  };

  // Enhanced action handlers with proper event isolation and immediate feedback
  const handleClaimSwap = async () => {
    if (!identity || !userProfile) {
      setToast({
        message: 'Please log in to claim swaps.',
        type: 'error'
      });
      return;
    }
    
    // Provide immediate visual feedback
    setActionStates(prev => ({ ...prev, claimingSwap: true }));
    
    try {
      // Check if time slot selection is required - this is now mandatory when slots exist
      if (hasAvailabilitySlots(post)) {
        setActionStates(prev => ({ ...prev, claimingSwap: false }));
        setTimeSlotPicker({
          show: true,
          post,
          action: 'swap',
          selectedTimeSlot: null
        });
        return;
      }
      
      // Proceed with claim if no time slots are required
      await claimSwap.mutateAsync({ postId: post.id, post });
      setToast({
        message: 'Swap claimed successfully! The post owner will review your request.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to claim swap:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim swap. Please try again.';
      setToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setActionStates(prev => ({ ...prev, claimingSwap: false }));
    }
  };

  const handleClaimFreecycle = async () => {
    if (!identity || !userProfile) {
      setToast({
        message: 'Please log in to request pickup.',
        type: 'error'
      });
      return;
    }
    
    // Provide immediate visual feedback
    setActionStates(prev => ({ ...prev, claimingFreecycle: true }));
    
    try {
      // Check if time slot selection is required - this is now mandatory when slots exist
      if (hasAvailabilitySlots(post)) {
        setActionStates(prev => ({ ...prev, claimingFreecycle: false }));
        setTimeSlotPicker({
          show: true,
          post,
          action: 'freecycle',
          selectedTimeSlot: null
        });
        return;
      }
      
      // Proceed with claim if no time slots are required
      await claimFreecycleItem.mutateAsync({ postId: post.id, post });
      setToast({
        message: 'Pickup request sent successfully! The post owner will review your request.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to claim freecycle item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to request pickup. Please try again.';
      setToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setActionStates(prev => ({ ...prev, claimingFreecycle: false }));
    }
  };

  const handlePledgeSlot = async () => {
    if (!identity || !userProfile) {
      setToast({
        message: 'Please log in to pledge volunteer slots.',
        type: 'error'
      });
      return;
    }
    
    // Provide immediate visual feedback
    setActionStates(prev => ({ ...prev, pledgingVolunteer: true }));
    
    try {
      // Check if time slot selection is required - this is now mandatory when slots exist
      if (hasAvailabilitySlots(post)) {
        setActionStates(prev => ({ ...prev, pledgingVolunteer: false }));
        setTimeSlotPicker({
          show: true,
          post,
          action: 'volunteer_slot',
          selectedTimeSlot: null
        });
        return;
      }
      
      // Proceed with pledge if no time slots are required
      await pledgeVolunteerSlot.mutateAsync({ postId: post.id, post });
      setToast({
        message: 'Volunteer slot pledged successfully! Thank you for volunteering.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to pledge volunteer slot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to pledge volunteer slot. Please try again.';
      setToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setActionStates(prev => ({ ...prev, pledgingVolunteer: false }));
    }
  };

  // Enhanced message author handler that always opens a new message thread in the Messages tab
  const handleOpenChat = async () => {
    if (!identity || !userProfile) {
      setToast({
        message: 'Please log in to message the author.',
        type: 'error'
      });
      return;
    }
    
    // Provide immediate visual feedback
    setActionStates(prev => ({ ...prev, messagingAuthor: true }));
    
    try {
      const authorDisplayName = getAuthorDisplayName();
      const authorPrincipal = post.author.toString();
      
      // Show immediate success feedback
      setToast({
        message: `Opening new message thread with ${authorDisplayName}...`,
        type: 'success'
      });
      
      // Always navigate to Messages tab with author information to create a new thread
      if (onNavigateToMessages) {
        onNavigateToMessages(authorPrincipal, authorDisplayName);
      }
      
      // Close the modal after a short delay to show the success message
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to message author:', error);
      setToast({
        message: 'Failed to open message thread. Please try again.',
        type: 'error'
      });
    } finally {
      setActionStates(prev => ({ ...prev, messagingAuthor: false }));
    }
  };

  // Handle time slot selection and proceed with action
  const handleTimeSlotSelected = (timeSlot: TimeSlot) => {
    setTimeSlotPicker(prev => ({ ...prev, selectedTimeSlot: timeSlot }));
  };

  const handleTimeSlotPickerClose = async () => {
    const { post: pickerPost, action, selectedTimeSlot } = timeSlotPicker;
    
    if (pickerPost && action && selectedTimeSlot) {
      try {
        switch (action) {
          case 'swap':
            await claimSwap.mutateAsync({ postId: pickerPost.id, post: pickerPost, selectedTimeSlot });
            setToast({
              message: 'Swap claimed successfully with selected time slot! The post owner will review your request.',
              type: 'success'
            });
            break;
          case 'freecycle':
            await claimFreecycleItem.mutateAsync({ postId: pickerPost.id, post: pickerPost, selectedTimeSlot });
            setToast({
              message: 'Pickup request sent successfully with selected time slot! The post owner will review your request.',
              type: 'success'
            });
            break;
          case 'volunteer_slot':
            await pledgeVolunteerSlot.mutateAsync({ postId: pickerPost.id, post: pickerPost, selectedTimeSlot });
            setToast({
              message: 'Volunteer slot pledged successfully with selected time slot! Thank you for volunteering.',
              type: 'success'
            });
            break;
        }
      } catch (error) {
        console.error(`Failed to ${action}:`, error);
        const errorMessage = error instanceof Error ? error.message : `Failed to ${action}. Please try again.`;
        setToast({
          message: errorMessage,
          type: 'error'
        });
      }
    }
    
    // Reset time slot picker state
    setTimeSlotPicker({
      show: false,
      post: null,
      action: null,
      selectedTimeSlot: null
    });
  };

  const handleSavePost = () => {
    // TODO: Implement save functionality when backend is ready
    console.log('Save post:', post.id);
  };

  const handleSharePost = () => {
    // TODO: Implement share functionality
    console.log('Share post:', post.id);
  };

  const handleReportPost = () => {
    // TODO: Implement report functionality when backend is ready
    console.log('Report post:', post.id);
  };

  const handleViewTask = () => {
    // TODO: Navigate to task detail view
    console.log('View task:', post.taskId);
  };

  const handleEditPost = () => {
    setShowEditModal(true);
  };

  const handleSaveEditedPost = (updatedPost: NeighbourhoodPost) => {
    // TODO: Implement backend update when available
    console.log('Saving edited post:', updatedPost);
    setShowEditModal(false);
    // For now, just close the modal - in real implementation, this would update the backend
    onClose();
  };

  const PostTypeIcon = getPostTypeIcon(post.postType);
  const typeColor = getPostTypeColor(post.postType);
  const typeBadge = getPostTypeBadge(post.postType);
  const authorDisplayName = getAuthorDisplayName();
  const authorProfilePicture = getAuthorProfilePicture();

  // Toast notification component
  const ActionToast = ({ 
    message, 
    type, 
    onClose: onToastClose 
  }: { 
    message: string; 
    type: 'success' | 'error'; 
    onClose: () => void; 
  }) => {
    React.useEffect(() => {
      const timer = setTimeout(onToastClose, 4000);
      return () => clearTimeout(timer);
    }, [onToastClose]);

    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <div className={`rounded-lg shadow-lg border p-4 ${
          type === 'success' 
            ? 'bg-green-900/90 border-green-500/50 text-green-100' 
            : 'bg-red-900/90 border-red-500/50 text-red-100'
        }`}>
          <div className="flex items-center gap-2">
            {type === 'success' ? (
              <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message}</p>
          </div>
        </div>
      </div>
    );
  };

  if (showEditModal) {
    return (
      <EditFeedPostModal
        post={post}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEditedPost}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="sm:hidden">Back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Post Details</h2>
        <div className="flex items-center gap-2">
          {canEditPost && (
            <button
              onClick={handleEditPost}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
            >
              <Edit3 size={16} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors sm:block hidden"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8 space-y-6 max-w-4xl mx-auto">
          {/* Enhanced Post Header with Prominent Author Display - No "You" badge */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            {/* Prominent Author Section - Hero Style */}
            <div className="flex items-center gap-5 mb-6 p-5 bg-gradient-to-r from-gray-700/80 to-gray-600/60 rounded-xl border border-gray-600/80 shadow-lg">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-orange-500 flex items-center justify-center flex-shrink-0 shadow-xl ring-4 ring-orange-500/20">
                {authorProfilePicture ? (
                  <img
                    src={authorProfilePicture}
                    alt="Author"
                    className="w-full h-full object-cover"
                    onError={(e) => {
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
                  className={`text-white font-bold text-2xl ${authorProfilePicture ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}
                >
                  {getInitials(authorDisplayName)}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-white font-bold text-2xl leading-tight tracking-wide drop-shadow-sm">
                    {authorDisplayName}
                  </h2>
                  {/* Removed "You" badge completely */}
                </div>
                <div className="flex items-center gap-4 text-gray-300">
                  <span className="text-base font-semibold">Post Author</span>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={14} />
                    <span>{formatTimeAgo(post.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Post Type and Title */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <PostTypeIcon size={20} className={typeColor} />
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${typeBadge.bg}`}>
                  {typeBadge.text}
                </span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">{post.title}</h1>
            <p className="text-gray-300 text-base leading-relaxed mb-4">{post.description}</p>

            {/* Category */}
            {post.category && (
              <div className="flex items-center gap-2 mb-4">
                <Tag size={16} className="text-orange-500" />
                <span className="text-orange-400 font-medium">{post.category}</span>
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-700 text-gray-300 text-sm rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Task Promo - Show linked task details */}
          {post.postType === 'task_promo' && linkedTask && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Megaphone size={18} className="text-orange-500" />
                Promoted Task Details
              </h3>
              
              <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium text-lg">{linkedTask.title}</h4>
                  {linkedTask.taskType === TaskType.paid ? (
                    <span className="text-orange-500 font-bold text-xl">
                      ${(Number(linkedTask.budget) / 100).toLocaleString()}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full">
                      <Heart size={14} />
                      <span>Volunteer</span>
                    </div>
                  )}
                </div>
                
                <p className="text-gray-300 text-sm leading-relaxed">{linkedTask.description}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-600">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Calendar size={14} />
                    <span>Due: {new Date(Number(linkedTask.dueDate) / 1000000).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Tag size={14} />
                    <span>{linkedTask.category}</span>
                  </div>
                </div>

                {linkedTask.requiredSkills.length > 0 && (
                  <div className="pt-3 border-t border-gray-600">
                    <span className="text-gray-400 text-sm mb-2 block">Required Skills:</span>
                    <div className="flex flex-wrap gap-2">
                      {linkedTask.requiredSkills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-600">
                  <button
                    onClick={handleViewTask}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Eye size={16} />
                    <span>View Full Task Details</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Swap - Show exchange availability details with combined date and time and claim action */}
          {post.postType === 'swap' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Heart size={18} className="text-purple-500" />
                Skill/Item Swap
              </h3>
              
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 space-y-4">
                {/* Show availability calendar if it exists */}
                {post.availabilityCalendar && post.availabilityCalendar.availableDates.length > 0 && post.availabilityCalendar.timeSlots.length > 0 ? (
                  <div className="space-y-4">
                    {/* Availability Summary */}
                    <div className="flex items-center gap-4 text-purple-400 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{post.availabilityCalendar.availableDates.length} available date{post.availabilityCalendar.availableDates.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{post.availabilityCalendar.timeSlots.length} time slot{post.availabilityCalendar.timeSlots.length !== 1 ? 's' : ''} per day</span>
                      </div>
                    </div>

                    {/* Enhanced Available Dates and Times with combined display */}
                    <div>
                      <h4 className="text-purple-400 font-medium mb-3">Available Exchange Times</h4>
                      <div className="space-y-3">
                        {post.availabilityCalendar.availableDates
                          .sort((a, b) => Number(a - b))
                          .map((dateTimestamp, dateIndex) => (
                            <div key={dateIndex} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                              <div className="text-white font-medium text-base mb-3">
                                {formatDateOnly(dateTimestamp)}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {post.availabilityCalendar!.timeSlots.map((timeSlot, slotIndex) => (
                                  <div key={slotIndex} className="bg-gray-600 rounded-lg p-3 border border-gray-500">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-purple-500" />
                                      <span className="text-white font-medium text-sm">
                                        {formatTimeSlot(timeSlot.startTime, timeSlot.endTime)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Duration Information */}
                    <div className="pt-3 border-t border-purple-500/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Clock size={14} className="text-purple-500" />
                          <span>Duration: {Number(post.availabilityCalendar.durationMinutes)} minutes</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar size={14} className="text-purple-500" />
                          <span>Intervals: {Number(post.availabilityCalendar.intervalMinutes)} minutes</span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Next Available Exchange with combined date and time */}
                    <div className="bg-purple-800/30 rounded-lg p-3 border border-purple-400/30">
                      <div className="flex items-center gap-2 text-purple-300 text-sm mb-1">
                        <CheckCircle size={14} />
                        <span className="font-medium">Next Available Exchange</span>
                      </div>
                      <p className="text-white text-sm font-medium">
                        {formatDateAndTime(post.availabilityCalendar.availableDates[0], post.availabilityCalendar.timeSlots[0])}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <AlertCircle size={24} className="mx-auto mb-2 text-yellow-400" />
                    <p className="text-yellow-400 font-medium mb-1">No Exchange Times Set</p>
                    <p className="text-gray-300 text-sm">
                      The post owner hasn't specified when they're available for the exchange.
                    </p>
                  </div>
                )}
                
                {/* Enhanced Claim Action for Swap with proper time slot handling */}
                <div className="pt-4 border-t border-purple-500/30">
                  {identity && userProfile && !isPostOwner ? (
                    <div className="flex gap-3">
                      <button
                        onClick={handleClaimSwap}
                        disabled={actionStates.claimingSwap}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                      >
                        {actionStates.claimingSwap ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Heart size={16} />
                        )}
                        <span>
                          {actionStates.claimingSwap ? 'Claiming...' : 
                           hasAvailabilitySlots(post) ? 'Claim Swap (Select Time)' : 'Claim Swap'}
                        </span>
                      </button>
                      
                      <button
                        onClick={handleOpenChat}
                        disabled={actionStates.messagingAuthor}
                        className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                      >
                        {actionStates.messagingAuthor ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <MessageCircle size={16} />
                        )}
                        <span>
                          {actionStates.messagingAuthor ? 'Opening...' : 'Message Author'}
                        </span>
                      </button>
                    </div>
                  ) : !identity ? (
                    <div className="w-full bg-gray-600 text-gray-300 px-4 py-3 rounded-lg text-center">
                      <span>Login to claim this swap</span>
                    </div>
                  ) : isPostOwner ? (
                    <div className="text-center py-2 text-gray-400">
                      <p className="text-sm">This is your swap post</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Freecycle - Show pickup availability details with combined date and time */}
          {post.postType === 'freecycle' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-green-500" />
                Pickup Availability
              </h3>
              
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 space-y-4">
                {post.availabilityCalendar && post.availabilityCalendar.availableDates.length > 0 && post.availabilityCalendar.timeSlots.length > 0 ? (
                  <div className="space-y-4">
                    {/* Availability Summary */}
                    <div className="flex items-center gap-4 text-green-400 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{post.availabilityCalendar.availableDates.length} available date{post.availabilityCalendar.availableDates.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{post.availabilityCalendar.timeSlots.length} time slot{post.availabilityCalendar.timeSlots.length !== 1 ? 's' : ''} per day</span>
                      </div>
                    </div>

                    {/* Enhanced Available Dates and Times with combined display */}
                    <div>
                      <h4 className="text-green-400 font-medium mb-3">Available Pickup Times</h4>
                      <div className="space-y-3">
                        {post.availabilityCalendar.availableDates
                          .sort((a, b) => Number(a - b))
                          .map((dateTimestamp, dateIndex) => (
                            <div key={dateIndex} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                              <div className="text-white font-medium text-base mb-3">
                                {formatDateOnly(dateTimestamp)}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {post.availabilityCalendar!.timeSlots.map((timeSlot, slotIndex) => (
                                  <div key={slotIndex} className="bg-gray-600 rounded-lg p-3 border border-gray-500">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-green-500" />
                                      <span className="text-white font-medium text-sm">
                                        {formatTimeSlot(timeSlot.startTime, timeSlot.endTime)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Duration Information */}
                    <div className="pt-3 border-t border-green-500/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Clock size={14} className="text-green-500" />
                          <span>Duration: {Number(post.availabilityCalendar.durationMinutes)} minutes</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar size={14} className="text-green-500" />
                          <span>Intervals: {Number(post.availabilityCalendar.intervalMinutes)} minutes</span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Next Available Pickup with combined date and time */}
                    <div className="bg-green-800/30 rounded-lg p-3 border border-green-400/30">
                      <div className="flex items-center gap-2 text-green-300 text-sm mb-1">
                        <CheckCircle size={14} />
                        <span className="font-medium">Next Available Pickup</span>
                      </div>
                      <p className="text-white text-sm font-medium">
                        {formatDateAndTime(post.availabilityCalendar.availableDates[0], post.availabilityCalendar.timeSlots[0])}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <AlertCircle size={24} className="mx-auto mb-2 text-yellow-400" />
                    <p className="text-yellow-400 font-medium mb-1">No Pickup Times Set</p>
                    <p className="text-gray-300 text-sm">
                      The post owner hasn't specified when items are available for pickup.
                    </p>
                  </div>
                )}
                
                {/* Claim Action for Freecycle */}
                <div className="pt-4 border-t border-green-500/30">
                  {identity && userProfile && !isPostOwner ? (
                    <button
                      onClick={handleClaimFreecycle}
                      disabled={actionStates.claimingFreecycle}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    >
                      {actionStates.claimingFreecycle ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Gift size={16} />
                      )}
                      <span>
                        {actionStates.claimingFreecycle ? 'Claiming...' : 'Request Pickup'}
                      </span>
                    </button>
                  ) : !identity ? (
                    <div className="w-full bg-gray-600 text-gray-300 px-4 py-3 rounded-lg text-center">
                      <span>Login to request pickup</span>
                    </div>
                  ) : isPostOwner ? (
                    <div className="text-center py-2 text-gray-400">
                      <p className="text-sm">This is your freecycle post</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Volunteer Slot Pack - Show slot details and activity availability with combined date and time */}
          {post.postType === 'volunteer_slotpack' && post.slotCount && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <HandHeart size={18} className="text-pink-500" />
                Volunteer Opportunity
              </h3>
              
              <div className="bg-pink-900/20 border border-pink-500/30 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-pink-400 text-lg font-semibold">
                    {post.pledgedSlots || 0} / {post.slotCount} slots filled
                  </span>
                  <div className="w-24 bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-pink-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${((post.pledgedSlots || 0) / post.slotCount) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Enhanced Activity Availability Details with combined date and time */}
                {post.availabilityCalendar && post.availabilityCalendar.availableDates.length > 0 && post.availabilityCalendar.timeSlots.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-pink-500/30">
                    {/* Availability Summary */}
                    <div className="flex items-center gap-4 text-pink-400 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{post.availabilityCalendar.availableDates.length} available date{post.availabilityCalendar.availableDates.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{post.availabilityCalendar.timeSlots.length} time slot{post.availabilityCalendar.timeSlots.length !== 1 ? 's' : ''} per day</span>
                      </div>
                    </div>

                    {/* Enhanced Available Dates and Times with combined display */}
                    <div>
                      <h4 className="text-pink-400 font-medium mb-3">Available Activity Times</h4>
                      <div className="space-y-3">
                        {post.availabilityCalendar.availableDates
                          .sort((a, b) => Number(a - b))
                          .map((dateTimestamp, dateIndex) => (
                            <div key={dateIndex} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                              <div className="text-white font-medium text-base mb-3">
                                {formatDateOnly(dateTimestamp)}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {post.availabilityCalendar!.timeSlots.map((timeSlot, slotIndex) => (
                                  <div key={slotIndex} className="bg-gray-600 rounded-lg p-3 border border-gray-500">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-pink-500" />
                                      <span className="text-white font-medium text-sm">
                                        {formatTimeSlot(timeSlot.startTime, timeSlot.endTime)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Duration Information */}
                    <div className="pt-3 border-t border-pink-500/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Clock size={14} className="text-pink-500" />
                          <span>Duration: {Number(post.availabilityCalendar.durationMinutes)} minutes</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar size={14} className="text-pink-500" />
                          <span>Intervals: {Number(post.availabilityCalendar.intervalMinutes)} minutes</span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Next Available Activity with combined date and time */}
                    <div className="bg-pink-800/30 rounded-lg p-3 border border-pink-400/30">
                      <div className="flex items-center gap-2 text-pink-300 text-sm mb-1">
                        <CheckCircle size={14} />
                        <span className="font-medium">Next Scheduled Activity</span>
                      </div>
                      <p className="text-white text-sm font-medium">
                        {formatDateAndTime(post.availabilityCalendar.availableDates[0], post.availabilityCalendar.timeSlots[0])}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="text-center">
                  <button
                    onClick={handlePledgeSlot}
                    disabled={actionStates.pledgingVolunteer || (post.pledgedSlots || 0) >= post.slotCount || !identity || !userProfile}
                    className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  >
                    {actionStates.pledgingVolunteer ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <HandHeart size={16} />
                    )}
                    <span>
                      {actionStates.pledgingVolunteer ? 'Pledging...' :
                       (post.pledgedSlots || 0) >= post.slotCount ? 'All Slots Filled' : 
                       !identity ? 'Login to Pledge' : 'Pledge to Volunteer'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notice - Show discussion action */}
          {post.postType === 'notice' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Megaphone size={18} className="text-blue-500" />
                Community Notice
              </h3>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-gray-300 text-sm mb-4">
                  Have questions or want to discuss this notice? Start a conversation with the author.
                </p>
                
                <button
                  onClick={handleOpenChat}
                  disabled={actionStates.messagingAuthor}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {actionStates.messagingAuthor ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  <span>
                    {actionStates.messagingAuthor ? 'Opening...' : 'Discuss with Author'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Location Details with Dynamic Map Visibility */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-orange-500" />
              Location
            </h3>
            
            <div className="space-y-4">
              {/* Address Display */}
              <div className="flex items-center gap-2 text-gray-300 mb-4">
                <MapPin size={16} className="text-orange-500" />
                <span>
                  {canSeePreciseLocation && showPreciseLocation && post.location.address ? 
                    `${post.location.address}, ${post.location.suburb}, ${post.location.state} ${post.location.postcode}` :
                    `${post.location.suburb}, ${post.location.state} ${post.location.postcode}`
                  }
                </span>
                <span className="text-xs text-gray-400">• {post.visibilityRadius}km radius</span>
              </div>

              {/* Map Container - Always visible to post owner, conditionally visible to others */}
              {(isPostOwner || canSeePreciseLocation) && mapUrl ? (
                <div className="relative mb-4">
                  <iframe
                    src={mapUrl}
                    width="100%"
                    height="300"
                    className="rounded-lg border border-gray-600"
                    title="Post Location Map"
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

                  {/* Finalized activity overlay */}
                  {interactionStatus.isActivityFinalized && !isPostOwner && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center">
                      <div className="bg-gray-900 bg-opacity-90 text-white px-4 py-3 rounded-lg text-sm font-medium text-center">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle size={16} />
                          <span>Activity Completed</span>
                        </div>
                        <p className="text-xs text-gray-300">
                          Location now private for safety
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : !isPostOwner && !canSeePreciseLocation ? (
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 mb-4">
                  <div className="flex items-center gap-2 text-yellow-400 mb-2">
                    <MapPin size={16} />
                    <span className="font-medium">Location Not Available</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {post.postType === 'swap' && 'Map will be shown if your swap request is approved or rejected.'}
                    {post.postType === 'freecycle' && 'Map will be shown if you are approved to pick up this item.'}
                    {post.postType === 'volunteer_slotpack' && 'Map will be shown if you are approved to volunteer.'}
                    {post.postType === 'notice' && 'Only approximate location is shown for community notices.'}
                    {post.postType === 'task_promo' && 'Map follows task privacy rules.'}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 mb-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <AlertCircle size={16} />
                    <span className="font-medium">Map Unavailable</span>
                  </div>
                  <p className="text-gray-400 text-sm">Could not load map for this location</p>
                </div>
              )}

              {/* Toggle Button for Precise Location - Only show if user has permission and there's a street address */}
              {canSeePreciseLocation && post.location.address && post.location.address.trim() !== '' && (
                <button
                  onClick={() => setShowPreciseLocation(!showPreciseLocation)}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium mb-4"
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
                  {getLocationPrivacyMessage()}
                </p>
              </div>

              {/* Activity Status Indicators */}
              {!isPostOwner && (
                <div className="space-y-2">
                  {/* Swap Status */}
                  {post.postType === 'swap' && (
                    <div className="space-y-2">
                      {interactionStatus.isApprovedForSwap && (
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-green-400 text-sm">
                            <Heart size={14} />
                            <span className="font-medium">Swap Approved</span>
                          </div>
                          <p className="text-gray-300 text-xs">
                            Your swap request has been approved. You can view the exact location.
                          </p>
                        </div>
                      )}
                      
                      {interactionStatus.isRejectedFromSwap && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-red-400 text-sm">
                            <X size={14} />
                            <span className="font-medium">Swap Request Declined</span>
                          </div>
                          <p className="text-gray-300 text-xs">
                            Your swap request was not accepted, but you can still view the location.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Freecycle Status */}
                  {post.postType === 'freecycle' && interactionStatus.isApprovedForPickup && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <Gift size={14} />
                        <span className="font-medium">Pickup Approved</span>
                      </div>
                      <p className="text-gray-300 text-xs">
                        You have been approved to pick up this item. You can view the exact location.
                      </p>
                    </div>
                  )}

                  {/* Volunteer Status */}
                  {post.postType === 'volunteer_slotpack' && interactionStatus.isApprovedForVolunteering && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <HandHeart size={14} />
                        <span className="font-medium">Volunteer Approved</span>
                      </div>
                      <p className="text-gray-300 text-xs">
                        You have been approved to volunteer. You can view the exact location.
                      </p>
                    </div>
                  )}

                  {/* Finalized Activity Warning */}
                  {interactionStatus.isActivityFinalized && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <AlertCircle size={14} />
                        <span className="font-medium">Activity Completed</span>
                      </div>
                      <p className="text-gray-300 text-xs">
                        This activity has been completed. The exact location is now private for safety reasons.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Post Images */}
          {post.images && post.images.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Images</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {post.images.map((imageUrl, index) => (
                  <div key={index} className="relative">
                    <img
                      src={imageUrl}
                      alt={`Post image ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-600"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post Reactions */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <FeedPostReactions postId={post.id} compact={false} />
          </div>

          {/* Post Comments */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <FeedPostComments postId={post.id} compact={false} />
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Enhanced Message Author Button - Always opens new message thread in Messages tab */}
              {identity && userProfile && !isPostOwner && (
                <button
                  onClick={handleOpenChat}
                  disabled={actionStates.messagingAuthor}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
                >
                  {actionStates.messagingAuthor ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  <span>
                    {actionStates.messagingAuthor ? 'Opening...' : 'Message Author'}
                  </span>
                </button>
              )}

              {/* Save */}
              <button
                onClick={handleSavePost}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors font-medium ${
                  post.isSaved 
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
                }`}
              >
                <Bookmark size={16} />
                <span>{post.isSaved ? 'Saved' : 'Save Post'}</span>
              </button>

              {/* Share */}
              <button
                onClick={handleSharePost}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-3 rounded-lg transition-colors font-medium border border-gray-600"
              >
                <Share size={16} />
                <span>Share</span>
              </button>

              {/* Report */}
              <button
                onClick={handleReportPost}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
              >
                <Flag size={16} />
                <span>Report</span>
              </button>
            </div>

            {/* Enhanced Message Author Information Notice */}
            {identity && userProfile && !isPostOwner && (
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                  <MessageCircle size={14} />
                  <span className="font-medium">Seamless Messaging Experience</span>
                </div>
                <p className="text-gray-300 text-xs">
                  Clicking "Message Author" will open a new message thread with {authorDisplayName} in the Messages tab, 
                  providing a seamless and intuitive messaging experience.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Toast Notification for Action Feedback */}
      {toast && (
        <ActionToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Enhanced Time Slot Picker Modal for Swap Posts */}
      {timeSlotPicker.show && timeSlotPicker.post && timeSlotPicker.action && (
        <FeedTimeSlotPicker
          availabilityCalendar={timeSlotPicker.post.availabilityCalendar!}
          selectedTimeSlot={timeSlotPicker.selectedTimeSlot}
          onTimeSlotSelect={handleTimeSlotSelected}
          onClose={handleTimeSlotPickerClose}
          postType={timeSlotPicker.action}
          postTitle={timeSlotPicker.post.title}
          postId={timeSlotPicker.post.id}
        />
      )}
    </div>
  );
}
