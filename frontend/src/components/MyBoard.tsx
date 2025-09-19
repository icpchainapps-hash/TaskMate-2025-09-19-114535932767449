import React, { useState } from 'react';
import { Home, Archive, ArrowLeft, Briefcase, HandHeart, Heart, Gift, Clock, MapPin, CheckCircle, AlertCircle, Eye, Edit3, X, User } from 'lucide-react';
import { useGetMyCreatedTasks, useGetMyOfferedTasks, useGetMyClaimedItems, useGetArchivedTasks, useGetTasks, useGetOffers, useGetUserProfiles } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Task, TaskStatus, TaskType, Offer, OfferStatus } from '../backend';
import { Principal } from '@dfinity/principal';
import TaskCard from './TaskCard';

type MyBoardSection = 'created' | 'offered' | 'claimed' | 'archived';

export default function MyBoard() {
  const { identity } = useInternetIdentity();
  const [activeSection, setActiveSection] = useState<MyBoardSection>('created');
  
  const { data: myCreatedTasks = [], isLoading: createdLoading } = useGetMyCreatedTasks();
  const { data: myOfferedTasks = [], isLoading: offeredLoading } = useGetMyOfferedTasks();
  const { data: myClaimedItems = [], isLoading: claimedLoading } = useGetMyClaimedItems();
  const { data: archivedTasks = [], isLoading: archivedLoading } = useGetArchivedTasks();
  const { data: allTasks = [] } = useGetTasks();
  const { data: allOffers = [] } = useGetOffers();

  // Get unique principals for claimed item post authors
  const claimedItemAuthorPrincipals = React.useMemo(() => {
    const uniquePrincipals = new Set<string>();
    myClaimedItems.forEach(item => {
      uniquePrincipals.add(item.postAuthor.toString());
    });
    return Array.from(uniquePrincipals).map(p => Principal.fromText(p));
  }, [myClaimedItems]);

  // Fetch user profiles for claimed item post authors
  const { data: userProfiles = new Map() } = useGetUserProfiles(claimedItemAuthorPrincipals);

  if (!identity) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <Home size={48} className="mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-semibold text-white mb-2">Login Required</h3>
          <p className="text-gray-400">
            Please log in to view your MyBoard
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Enhanced function to format date and time together for claimed items
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

  const formatCurrency = (amount: bigint) => {
    return `$${(Number(amount) / 100).toLocaleString()}`;
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.open:
        return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
      case TaskStatus.assigned:
        return 'text-orange-400 bg-orange-900/20 border-orange-500/30';
      case TaskStatus.inProgress:
        return 'text-purple-400 bg-purple-900/20 border-purple-500/30';
      case TaskStatus.completed:
        return 'text-green-400 bg-green-900/20 border-green-500/30';
      case TaskStatus.disputed:
        return 'text-red-400 bg-red-900/20 border-red-500/30';
    }
  };

  const getTaskStatusText = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.open:
        return 'Open';
      case TaskStatus.assigned:
        return 'Assigned';
      case TaskStatus.inProgress:
        return 'In Progress';
      case TaskStatus.completed:
        return 'Completed';
      case TaskStatus.disputed:
        return 'Disputed';
    }
  };

  const getOfferStatusColor = (status: OfferStatus) => {
    switch (status) {
      case OfferStatus.approved:
        return 'text-green-400 bg-green-900/20 border-green-500/30';
      case OfferStatus.rejected:
        return 'text-red-400 bg-red-900/20 border-red-500/30';
      default:
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
    }
  };

  const getOfferStatusText = (status: OfferStatus) => {
    switch (status) {
      case OfferStatus.approved:
        return 'Approved';
      case OfferStatus.rejected:
        return 'Rejected';
      default:
        return 'Pending';
    }
  };

  const getClaimedItemStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-400 bg-green-900/20 border-green-500/30';
      case 'rejected':
        return 'text-red-400 bg-red-900/20 border-red-500/30';
      case 'completed':
        return 'text-green-400 bg-green-900/20 border-green-500/30';
      case 'cancelled':
        return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
      default:
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
    }
  };

  const getClaimedItemStatusText = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'Pending Approval';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const getClaimedItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'swap':
        return Heart;
      case 'freecycle':
        return Gift;
      case 'volunteer_slot':
        return HandHeart;
      default:
        return Briefcase;
    }
  };

  const getClaimedItemTypeText = (itemType: string) => {
    switch (itemType) {
      case 'swap':
        return 'Skill/Item Swap';
      case 'freecycle':
        return 'Freecycle Item';
      case 'volunteer_slot':
        return 'Volunteer Slot';
      default:
        return 'Item';
    }
  };

  // Get post author display name
  const getPostAuthorDisplayName = (authorPrincipal: Principal) => {
    const profile = userProfiles.get(authorPrincipal.toString());
    
    if (profile?.displayName && profile.displayName.trim() !== '') {
      return profile.displayName;
    }
    
    if (profile?.name && profile.name.trim() !== '') {
      return profile.name;
    }
    
    return `${authorPrincipal.toString().slice(0, 8)}...`;
  };

  const renderTasksICreated = () => {
    const tasks = activeSection === 'archived' ? archivedTasks : myCreatedTasks.filter(task => !task.isArchived);
    const isLoading = activeSection === 'archived' ? archivedLoading : createdLoading;

    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      );
    }

    if (tasks.length === 0) {
      return (
        <div className="text-center py-12">
          <Briefcase size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 text-lg mb-2">
            {activeSection === 'archived' ? 'No archived tasks' : 'No tasks created yet'}
          </p>
          <p className="text-gray-500 text-sm">
            {activeSection === 'archived' 
              ? 'Tasks you archive will appear here'
              : 'Create your first task to get started'
            }
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {tasks.map((task: Task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            showArchiveControls={true}
          />
        ))}
      </div>
    );
  };

  const renderTasksIOfferedOn = () => {
    const tasks = myOfferedTasks.filter(task => activeSection === 'archived' ? task.isArchived : !task.isArchived);

    if (offeredLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      );
    }

    if (tasks.length === 0) {
      return (
        <div className="text-center py-12">
          <HandHeart size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 text-lg mb-2">
            {activeSection === 'archived' ? 'No archived offered tasks' : 'No offers made yet'}
          </p>
          <p className="text-gray-500 text-sm">
            {activeSection === 'archived' 
              ? 'Archived tasks you\'ve offered on will appear here'
              : 'Make offers on tasks to see them here'
            }
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {tasks.map((task: Task) => {
          // Find the user's offer for this task
          const userOffer = allOffers.find(offer => 
            offer.taskId === task.id && 
            offer.tasker.toString() === identity?.getPrincipal().toString()
          );

          return (
            <div key={task.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{task.title}</h3>
                  <p className="text-gray-300 text-sm mb-2 line-clamp-2">{task.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>Due: {formatDate(task.dueDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      <span>{task.category}</span>
                    </div>
                  </div>

                  {/* Task Status */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`px-2 py-1 rounded-full text-xs border ${getTaskStatusColor(task.status)}`}>
                      {getTaskStatusText(task.status)}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs border ${
                      task.taskType === TaskType.paid
                        ? 'bg-orange-900/20 text-orange-400 border-orange-500/30'
                        : 'bg-green-900/20 text-green-400 border-green-500/30'
                    }`}>
                      {task.taskType === TaskType.paid ? 'Paid Task' : 'Volunteer Task'}
                    </div>
                  </div>

                  {/* Offer Status */}
                  {userOffer && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">Your offer:</span>
                      <div className={`px-2 py-1 rounded-full text-xs border ${getOfferStatusColor(userOffer.status)}`}>
                        {getOfferStatusText(userOffer.status)}
                      </div>
                      {task.taskType === TaskType.paid && (
                        <span className="text-orange-500 font-semibold text-sm">
                          {formatCurrency(userOffer.price)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {task.taskType === TaskType.paid ? (
                    <span className="text-orange-500 font-bold text-lg">
                      {formatCurrency(task.budget)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-sm">
                      <Heart size={12} />
                      <span>Volunteer</span>
                    </div>
                  )}
                </div>
              </div>

              {task.isArchived && (
                <div className="flex items-center gap-2 mt-3 text-orange-400">
                  <Archive size={16} />
                  <span className="text-sm font-medium">Archived</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMyClaimedItems = () => {
    if (claimedLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      );
    }

    if (myClaimedItems.length === 0) {
      return (
        <div className="text-center py-12">
          <Gift size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 text-lg mb-2">No claimed items yet</p>
          <p className="text-gray-500 text-sm">
            Items you claim from feed posts will appear here
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {myClaimedItems.map((item) => {
          const ItemIcon = getClaimedItemIcon(item.itemType);
          const postAuthorName = getPostAuthorDisplayName(item.postAuthor);
          
          return (
            <div key={item.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <ItemIcon size={20} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-1">{item.title}</h3>
                    <p className="text-gray-300 text-sm mb-2 line-clamp-2">{item.description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin size={10} />
                        <span>{item.location.suburb}, {item.location.state}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={10} />
                        <span>Claimed: {formatDate(item.claimedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">Type:</span>
                      <span className="text-orange-400 text-xs font-medium">
                        {getClaimedItemTypeText(item.itemType)}
                      </span>
                    </div>

                    {/* Enhanced Post Author Display */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">Post by:</span>
                      <div className="flex items-center gap-1">
                        <User size={10} className="text-blue-400" />
                        <span className="text-blue-400 text-xs font-medium">
                          {postAuthorName}
                        </span>
                      </div>
                    </div>

                    {/* Enhanced Selected Time Slot Display with combined date and time */}
                    {item.selectedTimeSlot && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2 mt-2">
                        <div className="flex items-center gap-1 text-blue-400 text-xs mb-1">
                          <Clock size={10} />
                          <span className="font-medium">Selected Time Slot</span>
                        </div>
                        <p className="text-gray-300 text-xs font-medium">
                          {formatDateAndTime(item.selectedTimeSlot.startTime, item.selectedTimeSlot)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className={`px-2 py-1 rounded-full text-xs border ${getClaimedItemStatusColor(item.status)}`}>
                    {getClaimedItemStatusText(item.status)}
                  </div>
                  
                  {item.completedAt && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <CheckCircle size={10} />
                      <span>Completed: {formatDate(item.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced status-specific information with assignment details */}
              {item.status === 'pending_approval' && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertCircle size={14} />
                    <span className="font-medium">Awaiting Approval</span>
                  </div>
                  <p className="text-gray-300 text-xs mt-1">
                    {postAuthorName} will review your request and respond soon.
                  </p>
                </div>
              )}

              {item.status === 'approved' && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={14} />
                    <span className="font-medium">
                      {item.itemType === 'swap' ? 'Swap Assigned to You' : 'Request Approved'}
                    </span>
                  </div>
                  <p className="text-gray-300 text-xs mt-1">
                    {item.itemType === 'swap' 
                      ? `Your swap request has been approved by ${postAuthorName}. You are now assigned to this swap and can proceed with the exchange.`
                      : item.itemType === 'freecycle'
                      ? `You have been approved to pick up this item from ${postAuthorName}.`
                      : `Your volunteer request has been approved by ${postAuthorName}. You can now proceed with the volunteer activity.`
                    }
                  </p>
                  {item.itemType === 'swap' && (
                    <div className="mt-2 p-2 bg-green-800/30 border border-green-400/30 rounded-lg">
                      <div className="flex items-center gap-2 text-green-300 text-xs">
                        <CheckCircle size={12} />
                        <span className="font-medium">Status: Assigned</span>
                      </div>
                      <p className="text-green-200 text-xs mt-1">
                        This swap is now assigned to you. Contact {postAuthorName} to coordinate the exchange details.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {item.status === 'rejected' && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <X size={14} />
                    <span className="font-medium">Request Declined</span>
                  </div>
                  <p className="text-gray-300 text-xs mt-1">
                    Your request was not accepted by {postAuthorName}.
                  </p>
                </div>
              )}

              {item.status === 'completed' && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={14} />
                    <span className="font-medium">Activity Completed</span>
                  </div>
                  <p className="text-gray-300 text-xs mt-1">
                    The {item.itemType === 'volunteer_slot' ? 'volunteer activity' : item.itemType === 'freecycle' ? 'pickup' : 'exchange'} has been completed successfully with {postAuthorName}.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'created':
      case 'archived':
        return renderTasksICreated();
      case 'offered':
        return renderTasksIOfferedOn();
      case 'claimed':
        return renderMyClaimedItems();
      default:
        return renderTasksICreated();
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'created':
        return 'Tasks I Created';
      case 'offered':
        return 'Tasks I\'ve Offered On';
      case 'claimed':
        return 'My Claimed Items';
      case 'archived':
        return 'Archived Tasks';
      default:
        return 'Tasks I Created';
    }
  };

  const getSectionCount = () => {
    switch (activeSection) {
      case 'created':
        return myCreatedTasks.filter(task => !task.isArchived).length;
      case 'offered':
        return myOfferedTasks.filter(task => !task.isArchived).length;
      case 'claimed':
        return myClaimedItems.length;
      case 'archived':
        return archivedTasks.length;
      default:
        return 0;
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Home size={24} className="text-orange-500" />
          <h2 className="text-2xl font-bold text-white">MyBoard</h2>
        </div>
        <p className="text-gray-400">Your tasks, offers, and claimed items</p>
      </div>

      {/* Section Navigation */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('created')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
              activeSection === 'created'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Briefcase size={16} />
            <span>Tasks I Created</span>
            <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">
              {myCreatedTasks.filter(task => !task.isArchived).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('offered')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
              activeSection === 'offered'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <HandHeart size={16} />
            <span>Tasks I've Offered On</span>
            <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">
              {myOfferedTasks.filter(task => !task.isArchived).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('claimed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
              activeSection === 'claimed'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Gift size={16} />
            <span>My Claimed Items</span>
            <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">
              {myClaimedItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('archived')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
              activeSection === 'archived'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Archive size={16} />
            <span>Archived</span>
            <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">
              {archivedTasks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">
          {getSectionTitle()} ({getSectionCount()})
        </h3>
      </div>

      {/* Section Content */}
      {renderContent()}
    </div>
  );
}
