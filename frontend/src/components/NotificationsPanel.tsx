import React, { useState, useMemo, Suspense, lazy } from 'react';
import { ArrowLeft, Bell, Clock, DollarSign, User, Calendar, CheckCircle, AlertCircle, X, Award, MessageSquare, Trash2, Trash, Heart, RefreshCw, UserCheck } from 'lucide-react';
import { useGetNotifications, useMarkNotificationAsRead, useGetTasks, useGetOffers, useApproveOffer, useRejectOffer, useGetMessagesForTask, useGetTaskComments, useGetTaskReactions, useGetUserProfiles, useClearNotification, useClearAllNotifications, useGetNeighbourhoodPosts, useApproveSwapClaim, useRejectSwapClaim } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import type { Offer, Task, Notification } from '../backend';
import { NotificationType } from '../backend';
import { Principal } from '@dfinity/principal';
import NFTMintedToast from './NFTMintedToast';

// Lazy load the swap claim approval modal
const SwapClaimApprovalModal = lazy(() => import('./SwapClaimApprovalModal'));

interface NotificationsPanelProps {
  onClose: () => void;
  onNavigateToTask?: (taskId: string, commentId?: string) => void;
  onNavigateToChat?: (taskId: string) => void;
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

export default function NotificationsPanel({ onClose, onNavigateToTask, onNavigateToChat }: NotificationsPanelProps) {
  const { identity } = useInternetIdentity();
  const { data: notifications = [], isLoading } = useGetNotifications();
  const { data: tasks = [] } = useGetTasks();
  const { data: offers = [] } = useGetOffers();
  const { data: neighbourhoodPosts = [] } = useGetNeighbourhoodPosts();
  
  const markAsRead = useMarkNotificationAsRead();
  const clearNotification = useClearNotification();
  const clearAllNotifications = useClearAllNotifications();
  const approveOffer = useApproveOffer();
  const rejectOffer = useRejectOffer();
  const approveSwapClaim = useApproveSwapClaim();
  const rejectSwapClaim = useRejectSwapClaim();
  const [selectedOffer, setSelectedOffer] = useState<{ offer: Offer; task: Task } | null>(null);
  const [selectedSwapClaimNotification, setSelectedSwapClaimNotification] = useState<Notification | null>(null);
  const [showNFTToast, setShowNFTToast] = useState<{
    taskTitle: string;
    tokenId: string;
    amount: number;
    currency: string;
  } | null>(null);

  // Toast state for immediate feedback
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Extract user principal from notification - DEFINED BEFORE USE
  const extractUserPrincipalFromNotification = (notification: Notification): string | null => {
    // For offer notifications - get principal from the actual offer object
    if (notification.notificationType === NotificationType.offer && notification.offerId) {
      const offer = offers.find(o => o.id === notification.offerId);
      if (offer) {
        return offer.tasker.toString();
      }
    }
    
    // For comment notifications - extract principal from notification ID structure
    if (notification.notificationType === NotificationType.comment && notification.taskId) {
      const parts = notification.id.split('_');
      if (parts.length >= 3 && parts[1] === 'commenter') {
        // Format: commentId_commenter_principal - return the complete principal
        const commenterPrincipal = parts[2];
        if (commenterPrincipal && commenterPrincipal.length > 0) {
          return commenterPrincipal;
        }
      } else if (parts.length >= 1) {
        // Format: commentId_owner - extract principal from comment ID
        // The comment ID format is: principalId + taskId + timestamp
        // We need to extract the principal part which is the first 63 characters
        const commentId = parts[0];
        if (commentId.length >= 63) {
          const principal = commentId.substring(0, 63);
          return principal;
        }
      }
    }
    
    // For reaction notifications - extract principal from notification ID
    if (notification.notificationType === NotificationType.reaction && notification.taskId) {
      const parts = notification.id.split('_reaction');
      if (parts.length >= 1) {
        const principalTaskId = parts[0];
        // The format is: principalId + taskId + "_reaction"
        // We need to extract just the principal part (first 63 characters)
        if (principalTaskId.length >= 63) {
          const principal = principalTaskId.substring(0, 63);
          return principal;
        }
      }
    }
    
    // For message notifications - use the principal field directly from the notification
    if (notification.notificationType === NotificationType.message) {
      // The backend stores the sender's principal in the principal field
      if (notification.principal && notification.principal.length > 0) {
        return notification.principal;
      }
    }
    
    // For swap claim and swap status change notifications, the principal field contains the display name directly
    if (notification.notificationType === NotificationType.swapClaim || 
        notification.notificationType === NotificationType.swapStatusChange) {
      // The backend stores the claiming user's display name in the principal field
      if (notification.principal && notification.principal.length > 0) {
        return notification.principal;
      }
    }
    
    return null;
  };

  // Get all task IDs that have comment or reaction notifications
  const taskIdsForComments = useMemo(() => {
    return notifications
      .filter(n => n.notificationType === NotificationType.comment && n.taskId)
      .map(n => n.taskId!)
      .filter((id, index, arr) => arr.indexOf(id) === index);
  }, [notifications]);

  const taskIdsForReactions = useMemo(() => {
    return notifications
      .filter(n => n.notificationType === NotificationType.reaction && n.taskId)
      .map(n => n.taskId!)
      .filter((id, index, arr) => arr.indexOf(id) === index);
  }, [notifications]);

  // Fetch comments for tasks that have comment notifications
  const { data: allComments = new Map() } = useGetTaskComments(taskIdsForComments[0] || '');
  const { data: allReactions = new Map() } = useGetTaskReactions(taskIdsForReactions[0] || '');

  // Get ALL unique user principals from ALL notification types for comprehensive profile lookup
  const allNotificationUserPrincipals = useMemo(() => {
    const uniquePrincipals = new Set<string>();
    
    notifications.forEach(notification => {
      const userPrincipal = extractUserPrincipalFromNotification(notification);
      if (userPrincipal && userPrincipal.length > 0) {
        // For swap claim and swap status change notifications, the principal field contains the display name, not the principal ID
        // We need to skip adding this to the principals list for profile lookup
        if (notification.notificationType === NotificationType.swapClaim || 
            notification.notificationType === NotificationType.swapStatusChange) {
          return; // Skip adding display name to principals list
        }
        uniquePrincipals.add(userPrincipal);
      }
    });
    
    return Array.from(uniquePrincipals).map(p => {
      try {
        return Principal.fromText(p);
      } catch (error) {
        console.warn('Invalid principal format:', p, error);
        return null;
      }
    }).filter((p): p is Principal => p !== null);
  }, [notifications, extractUserPrincipalFromNotification]);

  // Fetch user profiles for ALL notification senders - this ensures we get profiles for all message notifications
  const { data: allNotificationUserProfiles = new Map() } = useGetUserProfiles(allNotificationUserPrincipals);

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.notificationType === NotificationType.taskUpdate && !notification.isRead) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    if (!notification.isRead && notification.notificationType !== NotificationType.taskUpdate) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Handle swap claim notifications - open approval interface
    if (notification.notificationType === NotificationType.swapClaim) {
      setSelectedSwapClaimNotification(notification);
      return;
    }

    // Handle swap status change notifications - just mark as read and close
    if (notification.notificationType === NotificationType.swapStatusChange) {
      // These are informational notifications for requesters about their swap status changes
      // No specific action needed beyond marking as read
      return;
    }

    // Handle offer notifications - check if it's a new offer for the task owner
    if (notification.notificationType === NotificationType.offer && notification.offerId) {
      const offer = offers.find(o => o.id === notification.offerId);
      const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
      
      if (offer && task) {
        // Check if this is a new offer notification (for the task owner)
        const isNewOfferForOwner = identity && task.requester.toString() === identity.getPrincipal().toString() && 
                                  offer.status === 'pending';
        
        if (isNewOfferForOwner) {
          // Show offer details modal for new offers (to task owners)
          setSelectedOffer({ offer, task });
          return;
        } else {
          // For all other offer-related notifications (outcomes, etc.), navigate to task details
          if (onNavigateToTask) {
            onNavigateToTask(task.id);
            onClose();
            return;
          }
        }
      }
    }

    // Handle comment and reaction notifications - navigate to task details
    if ((notification.notificationType === NotificationType.comment || notification.notificationType === NotificationType.reaction) && notification.taskId) {
      if (onNavigateToTask) {
        let commentId: string | undefined;
        if (notification.notificationType === NotificationType.comment) {
          const parts = notification.id.split('_');
          if (parts.length >= 2) {
            commentId = parts[0];
          }
        }
        onNavigateToTask(notification.taskId, commentId);
        onClose();
        return;
      }
    }

    // Handle message notifications - navigate to chat
    if (notification.notificationType === NotificationType.message && notification.taskId) {
      if (onNavigateToChat) {
        onNavigateToChat(notification.taskId);
        onClose();
        return;
      }
    }

    // Handle task update notifications - navigate to task details
    if (notification.notificationType === NotificationType.taskUpdate && notification.taskId) {
      const task = tasks.find(t => t.id === notification.taskId);
      if (task) {
        if (task.status === 'completed' && identity && 
            task.assignedTasker?.toString() === identity.getPrincipal().toString()) {
          // Show NFT toast for completed tasks
          const mockNFTData = {
            taskTitle: task.title,
            tokenId: `${task.id.slice(-8)}`,
            amount: Number(task.budget),
            currency: 'AUD'
          };
          setShowNFTToast(mockNFTData);
        }
        
        // Navigate to task details for all task updates
        if (onNavigateToTask) {
          onNavigateToTask(task.id);
          onClose();
          return;
        }
      }
    }
  };

  const handleClearNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await clearNotification.mutateAsync(notificationId);
    } catch (error) {
      console.error('Failed to clear notification:', error);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await clearAllNotifications.mutateAsync(undefined);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const handleApproveOffer = async (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await approveOffer.mutateAsync(offerId);
      setSelectedOffer(null);
      setToast({
        message: 'Offer approved successfully! The tasker has been notified.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to approve offer:', error);
      setToast({
        message: 'Failed to approve offer. Please try again.',
        type: 'error'
      });
    }
  };

  const handleRejectOffer = async (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await rejectOffer.mutateAsync(offerId);
      setSelectedOffer(null);
      setToast({
        message: 'Offer rejected. The tasker has been notified.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to reject offer:', error);
      setToast({
        message: 'Failed to reject offer. Please try again.',
        type: 'error'
      });
    }
  };

  // Enhanced swap claim approval handlers for direct notification actions with immediate feedback
  const handleApproveSwapClaimDirect = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Extract post ID and claimant from notification
    const postId = notification.id.split('_swap_claim_')[0];
    const claimantPrincipalText = notification.id.split('_swap_claim_')[1];
    
    let claimantPrincipal: Principal | null = null;
    try {
      if (claimantPrincipalText) {
        claimantPrincipal = Principal.fromText(claimantPrincipalText);
      }
    } catch (error) {
      console.error('Invalid claimant principal:', claimantPrincipalText);
      setToast({
        message: 'Error: Invalid claimant information. Please try again.',
        type: 'error'
      });
      return;
    }

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
        message: 'Swap request approved successfully! The claimant has been notified and the swap is now assigned.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to approve swap claim:', error);
      setToast({
        message: 'Failed to approve swap request. Please try again.',
        type: 'error'
      });
    }
  };

  const handleRejectSwapClaimDirect = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Extract post ID and claimant from notification
    const postId = notification.id.split('_swap_claim_')[0];
    const claimantPrincipalText = notification.id.split('_swap_claim_')[1];
    
    let claimantPrincipal: Principal | null = null;
    try {
      if (claimantPrincipalText) {
        claimantPrincipal = Principal.fromText(claimantPrincipalText);
      }
    } catch (error) {
      console.error('Invalid claimant principal:', claimantPrincipalText);
      setToast({
        message: 'Error: Invalid claimant information. Please try again.',
        type: 'error'
      });
      return;
    }

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
        message: 'Swap request rejected. The claimant has been notified and the swap is now open for new claims.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to reject swap claim:', error);
      setToast({
        message: 'Failed to reject swap request. Please try again.',
        type: 'error'
      });
    }
  };

  // Get display name for comment, reaction, message, offer approval, swap claim, and swap status change notifications, fallback to principal ID
  const getNotificationDisplayName = (notification: Notification): string => {
    if (notification.notificationType !== NotificationType.comment && 
        notification.notificationType !== NotificationType.reaction && 
        notification.notificationType !== NotificationType.message && 
        notification.notificationType !== NotificationType.offer &&
        notification.notificationType !== NotificationType.swapClaim &&
        notification.notificationType !== NotificationType.swapStatusChange) {
      return 'Unknown';
    }

    // For swap claim and swap status change notifications, the principal field contains the display name directly
    if (notification.notificationType === NotificationType.swapClaim || 
        notification.notificationType === NotificationType.swapStatusChange) {
      return notification.principal || 'Unknown User';
    }

    const userPrincipal = extractUserPrincipalFromNotification(notification);
    if (!userPrincipal) {
      return 'Unknown';
    }

    // Try to get display name from user profile using the comprehensive profile lookup
    const userProfile = allNotificationUserProfiles.get(userPrincipal);
    if (userProfile && userProfile.displayName && userProfile.displayName.trim() !== '') {
      return userProfile.displayName;
    }

    // Fallback to name if displayName is empty
    if (userProfile && userProfile.name && userProfile.name.trim() !== '') {
      return userProfile.name;
    }

    // Final fallback to principal ID - never return "Unknown"
    return userPrincipal;
  };

  // Get swap post details for swap claim and swap status change notifications
  const getSwapPostDetails = (notification: Notification) => {
    if (notification.notificationType !== NotificationType.swapClaim && 
        notification.notificationType !== NotificationType.swapStatusChange) {
      return null;
    }

    // Extract post ID from notification ID format: postId_swap_claim_principal or postId_swap_status_[status]_principal
    let postId = '';
    
    if (notification.notificationType === NotificationType.swapClaim) {
      const parts = notification.id.split('_swap_claim_');
      if (parts.length >= 1) {
        postId = parts[0];
      }
    } else if (notification.notificationType === NotificationType.swapStatusChange) {
      // Format: postId_swap_status_[status]_principal
      const parts = notification.id.split('_swap_status_');
      if (parts.length >= 1) {
        postId = parts[0];
      }
    }

    if (postId) {
      const post = neighbourhoodPosts.find(p => p.id === postId);
      return post || null;
    }

    return null;
  };

  // Extract swap status from swap status change notification ID
  const getSwapStatusFromNotification = (notification: Notification): string | null => {
    if (notification.notificationType !== NotificationType.swapStatusChange) {
      return null;
    }

    // Format: postId_swap_status_[status]_principal
    const parts = notification.id.split('_swap_status_');
    if (parts.length >= 2) {
      const statusPart = parts[1];
      const statusParts = statusPart.split('_');
      if (statusParts.length >= 1) {
        return statusParts[0]; // This should be 'assigned', 'completed', 'open', etc.
      }
    }

    return null;
  };

  // Check if this is a swap claim notification that can be acted upon
  const canActOnSwapClaim = (notification: Notification): boolean => {
    if (notification.notificationType !== NotificationType.swapClaim) {
      return false;
    }

    // Extract post ID and find the swap post
    const postId = notification.id.split('_swap_claim_')[0];
    const swapPost = neighbourhoodPosts.find(p => p.id === postId && p.postType === 'swap');
    
    // Can only act if the post exists, is still pending, and user is the post owner
    return !!(swapPost && swapPost.status === 'pending' && identity && 
              swapPost.author.toString() === identity.getPrincipal().toString());
  };

  // Notification title generation with display names for comment, reaction, message, offer approval, swap claim, and swap status change notifications
  const getNotificationTitle = (notification: Notification): string => {
    const offer = notification.offerId ? offers.find(o => o.id === notification.offerId) : undefined;
    
    if (offer && identity && offer.tasker.toString() === identity.getPrincipal().toString()) {
      if (offer.status === 'approved') {
        return 'Offer Approved!';
      } else if (offer.status === 'rejected') {
        return 'Offer Rejected';
      }
    }
    
    // For comment notifications, use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.comment) {
      const displayName = getNotificationDisplayName(notification);
      return `${displayName} commented on your task`;
    }
    
    // For reaction notifications, use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.reaction) {
      const displayName = getNotificationDisplayName(notification);
      return `${displayName} reacted to your task`;
    }
    
    // For message notifications, use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.message) {
      const displayName = getNotificationDisplayName(notification);
      return `${displayName} has sent you a message`;
    }
    
    // For offer notifications (new offers), use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.offer) {
      const displayName = getNotificationDisplayName(notification);
      return `New Offer from ${displayName}`;
    }

    // For swap claim notifications, use display name from principal field
    if (notification.notificationType === NotificationType.swapClaim) {
      const displayName = getNotificationDisplayName(notification);
      return `Swap Request from ${displayName}`;
    }

    // For swap status change notifications, show the status change with clear completion messaging
    if (notification.notificationType === NotificationType.swapStatusChange) {
      const status = getSwapStatusFromNotification(notification);
      const swapPost = getSwapPostDetails(notification);
      
      switch (status) {
        case 'assigned':
          return 'Swap Request Approved!';
        case 'completed':
          return 'Swap Marked as Completed!';
        case 'open':
          return 'Swap Status Updated';
        default:
          return 'Swap Status Changed';
      }
    }
    
    // For other notification types, show the actual principal ID
    const userPrincipal = extractUserPrincipalFromNotification(notification);
    const finalDisplayPrincipal = userPrincipal || 'Unknown sender';
    
    switch (notification.notificationType) {
      case NotificationType.taskUpdate:
        const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
        if (task && task.status === 'completed' && identity && 
            task.assignedTasker?.toString() === identity.getPrincipal().toString()) {
          return 'NFT Certificate Minted! 🎉';
        }
        return 'Task Update';
      default:
        return 'Notification';
    }
  };

  // Notification message generation with display names for comment, reaction, message, offer approval, swap claim, and swap status change notifications
  const getNotificationMessage = (notification: Notification): string => {
    const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
    const offer = notification.offerId ? offers.find(o => o.id === notification.offerId) : undefined;
    
    // For comment notifications, use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.comment) {
      const displayName = getNotificationDisplayName(notification);
      if (task) {
        return `${displayName} commented on your task "${task.title}". Click to view the comment.`;
      }
      return `${displayName} commented on your task`;
    }
    
    // For reaction notifications, use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.reaction) {
      const displayName = getNotificationDisplayName(notification);
      if (task) {
        return `${displayName} reacted to your task "${task.title}". Click to see their reaction.`;
      }
      return `${displayName} reacted to your task`;
    }
    
    // For message notifications, use display name with fallback to principal ID
    if (notification.notificationType === NotificationType.message) {
      const displayName = getNotificationDisplayName(notification);
      if (task) {
        return `${displayName} has sent you a message about "${task.title}". Click to view the conversation.`;
      }
      return `${displayName} has sent you a new message`;
    }

    // For swap claim notifications, use display name and swap post details
    if (notification.notificationType === NotificationType.swapClaim) {
      const displayName = getNotificationDisplayName(notification);
      const swapPost = getSwapPostDetails(notification);
      if (swapPost) {
        return `${displayName} wants to claim your swap "${swapPost.title}". Use the Approve button below to accept and assign to this user, or Reject to decline.`;
      }
      return `${displayName} has requested to claim your swap post. Use the Approve button below to accept and assign to this user, or Reject to decline.`;
    }

    // Enhanced swap status change notifications with clear completion messaging
    if (notification.notificationType === NotificationType.swapStatusChange) {
      const status = getSwapStatusFromNotification(notification);
      const swapPost = getSwapPostDetails(notification);
      const postTitle = swapPost ? swapPost.title : 'your swap request';
      
      switch (status) {
        case 'assigned':
          return `Your swap request for "${postTitle}" has been approved! You are now assigned to this swap and can proceed with the exchange.`;
        case 'completed':
          return `The swap "${postTitle}" has been marked as completed by the owner. The exchange has been successfully finished and the swap is now closed.`;
        case 'open':
          return `Your swap request for "${postTitle}" status has changed. The swap is now open again for new claims.`;
        default:
          return `The status of your swap request for "${postTitle}" has been updated.`;
      }
    }
    
    // For offer notifications, handle both new offers and outcomes
    if (notification.notificationType === NotificationType.offer && offer && task) {
      const price = `$${(Number(offer.price) / 100).toLocaleString()}`;
      
      if (identity && offer.tasker.toString() === identity.getPrincipal().toString()) {
        // This is an offer outcome notification for the tasker
        if (offer.status === 'approved') {
          return `Your offer of ${price} for "${task.title}" was approved! You are now assigned to this task.`;
        } else if (offer.status === 'rejected') {
          return `Your offer of ${price} for "${task.title}" was rejected.`;
        }
      } else {
        // This is a new offer notification for the task owner - use display name
        const displayName = getNotificationDisplayName(notification);
        return `${displayName} made an offer of ${price} on "${task.title}"`;
      }
    }
    
    // For other notification types, show the actual principal ID
    const userPrincipal = extractUserPrincipalFromNotification(notification);
    const finalDisplayPrincipal = userPrincipal || 'Unknown sender';

    switch (notification.notificationType) {
      case NotificationType.taskUpdate:
        if (task) {
          if (task.status === 'completed' && identity && 
              task.assignedTasker?.toString() === identity.getPrincipal().toString()) {
            return `Your completion certificate NFT for "${task.title}" has been minted to your wallet!`;
          }
          return `Update on task "${task.title}"`;
        }
        return 'Your task has been updated';
      default:
        return 'You have a new notification';
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    const offer = notification.offerId ? offers.find(o => o.id === notification.offerId) : undefined;
    const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
    
    if (notification.notificationType === NotificationType.taskUpdate && task && task.status === 'completed' && 
        identity && task.assignedTasker?.toString() === identity.getPrincipal().toString()) {
      return <Award size={16} className="text-orange-500 flex-shrink-0" />;
    }
    
    if (notification.notificationType === NotificationType.offer && offer && identity && 
        offer.tasker.toString() === identity.getPrincipal().toString()) {
      if (offer.status === 'approved') {
        return <CheckCircle size={16} className="text-green-500 flex-shrink-0" />;
      } else if (offer.status === 'rejected') {
        return <X size={16} className="text-red-500 flex-shrink-0" />;
      }
    }
    
    if (notification.notificationType === NotificationType.offer) {
      return <DollarSign size={16} className="text-orange-500 flex-shrink-0" />;
    }
    
    if (notification.notificationType === NotificationType.comment) {
      return <MessageSquare size={16} className="text-blue-500 flex-shrink-0" />;
    }
    
    if (notification.notificationType === NotificationType.reaction) {
      return <span className="text-base flex-shrink-0">👍</span>;
    }
    
    if (notification.notificationType === NotificationType.message) {
      return <MessageSquare size={16} className="text-green-500 flex-shrink-0" />;
    }

    if (notification.notificationType === NotificationType.swapClaim) {
      return <Heart size={16} className="text-purple-500 flex-shrink-0" />;
    }

    if (notification.notificationType === NotificationType.swapStatusChange) {
      const status = getSwapStatusFromNotification(notification);
      switch (status) {
        case 'assigned':
          return <CheckCircle size={16} className="text-green-500 flex-shrink-0" />;
        case 'completed':
          return <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />;
        case 'open':
          return <RefreshCw size={16} className="text-yellow-500 flex-shrink-0" />;
        default:
          return <Heart size={16} className="text-purple-500 flex-shrink-0" />;
      }
    }
    
    return <Bell size={16} className="text-gray-400 flex-shrink-0" />;
  };

  const isOfferOutcome = (notification: Notification) => {
    const offer = notification.offerId ? offers.find(o => o.id === notification.offerId) : undefined;
    return offer && identity && offer.tasker.toString() === identity.getPrincipal().toString() && 
           (offer.status === 'approved' || offer.status === 'rejected');
  };

  const isNFTMinting = (notification: Notification) => {
    const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
    return notification.notificationType === NotificationType.taskUpdate && task && task.status === 'completed' && 
           identity && task.assignedTasker?.toString() === identity.getPrincipal().toString();
  };

  const isCommentNotification = (notification: Notification) => {
    return notification.notificationType === NotificationType.comment;
  };

  const isReactionNotification = (notification: Notification) => {
    return notification.notificationType === NotificationType.reaction;
  };

  const isMessageNotification = (notification: Notification) => {
    return notification.notificationType === NotificationType.message;
  };

  const isSwapClaimNotification = (notification: Notification) => {
    return notification.notificationType === NotificationType.swapClaim;
  };

  const isSwapStatusChangeNotification = (notification: Notification) => {
    return notification.notificationType === NotificationType.swapStatusChange;
  };

  const canTakeAction = (notification: Notification) => {
    const offer = notification.offerId ? offers.find(o => o.id === notification.offerId) : undefined;
    const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
    
    return notification.notificationType === NotificationType.offer && 
           offer && 
           task && 
           identity && 
           task.requester.toString() === identity.getPrincipal().toString() &&
           offer.status === 'pending';
  };

  const handleViewNFT = () => {
    onClose();
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">Notifications</h2>
        </div>
        
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">Notifications</h2>
          {notifications.length > 0 && (
            <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-sm">
              {notifications.length}
            </span>
          )}
        </div>

        {/* Clear All Button */}
        {notifications.length > 0 && (
          <div className="mb-4">
            <button
              onClick={handleClearAllNotifications}
              disabled={clearAllNotifications.isPending}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-sm"
            >
              {clearAllNotifications.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Trash size={16} />
              )}
              <span>
                {clearAllNotifications.isPending ? 'Clearing All...' : 'Clear All Notifications'}
              </span>
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto mb-4 text-gray-500" />
            <p className="text-gray-400 text-lg mb-2">No notifications</p>
            <p className="text-gray-500 text-sm">
              You'll receive notifications when taskers make offers on your tasks, when your offers are processed, when someone comments on your tasks, when you receive messages, when users claim your swap posts, when swap status changes occur, and when NFTs are minted
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications
              .sort((a, b) => Number(b.createdAt - a.createdAt))
              .map((notification) => {
                const offer = notification.offerId ? offers.find(o => o.id === notification.offerId) : undefined;
                const task = notification.taskId ? tasks.find(t => t.id === notification.taskId) : undefined;
                const swapPost = getSwapPostDetails(notification);
                const isOutcome = isOfferOutcome(notification);
                const isNFT = isNFTMinting(notification);
                const isComment = isCommentNotification(notification);
                const isReaction = isReactionNotification(notification);
                const isMessage = isMessageNotification(notification);
                const isSwapClaim = isSwapClaimNotification(notification);
                const isSwapStatusChange = isSwapStatusChangeNotification(notification);
                const canAct = canTakeAction(notification);
                const canActOnSwap = canActOnSwapClaim(notification);
                const userPrincipal = extractUserPrincipalFromNotification(notification);
                
                // For comment, reaction, message, offer approval, swap claim, and swap status change notifications, use display name; for others, show the actual principal ID
                const finalDisplayPrincipal = (notification.notificationType === NotificationType.comment || 
                                             notification.notificationType === NotificationType.reaction || 
                                             notification.notificationType === NotificationType.message ||
                                             notification.notificationType === NotificationType.swapClaim ||
                                             notification.notificationType === NotificationType.swapStatusChange ||
                                             (notification.notificationType === NotificationType.offer && offer && identity && offer.tasker.toString() !== identity.getPrincipal().toString()))
                  ? getNotificationDisplayName(notification)
                  : (userPrincipal || 'Unknown sender');
                
                return (
                  <div
                    key={notification.id}
                    className={`bg-gray-800 rounded-lg border transition-colors relative cursor-pointer hover:bg-gray-750 ${
                      notification.isRead 
                        ? 'border-gray-700 hover:border-gray-600' 
                        : isNFT
                          ? 'border-orange-500/30 bg-orange-900/10 hover:border-orange-500/50'
                          : isOutcome && offer?.status === 'approved'
                            ? 'border-green-500/30 bg-green-900/10 hover:border-green-500/50'
                            : isOutcome && offer?.status === 'rejected'
                              ? 'border-red-500/30 bg-red-900/10 hover:border-red-500/50'
                              : isComment
                                ? 'border-blue-500/30 bg-blue-900/10 hover:border-blue-500/50'
                                : isReaction
                                  ? 'border-purple-500/30 bg-purple-900/10 hover:border-purple-500/50'
                                  : isMessage
                                    ? 'border-green-500/30 bg-green-900/10 hover:border-green-500/50'
                                    : isSwapClaim
                                      ? 'border-purple-500/30 bg-purple-900/10 hover:border-purple-500/50'
                                      : isSwapStatusChange
                                        ? 'border-blue-500/30 bg-blue-900/10 hover:border-blue-500/50'
                                        : 'border-orange-500/30 bg-gray-800/80 hover:border-orange-500/50'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notification);
                      }
                    }}
                    aria-label={`Notification: ${getNotificationTitle(notification)}. ${getNotificationMessage(notification)}`}
                  >
                    {/* Clear button - positioned absolutely to avoid interfering with main click area */}
                    <button
                      onClick={(e) => handleClearNotification(notification.id, e)}
                      disabled={clearNotification.isPending}
                      className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                      title="Clear notification"
                      aria-label="Clear this notification"
                    >
                      {clearNotification.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>

                    {/* Main notification content - full clickable area */}
                    <div className="p-4 pr-12">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getNotificationIcon(notification)}
                          <h3 className={`font-medium truncate ${notification.isRead ? 'text-gray-300' : 'text-white'}`}>
                            {getNotificationTitle(notification)}
                          </h3>
                          {!notification.isRead && (
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isNFT
                                ? 'bg-orange-500'
                                : isOutcome && offer?.status === 'approved' 
                                  ? 'bg-green-500' 
                                  : isOutcome && offer?.status === 'rejected'
                                    ? 'bg-red-500'
                                    : isComment
                                      ? 'bg-blue-500'
                                      : isReaction
                                        ? 'bg-purple-500'
                                        : isMessage
                                          ? 'bg-green-500'
                                          : isSwapClaim
                                            ? 'bg-purple-500'
                                            : isSwapStatusChange
                                              ? 'bg-blue-500'
                                              : 'bg-orange-500'
                            }`}></div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                          <Clock size={12} />
                          <span>{formatTimestamp(notification.createdAt)}</span>
                        </div>
                      </div>
                      
                      <p className={`text-sm mb-3 ${notification.isRead ? 'text-gray-400' : 'text-gray-300'}`}>
                        {getNotificationMessage(notification)}
                      </p>
                      
                      {offer && task && (
                        <div className={`rounded-lg p-3 space-y-2 ${
                          isNFT
                            ? 'bg-orange-900/20'
                            : isOutcome && offer.status === 'approved' 
                              ? 'bg-green-900/20' 
                              : isOutcome && offer.status === 'rejected'
                                ? 'bg-red-900/20'
                                : 'bg-gray-700'
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">
                              ${(Number(offer.price) / 100).toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1 text-gray-400 text-sm">
                              <User size={12} />
                              <span className="break-all">
                                {isOutcome 
                                  ? 'Your offer' 
                                  : finalDisplayPrincipal
                                }
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-300 text-sm line-clamp-2">
                            Task: {task.title}
                          </p>
                          {offer.message && !isOutcome && (
                            <p className="text-gray-400 text-xs line-clamp-1">
                              "{offer.message}"
                            </p>
                          )}
                          {isOutcome && offer.status === 'approved' && (
                            <div className="flex items-center gap-2 text-green-400 text-sm">
                              <CheckCircle size={14} />
                              <span>You are now assigned to this task</span>
                            </div>
                          )}
                          {isOutcome && offer.status === 'rejected' && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <X size={14} />
                              <span>This offer was not accepted</span>
                            </div>
                          )}
                        </div>
                      )}

                      {isSwapClaim && swapPost && !offer && (
                        <div className="bg-purple-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                            <Heart size={14} />
                            <span>Swap Claim Request</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            {finalDisplayPrincipal} wants to claim "{swapPost.title}"
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            Use the buttons below to approve and assign to this user, or reject to decline
                          </p>
                        </div>
                      )}

                      {isSwapStatusChange && swapPost && !offer && (
                        <div className="bg-blue-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                            <Heart size={14} />
                            <span>Swap Status Update</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            Status update for your swap request: "{swapPost.title}"
                          </p>
                          <div className="mt-2">
                            {(() => {
                              const status = getSwapStatusFromNotification(notification);
                              switch (status) {
                                case 'assigned':
                                  return (
                                    <div className="flex items-center gap-2 text-green-400 text-xs">
                                      <CheckCircle size={12} />
                                      <span className="font-medium">Your swap request has been approved!</span>
                                    </div>
                                  );
                                case 'completed':
                                  return (
                                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                                      <CheckCircle size={12} />
                                      <span className="font-medium">The swap has been marked as completed by the owner</span>
                                    </div>
                                  );
                                case 'open':
                                  return (
                                    <div className="flex items-center gap-2 text-yellow-400 text-xs">
                                      <RefreshCw size={12} />
                                      <span className="font-medium">The swap is now open for new claims</span>
                                    </div>
                                  );
                                default:
                                  return (
                                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                                      <AlertCircle size={12} />
                                      <span>Status has been updated</span>
                                    </div>
                                  );
                              }
                            })()}
                          </div>
                        </div>
                      )}

                      {isComment && task && !offer && (
                        <div className="bg-blue-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                            <MessageSquare size={14} />
                            <span>Comment Activity</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            Click to view the comment on "{task.title}"
                          </p>
                        </div>
                      )}

                      {isReaction && task && !offer && (
                        <div className="bg-purple-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                            <span className="text-base">👍</span>
                            <span>Reaction Activity</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            Click to see the reaction on "{task.title}"
                          </p>
                        </div>
                      )}

                      {isMessage && task && !offer && (
                        <div className="bg-green-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                            <MessageSquare size={14} />
                            <span>New Message</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            Click to view the conversation about "{task.title}"
                          </p>
                          {finalDisplayPrincipal !== 'Unknown sender' && finalDisplayPrincipal !== 'Message sender' && (
                            <p className="text-gray-400 text-xs mt-1">
                              From: {finalDisplayPrincipal}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Enhanced Action buttons for swap claims with prominent Approve button and immediate feedback */}
                      {canActOnSwap && swapPost && (
                        <div className="mt-4 pt-3 border-t border-gray-600">
                          {/* Prominent Approve Button with enhanced feedback */}
                          <div className="mb-3">
                            <button
                              onClick={(e) => handleApproveSwapClaimDirect(notification, e)}
                              disabled={approveSwapClaim.isPending}
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-bold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
                            >
                              {approveSwapClaim.isPending ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              ) : (
                                <UserCheck size={20} />
                              )}
                              <span>{approveSwapClaim.isPending ? 'Approving Swap...' : 'Approve & Assign Swap'}</span>
                            </button>
                          </div>
                          
                          {/* Secondary Reject Button with enhanced feedback */}
                          <button
                            onClick={(e) => handleRejectSwapClaimDirect(notification, e)}
                            disabled={rejectSwapClaim.isPending}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-sm"
                          >
                            {rejectSwapClaim.isPending ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <X size={16} />
                            )}
                            <span>{rejectSwapClaim.isPending ? 'Rejecting Request...' : 'Reject Request'}</span>
                          </button>

                          {/* Enhanced action guidance with clear workflow explanation */}
                          <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-purple-400 text-xs mb-1">
                              <UserCheck size={12} />
                              <span className="font-medium">Quick Action Guide</span>
                            </div>
                            <div className="text-gray-300 text-xs space-y-1">
                              <p>• <strong>Approve:</strong> Assigns the swap to {finalDisplayPrincipal} and changes status to "assigned"</p>
                              <p>• <strong>Reject:</strong> Declines the request and reopens the swap for others to claim</p>
                              <p>• Both actions provide immediate notifications to the requester</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons for pending offers - prevent event bubbling */}
                      {canAct && offer && task && (
                        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-600">
                          <button
                            onClick={(e) => handleApproveOffer(offer.id, e)}
                            disabled={approveOffer.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-sm"
                          >
                            {approveOffer.isPending ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            <span>{approveOffer.isPending ? 'Approving...' : 'Approve'}</span>
                          </button>
                          <button
                            onClick={(e) => handleRejectOffer(offer.id, e)}
                            disabled={rejectOffer.isPending}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-sm"
                          >
                            {rejectOffer.isPending ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <X size={14} />
                            )}
                            <span>{rejectOffer.isPending ? 'Rejecting...' : 'Reject'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Enhanced Toast Notification for immediate feedback */}
      {toast && (
        <ActionToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showNFTToast && (
        <NFTMintedToast
          taskTitle={showNFTToast.taskTitle}
          tokenId={showNFTToast.tokenId}
          amount={showNFTToast.amount}
          currency={showNFTToast.currency}
          onClose={() => setShowNFTToast(null)}
          onViewNFT={handleViewNFT}
        />
      )}

      {selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Offer Details</h2>
              <button
                onClick={() => setSelectedOffer(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {selectedOffer.offer.tasker.toString().charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-white font-medium break-all">
                        {getNotificationDisplayName({
                          id: '',
                          userId: selectedOffer.offer.tasker,
                          notificationType: NotificationType.offer,
                          createdAt: BigInt(0),
                          isRead: false,
                          principal: selectedOffer.offer.tasker.toString(),
                          offerId: selectedOffer.offer.id,
                          taskId: selectedOffer.task.id
                        })}
                      </h3>
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <Clock size={12} />
                        <span>Offered {formatTimestamp(selectedOffer.offer.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-500">
                      ${(Number(selectedOffer.offer.price) / 100).toLocaleString()}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Task budget: ${(Number(selectedOffer.task.budget) / 100).toLocaleString()}
                    </div>
                  </div>
                </div>

                {selectedOffer.offer.message && (
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} className="text-gray-400" />
                      <span className="text-gray-300 font-medium">Message from tasker:</span>
                    </div>
                    <p className="text-gray-200 leading-relaxed">
                      {selectedOffer.offer.message}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Task Details</h4>
                <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                  <h5 className="text-white font-medium">{selectedOffer.task.title}</h5>
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedOffer.task.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-600">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Clock size={14} />
                      <span>Due: {new Date(Number(selectedOffer.task.dueDate) / 1000000).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <DollarSign size={14} />
                      <span>Budget: ${(Number(selectedOffer.task.budget) / 100).toLocaleString()}</span>
                    </div>
                  </div>

                  {selectedOffer.task.requiredSkills.length > 0 && (
                    <div className="pt-3 border-t border-gray-600">
                      <span className="text-gray-400 text-sm mb-2 block">Required Skills:</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedOffer.task.requiredSkills.map((skill, index) => (
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
                </div>
              </div>

              {selectedOffer.offer.status === 'pending' && identity && 
               selectedOffer.task.requester.toString() === identity.getPrincipal().toString() && (
                <div className="flex gap-3">
                  <button
                    onClick={(e) => handleApproveOffer(selectedOffer.offer.id, e)}
                    disabled={approveOffer.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                  >
                    {approveOffer.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    <span>{approveOffer.isPending ? 'Approving...' : 'Approve Offer'}</span>
                  </button>
                  <button
                    onClick={(e) => handleRejectOffer(selectedOffer.offer.id, e)}
                    disabled={rejectOffer.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                  >
                    {rejectOffer.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <X size={16} />
                    )}
                    <span>{rejectOffer.isPending ? 'Rejecting...' : 'Reject Offer'}</span>
                  </button>
                </div>
              )}

              {selectedOffer.offer.status !== 'pending' && (
                <div className="text-center py-4">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    selectedOffer.offer.status === 'approved' 
                      ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                      : 'bg-red-900/20 text-red-400 border border-red-500/30'
                  }`}>
                    {selectedOffer.offer.status === 'approved' ? (
                      <CheckCircle size={16} />
                    ) : (
                      <X size={16} />
                    )}
                    <span>
                      Offer {selectedOffer.offer.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Swap Claim Approval Modal */}
      {selectedSwapClaimNotification && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        }>
          <SwapClaimApprovalModal
            notification={selectedSwapClaimNotification}
            onClose={() => setSelectedSwapClaimNotification(null)}
          />
        </Suspense>
      )}
    </>
  );
}
