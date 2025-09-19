import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Heart, User, Clock, CheckCircle, AlertCircle, MapPin, Calendar, XCircle, UserCheck } from 'lucide-react';
import { useGetUserProfiles, useApproveSwapClaim, useRejectSwapClaim, useMarkSwapCompleted, useMarkSwapDidNotOccur, useGetNeighbourhoodPosts } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Notification } from '../backend';
import { Principal } from '@dfinity/principal';
import { NeighbourhoodPost } from '../hooks/useQueries';

interface SwapClaimApprovalModalProps {
  notification: Notification;
  onClose: () => void;
}

// Toast notification component for immediate feedback
function ActionToast({ 
  message, 
  type, 
  onClose 
}: { 
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void; 
}) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

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
}

export default function SwapClaimApprovalModal({ notification, onClose }: SwapClaimApprovalModalProps) {
  const { identity } = useInternetIdentity();
  const { data: neighbourhoodPosts = [] } = useGetNeighbourhoodPosts();
  const approveSwapClaim = useApproveSwapClaim();
  const rejectSwapClaim = useRejectSwapClaim();
  const markSwapCompleted = useMarkSwapCompleted();
  const markSwapDidNotOccur = useMarkSwapDidNotOccur();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Toast state for immediate feedback
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Extract post ID and claimant from notification
  const postId = notification.id.split('_swap_claim_')[0];
  const claimantPrincipalText = notification.id.split('_swap_claim_')[1];
  
  // Find the swap post
  const swapPost = neighbourhoodPosts.find(p => p.id === postId && p.postType === 'swap');
  
  // Get claimant principal
  let claimantPrincipal: Principal | null = null;
  try {
    if (claimantPrincipalText) {
      claimantPrincipal = Principal.fromText(claimantPrincipalText);
    }
  } catch (error) {
    console.error('Invalid claimant principal:', claimantPrincipalText);
  }

  // Fetch claimant profile
  const { data: userProfiles = new Map() } = useGetUserProfiles(
    claimantPrincipal ? [claimantPrincipal] : []
  );

  const claimantProfile = claimantPrincipal ? userProfiles.get(claimantPrincipal.toString()) : null;
  const claimantDisplayName = notification.principal || 'Unknown User';

  // Prevent background scrolling
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Focus management
  useEffect(() => {
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, []);

  // Trap focus within modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusableRef.current) {
          e.preventDefault();
          lastFocusableRef.current?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusableRef.current) {
          e.preventDefault();
          firstFocusableRef.current?.focus();
        }
      }
    }
  };

  const handleApproveSwapClaim = async () => {
    if (!claimantPrincipal) {
      console.error('Cannot approve: claimant principal not found');
      setToast({
        message: 'Error: Could not identify the claimant. Please try again.',
        type: 'error'
      });
      return;
    }

    try {
      await approveSwapClaim.mutateAsync({ postId, claimant: claimantPrincipal });
      setToast({
        message: `Swap request approved successfully! ${claimantDisplayName} has been notified and the swap is now assigned.`,
        type: 'success'
      });
      // Close modal after showing success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to approve swap claim:', error);
      setToast({
        message: 'Failed to approve swap request. Please try again.',
        type: 'error'
      });
    }
  };

  const handleRejectSwapClaim = async () => {
    if (!claimantPrincipal) {
      console.error('Cannot reject: claimant principal not found');
      setToast({
        message: 'Error: Could not identify the claimant. Please try again.',
        type: 'error'
      });
      return;
    }

    try {
      await rejectSwapClaim.mutateAsync({ postId, claimant: claimantPrincipal });
      setToast({
        message: `Swap request rejected. ${claimantDisplayName} has been notified and the swap is now open for new claims.`,
        type: 'success'
      });
      // Close modal after showing success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to reject swap claim:', error);
      setToast({
        message: 'Failed to reject swap request. Please try again.',
        type: 'error'
      });
    }
  };

  const handleMarkCompleted = async () => {
    if (!claimantPrincipal) {
      console.error('Cannot mark completed: claimant principal not found');
      setToast({
        message: 'Error: Could not identify the claimant. Please try again.',
        type: 'error'
      });
      return;
    }

    try {
      await markSwapCompleted.mutateAsync({ postId, claimant: claimantPrincipal });
      setToast({
        message: `Swap marked as completed successfully! ${claimantDisplayName} has been notified.`,
        type: 'success'
      });
      // Close modal after showing success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to mark swap as completed:', error);
      setToast({
        message: 'Failed to mark swap as completed. Please try again.',
        type: 'error'
      });
    }
  };

  const handleMarkDidNotOccur = async () => {
    try {
      await markSwapDidNotOccur.mutateAsync(postId);
      setToast({
        message: 'Swap marked as did not occur. The swap is now open for new claims.',
        type: 'success'
      });
      // Close modal after showing success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to mark swap as did not occur:', error);
      setToast({
        message: 'Failed to update swap status. Please try again.',
        type: 'error'
      });
    }
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  // Determine what actions are available based on swap status
  const getAvailableActions = () => {
    if (!swapPost) return { canApprove: false, canReject: false, canComplete: false, canMarkDidNotOccur: false };
    
    switch (swapPost.status) {
      case 'pending':
        return { canApprove: true, canReject: true, canComplete: false, canMarkDidNotOccur: false };
      case 'assigned':
        return { canApprove: false, canReject: false, canComplete: true, canMarkDidNotOccur: true };
      default:
        return { canApprove: false, canReject: false, canComplete: false, canMarkDidNotOccur: false };
    }
  };

  const availableActions = getAvailableActions();

  if (!swapPost) {
    return (
      <div 
        className="fixed inset-0 z-50 h-[100dvh] w-full bg-gray-900 md:bg-black md:bg-opacity-50 md:flex md:items-center md:justify-center md:p-4"
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col h-full w-full overflow-hidden md:max-w-2xl md:mx-auto md:my-10 md:rounded-2xl md:shadow-lg md:bg-gray-900 md:h-auto">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-700 bg-gray-800 md:bg-gray-900 flex-shrink-0">
            <button
              ref={firstFocusableRef}
              onClick={onClose}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="md:hidden">Back</span>
            </button>
            <h2 className="text-lg md:text-xl font-bold text-white">Swap Claim</h2>
            <button
              ref={lastFocusableRef}
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors hidden md:block"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold text-white mb-2">Swap Post Not Found</h3>
              <p className="text-gray-400">
                The swap post associated with this claim could not be found.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="fixed inset-0 z-50 h-[100dvh] w-full bg-gray-900 md:bg-black md:bg-opacity-50 md:flex md:items-center md:justify-center md:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-claim-approval-title"
        onKeyDown={handleKeyDown}
      >
        {/* Mobile: Full screen modal */}
        <div 
          ref={modalRef}
          className="flex flex-col h-full w-full overflow-hidden md:max-w-4xl md:mx-auto md:my-10 md:rounded-2xl md:shadow-lg md:bg-gray-900 md:h-auto md:min-h-0 md:max-h-[min(90dvh,calc(100dvh-4rem))]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-700 bg-gray-800 md:bg-gray-900 flex-shrink-0 md:rounded-t-2xl">
            <button
              ref={firstFocusableRef}
              onClick={onClose}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-lg p-1"
              aria-label="Close swap claim approval"
            >
              <ArrowLeft size={20} />
              <span className="md:hidden">Back</span>
            </button>
            <h2 id="swap-claim-approval-title" className="text-lg md:text-xl font-bold text-white truncate mx-4">
              Swap Request Review
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors hidden md:block focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-lg p-1"
              aria-label="Close swap claim approval"
            >
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pb-safe-area-inset-bottom md:pb-0">
            <div className="p-4 md:p-6 space-y-6 md:space-y-8">
              {/* Swap Status Display */}
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <Heart size={20} className="text-purple-500" />
                  <h3 className="text-lg font-semibold text-white">Swap Status</h3>
                </div>
                
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
                  swapPost.status === 'open' ? 'bg-green-900/20 text-green-400 border-green-500/30' :
                  swapPost.status === 'pending' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30' :
                  swapPost.status === 'assigned' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' :
                  'bg-gray-900/20 text-gray-400 border-gray-500/30'
                }`}>
                  <span className="capitalize">{swapPost.status}</span>
                </div>
                
                <p className="text-gray-300 text-sm mt-3">
                  {swapPost.status === 'open' && 'This swap is open and available for claims.'}
                  {swapPost.status === 'pending' && 'A user has claimed this swap and is waiting for your approval.'}
                  {swapPost.status === 'assigned' && 'This swap has been assigned. You can mark it as completed or indicate it did not occur.'}
                  {swapPost.status === 'closed' && 'This swap has been completed and is now closed.'}
                </p>
              </div>

              {/* Claim Summary */}
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4 md:mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {claimantProfile?.profilePicture ? (
                        <img
                          src={claimantProfile.profilePicture}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-lg md:text-xl">
                          {getInitials(claimantDisplayName)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-medium text-base md:text-lg">
                        {claimantDisplayName}
                      </h3>
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <Clock size={12} />
                        <span>Claimed {formatDate(notification.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/20 text-purple-400 border border-purple-500/30 rounded-lg">
                      <Heart size={16} />
                      <span className="font-semibold">Swap Request</span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={16} className="text-purple-400" />
                    <span className="text-purple-400 font-medium">Swap Claim Details</span>
                  </div>
                  <div className="text-gray-300 text-sm space-y-1">
                    <p>
                      <strong>Claimant:</strong> {claimantDisplayName}
                    </p>
                    <p>
                      <strong>Swap Post:</strong> {swapPost.title}
                    </p>
                    <p>
                      <strong>Requested:</strong> {formatDate(notification.createdAt)}
                    </p>
                    <p>
                      <strong>Current Status:</strong> <span className="capitalize">{swapPost.status}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Swap Post Details */}
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <h4 className="text-lg md:text-xl font-semibold text-white mb-4">Swap Post Details</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="text-white font-medium text-base md:text-lg mb-2">{swapPost.title}</h5>
                    <p className="text-gray-300 text-sm md:text-base leading-relaxed break-words">{swapPost.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span>{swapPost.location.suburb}, {swapPost.location.state}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Calendar size={14} className="flex-shrink-0" />
                      <span>Posted: {formatDate(swapPost.createdAt)}</span>
                    </div>
                  </div>

                  {swapPost.category && (
                    <div className="pt-3 border-t border-gray-600">
                      <span className="text-gray-400 text-sm mb-2 block">Category:</span>
                      <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                        {swapPost.category}
                      </span>
                    </div>
                  )}

                  {swapPost.tags && swapPost.tags.length > 0 && (
                    <div className="pt-3 border-t border-gray-600">
                      <span className="text-gray-400 text-sm mb-2 block">Tags:</span>
                      <div className="flex flex-wrap gap-2">
                        {swapPost.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Claimant Profile Information */}
              {claimantProfile && (
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                  <h4 className="text-lg md:text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <User size={20} className="text-purple-500" />
                    Claimant Profile
                  </h4>
                  
                  {/* Basic Profile Info */}
                  <div className="space-y-4 mb-6">
                    {claimantProfile.bio && (
                      <div>
                        <span className="text-gray-400 text-sm">Bio:</span>
                        <p className="text-gray-300 text-sm mt-1 leading-relaxed">{claimantProfile.bio}</p>
                      </div>
                    )}

                    {claimantProfile.skills.length > 0 && (
                      <div>
                        <span className="text-gray-400 text-sm mb-2 block">Skills:</span>
                        <div className="flex flex-wrap gap-2">
                          {claimantProfile.skills.map((skill, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gray-700 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-white">
                          {Number(claimantProfile.completedJobs)}
                        </div>
                        <div className="text-xs text-gray-400">Completed Jobs</div>
                      </div>
                      
                      <div className="bg-gray-700 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-white">
                          {claimantProfile.averageRating > 0 ? claimantProfile.averageRating.toFixed(1) : 'No rating'}
                        </div>
                        <div className="text-xs text-gray-400">Average Rating</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Prominent Approve Button Section for Pending Swaps */}
              {swapPost.status === 'pending' && (
                <div className="bg-gradient-to-r from-green-900/30 to-green-800/30 border border-green-500/50 rounded-lg p-6 md:p-8">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-green-400" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                      Ready to Approve?
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg">
                      {claimantDisplayName} wants to claim your swap "{swapPost.title}"
                    </p>
                  </div>

                  <div className="bg-green-900/30 border border-green-500/40 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 text-green-400 mb-3">
                      <UserCheck size={18} />
                      <span className="font-semibold text-lg">Approval Benefits</span>
                    </div>
                    <div className="space-y-2 text-gray-300 text-sm">
                      <p>• Immediately assigns the swap to {claimantDisplayName}</p>
                      <p>• Both parties receive instant status update notifications</p>
                      <p>• Swap status changes to "assigned" for coordination</p>
                      <p>• You can mark as completed when exchange is finished</p>
                      <p>• Provides clear workflow for successful exchanges</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={handleApproveSwapClaim}
                      disabled={approveSwapClaim.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-8 py-4 md:py-5 rounded-lg transition-colors disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none focus:outline-none focus:ring-4 focus:ring-green-500/50"
                    >
                      {approveSwapClaim.isPending ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      ) : (
                        <UserCheck size={24} />
                      )}
                      <span>{approveSwapClaim.isPending ? 'Approving & Assigning...' : 'Approve & Assign Swap'}</span>
                    </button>
                    
                    <button
                      onClick={handleRejectSwapClaim}
                      disabled={rejectSwapClaim.isPending}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-8 py-4 md:py-5 rounded-lg transition-colors disabled:cursor-not-allowed font-semibold text-base flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-red-500/50"
                    >
                      {rejectSwapClaim.isPending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <X size={20} />
                      )}
                      <span>{rejectSwapClaim.isPending ? 'Rejecting Request...' : 'Reject Request'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Enhanced Action Guidelines with Clear Button Labels */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 md:p-6">
                <h4 className="text-blue-400 font-semibold mb-3">Swap Management Options</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  {swapPost.status === 'pending' && (
                    <>
                      <p>• <strong>Approve & Assign:</strong> Accept the claim and assign the swap to {claimantDisplayName}</p>
                      <p>• <strong>Reject Request:</strong> Decline the claim and reopen the swap for others to claim</p>
                    </>
                  )}
                  {swapPost.status === 'assigned' && (
                    <>
                      <p>• <strong>Mark as Completed:</strong> Confirm the swap exchange occurred successfully</p>
                      <p>• <strong>Did Not Occur:</strong> Indicate the swap didn't happen and reopen for others</p>
                    </>
                  )}
                  <p>• Use messaging to coordinate details with the claimant</p>
                  <p>• All status changes are immediately reflected throughout the app</p>
                  <p>• The claimant will receive immediate notifications about status changes</p>
                </div>
              </div>

              {/* Status-specific Information */}
              {swapPost.status === 'pending' && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 md:p-6">
                  <h4 className="text-yellow-400 font-semibold mb-3">Pending Claim Review</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>• This swap is currently pending your approval</p>
                    <p>• No other users can claim while in pending status</p>
                    <p>• Accepting will assign the swap to {claimantDisplayName}</p>
                    <p>• Rejecting will reopen the swap for others to claim</p>
                    <p>• The claimant will be notified of your decision immediately</p>
                  </div>
                </div>
              )}

              {swapPost.status === 'assigned' && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 md:p-6">
                  <h4 className="text-blue-400 font-semibold mb-3">Assigned Swap</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>• This swap is assigned to {claimantDisplayName}</p>
                    <p>• Mark as completed when the exchange is successfully finished</p>
                    <p>• Use "Did Not Occur" if the swap didn't happen for any reason</p>
                    <p>• Marking as "Did Not Occur" will reopen the swap for others to claim</p>
                    <p>• Coordinate exchange details through the messaging system</p>
                    <p>• <strong>The claimant will receive an immediate notification when you mark it as completed</strong></p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions with Clear Button Labels as Requested */}
          <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 pb-safe-area-inset-bottom md:pb-4 md:bg-gray-900 md:rounded-b-2xl flex-shrink-0">
            {swapPost.status === 'assigned' && (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={handleMarkCompleted}
                  disabled={markSwapCompleted.isPending}
                  className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 md:py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  {markSwapCompleted.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  <span>{markSwapCompleted.isPending ? 'Marking Complete...' : 'Mark as Completed'}</span>
                </button>
                <button
                  ref={lastFocusableRef}
                  onClick={handleMarkDidNotOccur}
                  disabled={markSwapDidNotOccur.isPending}
                  className="w-full sm:flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-6 py-3 md:py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  {markSwapDidNotOccur.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>{markSwapDidNotOccur.isPending ? 'Updating...' : 'Did Not Occur'}</span>
                </button>
              </div>
            )}

            {(swapPost.status === 'open' || swapPost.status === 'closed') && (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">
                  {swapPost.status === 'open' ? 'This swap is open for new claims.' : 'This swap has been completed.'}
                </p>
                <button
                  onClick={onClose}
                  className="mt-3 bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Set last focusable element for cases without action buttons */}
          {!availableActions.canApprove && !availableActions.canReject && !availableActions.canComplete && !availableActions.canMarkDidNotOccur && (
            <div className="hidden">
              <button ref={lastFocusableRef} />
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Toast Notification for immediate feedback */}
      {toast && (
        <ActionToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
