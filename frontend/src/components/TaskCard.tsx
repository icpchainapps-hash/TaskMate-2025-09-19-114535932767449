import React, { useState, Suspense, lazy } from 'react';
import { Clock, DollarSign, Calendar, Tag, MessageCircle, HandHeart, Archive, ArchiveRestore, AlertTriangle, Heart } from 'lucide-react';
import { Task, TaskStatus, TaskType } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useArchiveTask, useUnarchiveTask } from '../hooks/useQueries';
import TaskReactions from './TaskReactions';
import TaskComments from './TaskComments';

const TaskDetailModal = lazy(() => import('./TaskDetailModal'));
const MakeOfferModal = lazy(() => import('./MakeOfferModal'));

interface TaskCardProps {
  task: Task;
  onMessageOwnerClick?: (taskId: string) => void;
  showArchiveControls?: boolean;
}

function extractSuburbAndState(address: string): string {
  if (!address?.trim()) return '';
  
  const parts = address.split(',').map(part => part.trim()).filter(part => part.length > 0);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    const isCountry = /^(australia|au|usa|us|canada|ca|uk|united kingdom)$/i.test(lastPart);
    const isPostcode = /^\d{4,5}$/.test(lastPart);
    
    if (parts.length >= 3) {
      const thirdLastPart = parts[parts.length - 3];
      
      if (isCountry || isPostcode) {
        return `${thirdLastPart}, ${secondLastPart}`;
      } else {
        return `${secondLastPart}, ${lastPart}`;
      }
    } else {
      if (isCountry || isPostcode) {
        return secondLastPart;
      } else {
        return `${secondLastPart}, ${lastPart}`;
      }
    }
  }
  
  return parts[0];
}

function calculateDaysRemaining(dueDate: bigint): { daysLeft: number; isClosingSoon: boolean } {
  const dueDateMs = Number(dueDate) / 1000000;
  const now = Date.now();
  const timeDiff = dueDateMs - now;
  const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  return {
    daysLeft: Math.max(0, daysLeft),
    isClosingSoon: daysLeft <= 3 && daysLeft > 0
  };
}

function formatDaysRemaining(daysLeft: number): string {
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}

// Enhanced function to format date and time together for availability display
function formatCombinedDateAndTime(dateTimestamp: bigint, timeSlot: any): string {
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
}

function getNextAvailableTimeSlot(availabilityCalendar: any): string {
  if (!availabilityCalendar || availabilityCalendar.availableDates.length === 0 || availabilityCalendar.timeSlots.length === 0) {
    return 'No availability set';
  }

  // Get the earliest available date and first time slot
  const earliestDate = availabilityCalendar.availableDates[0];
  const firstTimeSlot = availabilityCalendar.timeSlots[0];
  
  return formatCombinedDateAndTime(earliestDate, firstTimeSlot);
}

export default function TaskCard({ task, onMessageOwnerClick, showArchiveControls = false }: TaskCardProps) {
  const { identity } = useInternetIdentity();
  const archiveTask = useArchiveTask();
  const unarchiveTask = useUnarchiveTask();
  const [showDetail, setShowDetail] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);

  const isTaskOwner = identity?.getPrincipal().toString() === task.requester.toString();
  const isAuthenticated = !!identity;
  const canMakeOffer = isAuthenticated && !isTaskOwner && task.status === TaskStatus.open;

  const formatBudget = (budget: bigint) => {
    return `$${(Number(budget) / 100).toLocaleString()}`;
  };

  const suburbAndState = extractSuburbAndState(task.address);
  const { daysLeft, isClosingSoon } = calculateDaysRemaining(task.dueDate);
  const nextAvailableSlot = getNextAvailableTimeSlot(task.availabilityCalendar);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.task-reactions') || 
        target.closest('.task-comments') || 
        target.closest('.message-owner-button-subtle') ||
        target.closest('.make-offer-button') ||
        target.closest('.archive-button') ||
        target.closest('button') || 
        target.closest('textarea') ||
        target.closest('form')) {
      return;
    }
    setShowDetail(true);
  };

  const handleMessageOwnerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMessageOwnerClick && isAuthenticated) {
      onMessageOwnerClick(task.id);
    }
  };

  const handleMakeOfferClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMakeOffer) {
      setShowOfferModal(true);
    }
  };

  const handleArchiveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTaskOwner) return;
    
    try {
      if (task.isArchived) {
        await unarchiveTask.mutateAsync(task.id);
      } else {
        await archiveTask.mutateAsync(task.id);
      }
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
        {task.isArchived && (
          <div className="flex items-center gap-2 mb-3 text-orange-400">
            <Archive size={16} />
            <span className="text-sm font-medium">Archived</span>
          </div>
        )}

        <div onClick={handleCardClick} className="cursor-pointer">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-start gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white line-clamp-2 flex-1">{task.title}</h3>
                {isClosingSoon && !task.isArchived && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-900/20 text-red-400 border border-red-500/30 rounded-full text-xs font-medium flex-shrink-0">
                    <AlertTriangle size={12} />
                    <span>Closing Soon</span>
                  </div>
                )}
              </div>
              {suburbAndState && (
                <p className="text-sm text-gray-400 mb-2">{suburbAndState}</p>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {task.taskType === TaskType.paid ? (
                <span className="text-orange-500 font-bold text-lg">
                  {formatBudget(task.budget)}
                </span>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium">
                  <Heart size={14} />
                  <span>Volunteer</span>
                </div>
              )}
              
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                task.taskType === TaskType.paid
                  ? 'bg-orange-900/20 text-orange-400 border border-orange-500/30'
                  : 'bg-green-900/20 text-green-400 border border-green-500/30'
              }`}>
                {task.taskType === TaskType.paid ? 'Paid Task' : 'Volunteer Task'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-orange-500" />
            <span className="text-orange-400 text-sm font-medium">{task.category}</span>
          </div>

          <p className="text-gray-300 text-sm mb-4 line-clamp-2">{task.description}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {task.requiredSkills.slice(0, 3).map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
              >
                {skill}
              </span>
            ))}
            {task.requiredSkills.length > 3 && (
              <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                +{task.requiredSkills.length - 3} more
              </span>
            )}
          </div>

          {/* Enhanced Availability Summary with combined date and time display */}
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
              <Clock size={14} />
              <span className="font-medium">Next Available</span>
            </div>
            <p className="text-gray-300 text-sm font-medium">
              {nextAvailableSlot}
            </p>
            {task.availabilityCalendar.availableDates.length > 1 && (
              <p className="text-gray-400 text-xs mt-1">
                +{task.availabilityCalendar.availableDates.length - 1} more date{task.availabilityCalendar.availableDates.length - 1 !== 1 ? 's' : ''} available
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span className={isClosingSoon ? 'text-red-400 font-medium' : ''}>
                {formatDaysRemaining(daysLeft)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>Posted {new Date(Number(task.createdAt) / 1000000).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
          {showArchiveControls && isTaskOwner && (
            <button
              onClick={handleArchiveClick}
              disabled={archiveTask.isPending || unarchiveTask.isPending}
              className="archive-button w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium text-sm border border-gray-500 hover:border-gray-400 disabled:cursor-not-allowed"
            >
              {archiveTask.isPending || unarchiveTask.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : task.isArchived ? (
                <>
                  <ArchiveRestore size={16} className="flex-shrink-0" />
                  <span>Unarchive</span>
                </>
              ) : (
                <>
                  <Archive size={16} className="flex-shrink-0" />
                  <span>Archive</span>
                </>
              )}
            </button>
          )}

          {canMakeOffer && !task.isArchived && (
            <button
              onClick={handleMakeOfferClick}
              className="make-offer-button w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg transition-colors font-medium text-sm border border-orange-500 hover:border-orange-600 shadow-sm hover:shadow-md"
            >
              {task.taskType === TaskType.volunteer ? (
                <>
                  <Heart size={16} className="flex-shrink-0" />
                  <span>Volunteer to Help</span>
                </>
              ) : (
                <>
                  <HandHeart size={16} className="flex-shrink-0" />
                  <span>Make Offer</span>
                </>
              )}
            </button>
          )}

          {isAuthenticated ? (
            <button
              onClick={handleMessageOwnerClick}
              className="message-owner-button-subtle w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-4 py-2.5 rounded-lg transition-colors font-medium text-sm border border-gray-600 hover:border-gray-500"
            >
              <MessageCircle size={16} className="flex-shrink-0" />
              <span>{isTaskOwner ? 'View Messages' : 'Message Owner'}</span>
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 bg-gray-700 text-gray-400 px-4 py-2.5 rounded-lg border border-gray-600 text-sm">
              <MessageCircle size={16} />
              <span>Login to message owner</span>
            </div>
          )}
        </div>

        {(!task.isArchived || showArchiveControls) && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
            <div className="task-reactions">
              <TaskReactions taskId={task.id} />
            </div>
            
            <div className="task-comments">
              <TaskComments 
                taskId={task.id} 
                compact={!showComments}
                onToggleExpand={() => setShowComments(!showComments)}
              />
            </div>
          </div>
        )}
      </div>

      {showOfferModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}>
          <MakeOfferModal
            task={task}
            onClose={() => setShowOfferModal(false)}
          />
        </Suspense>
      )}

      {showDetail && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}>
          <TaskDetailModal task={task} onClose={() => setShowDetail(false)} />
        </Suspense>
      )}
    </>
  );
}
