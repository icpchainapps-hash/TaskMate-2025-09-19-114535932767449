import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, DollarSign, User, Calendar, Tag, Image as ImageIcon, ChevronLeft, ChevronRight, Edit3, CheckCircle, AlertCircle, ArrowLeft, MapPin, Heart } from 'lucide-react';
import { Task, TaskStatus, OfferStatus, TaskType } from '../backend';
import { useGetOffers, useMakeOffer, useGetPayments, useGetUserProfiles, useGetPlatformFeePercentage } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Principal } from '@dfinity/principal';
import MakeOfferModal from './MakeOfferModal';
import EditTaskModal from './EditTaskModal';
import TaskReactions from './TaskReactions';
import TaskComments from './TaskComments';
import TaskCompletionModal from './TaskCompletionModal';
import TaskLocationMap from './TaskLocationMap';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  highlightCommentId?: string;
}

function TaskImage({ imageUrl }: { imageUrl: string }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (imageError) {
    return (
      <div className="w-full h-64 sm:h-80 md:h-96 bg-gray-700 rounded-lg flex items-center justify-center">
        <ImageIcon size={48} className="text-gray-500" />
      </div>
    );
  }

  return (
    <div className="w-full h-64 sm:h-80 md:h-96 bg-gray-700 rounded-lg overflow-hidden relative">
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      )}
      <img
        src={imageUrl}
        alt="Task"
        className="w-full h-full object-cover rounded-lg"
        onLoad={() => setImageLoading(false)}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
        style={{ display: imageLoading ? 'none' : 'block' }}
      />
    </div>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="mb-6">
        <TaskImage imageUrl={images[0]} />
      </div>
    );
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="mb-6">
      <div className="relative">
        <TaskImage imageUrl={images[currentIndex]} />
        
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors z-10"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors z-10"
            >
              <ChevronRight size={20} />
            </button>
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {images.map((imageUrl, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                index === currentIndex ? 'border-orange-500' : 'border-gray-600'
              }`}
            >
              <img
                src={imageUrl}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Function to extract suburb and state from full address
function extractSuburbAndState(address: string): string {
  if (!address || address.trim() === '') return '';
  
  // Split by comma and clean up parts
  const parts = address.split(',').map(part => part.trim()).filter(part => part.length > 0);
  
  if (parts.length === 0) return '';
  
  // Handle different address formats
  if (parts.length === 1) {
    // Only one part - could be just a suburb or city
    return parts[0];
  }
  
  if (parts.length >= 2) {
    // Multiple parts - try to identify suburb and state
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    // Check if last part is a country (common patterns)
    const isCountry = /^(australia|au|usa|us|canada|ca|uk|united kingdom)$/i.test(lastPart);
    
    // Check if last part is a postcode (numbers only)
    const isPostcode = /^\d{4,5}$/.test(lastPart);
    
    if (parts.length >= 3) {
      const thirdLastPart = parts[parts.length - 3];
      
      if (isCountry || isPostcode) {
        // Format: [street], [suburb], [state], [postcode/country]
        return `${thirdLastPart}, ${secondLastPart}`;
      } else {
        // Format: [street], [suburb], [state]
        return `${secondLastPart}, ${lastPart}`;
      }
    } else {
      // Only 2 parts
      if (isCountry || isPostcode) {
        // Format: [suburb], [postcode/country] - return just suburb
        return secondLastPart;
      } else {
        // Format: [suburb], [state]
        return `${secondLastPart}, ${lastPart}`;
      }
    }
  }
  
  // Fallback - return first part
  return parts[0];
}

export default function TaskDetailModal({ task, onClose, highlightCommentId }: TaskDetailModalProps) {
  const { identity } = useInternetIdentity();
  const { data: allOffers = [] } = useGetOffers();
  const { data: payments = [] } = useGetPayments();
  const { data: platformFeePercentage = 5 } = useGetPlatformFeePercentage();
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [scrollToComments, setScrollToComments] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null);

  const taskOffers = allOffers.filter(offer => offer.taskId === task.id);
  const approvedOffer = taskOffers.find(offer => offer.status === OfferStatus.approved);
  const taskPayment = payments.find(payment => payment.taskId === task.id);
  const isTaskOwner = identity?.getPrincipal().toString() === task.requester.toString();
  const isAssignedTasker = identity?.getPrincipal().toString() === task.assignedTasker?.toString();
  const canEditTask = isTaskOwner && task.status === TaskStatus.open;
  const canMarkCompleted = isTaskOwner && (task.status === TaskStatus.assigned || task.status === TaskStatus.inProgress);

  // Get user profiles for all offer makers
  const userPrincipals = React.useMemo(() => {
    const principals: Principal[] = [];
    taskOffers.forEach(offer => {
      principals.push(offer.tasker);
    });
    if (approvedOffer) {
      principals.push(approvedOffer.tasker);
    }
    return principals;
  }, [taskOffers, approvedOffer]);

  const { data: userProfiles = new Map() } = useGetUserProfiles(userPrincipals);

  // Handle scrolling to comments when highlightCommentId is provided
  useEffect(() => {
    if (highlightCommentId && commentsRef.current) {
      setScrollToComments(true);
      // Delay scroll to ensure content is rendered
      setTimeout(() => {
        commentsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 300);
    }
  }, [highlightCommentId]);

  const getWorkerName = () => {
    if (!approvedOffer) return 'Worker';
    const profile = userProfiles.get(approvedOffer.tasker.toString());
    return profile?.name || `${approvedOffer.tasker.toString().slice(0, 8)}...`;
  };

  const getUserDisplayName = (userPrincipal: string) => {
    const profile = userProfiles.get(userPrincipal);
    return profile?.name || `${userPrincipal.slice(0, 8)}...`;
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatBudget = (budget: bigint) => {
    return `$${(Number(budget) / 100).toLocaleString()}`;
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

  const handleMarkCompleted = () => {
    setShowCompletionModal(true);
  };

  const handleTaskCompleted = () => {
    setShowCompletionModal(false);
    onClose();
  };

  const handleTaskUpdated = () => {
    setShowEditModal(false);
    // The task will be updated in the parent component through React Query invalidation
  };

  const suburbAndState = extractSuburbAndState(task.address);

  if (showEditModal) {
    return (
      <EditTaskModal 
        task={task} 
        onClose={() => setShowEditModal(false)} 
        onTaskUpdated={handleTaskUpdated}
      />
    );
  }

  if (showCompletionModal) {
    return (
      <TaskCompletionModal
        taskId={task.id}
        taskTitle={task.title}
        workerName={getWorkerName()}
        onClose={() => setShowCompletionModal(false)}
        onCompleted={handleTaskCompleted}
      />
    );
  }

  if (showOfferModal) {
    return (
      <MakeOfferModal
        task={task}
        onClose={() => setShowOfferModal(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="sm:hidden">Back</span>
        </button>
        <h2 className="text-lg font-bold text-white truncate mx-4">Task Details</h2>
        <div className="flex items-center gap-2">
          {canEditTask && (
            <button
              onClick={() => setShowEditModal(true)}
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
          {/* Task Images */}
          {task.images && task.images.length > 0 && (
            <ImageGallery images={task.images} />
          )}

          {/* Task Info */}
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 break-words">{task.title}</h3>
                {suburbAndState && (
                  <p className="text-lg text-gray-400 mb-3">{suburbAndState}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getTaskStatusColor(task.status)}`}>
                    {getTaskStatusText(task.status)}
                  </div>
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${
                    task.taskType === TaskType.paid
                      ? 'bg-orange-900/20 text-orange-400 border-orange-500/30'
                      : 'bg-green-900/20 text-green-400 border-green-500/30'
                  }`}>
                    {task.taskType === TaskType.paid ? (
                      <>
                        <DollarSign size={14} />
                        <span>Paid Task</span>
                      </>
                    ) : (
                      <>
                        <Heart size={14} />
                        <span>Volunteer Task</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                {task.taskType === TaskType.paid ? (
                  <span className="text-orange-500 font-bold text-2xl sm:text-3xl">
                    {formatBudget(task.budget)}
                  </span>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 text-green-400 border border-green-500/30 rounded-lg">
                    <Heart size={20} />
                    <span className="font-semibold">Volunteer</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Tag size={16} className="text-orange-500 flex-shrink-0" />
              <span className="text-orange-400 font-medium">{task.category}</span>
            </div>

            <p className="text-gray-300 mb-6 leading-relaxed text-base sm:text-lg">{task.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar size={16} className="flex-shrink-0" />
                <span className="text-sm sm:text-base">Due: {formatDate(task.dueDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock size={16} className="flex-shrink-0" />
                <span className="text-sm sm:text-base">Posted: {formatDate(task.createdAt)}</span>
              </div>
            </div>

            {task.requiredSkills.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Required Skills:</h4>
                <div className="flex flex-wrap gap-2">
                  {task.requiredSkills.map((skill, index) => (
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
          </div>

          {/* Task Location Map */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} className="text-orange-500" />
              <h4 className="text-lg font-semibold text-white">Task Location</h4>
            </div>
            <TaskLocationMap 
              task={task}
              isTaskOwner={isTaskOwner}
              isAssignedTasker={isAssignedTasker}
            />
          </div>

          {/* Payment Information - Only show for paid tasks */}
          {task.taskType === TaskType.paid && (approvedOffer || taskPayment) && (
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-lg font-semibold text-white mb-4">Payment Information</h4>
              <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                {approvedOffer && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Agreed Price:</span>
                    <span className="text-white font-semibold">{formatBudget(approvedOffer.price)}</span>
                  </div>
                )}
                
                {taskPayment && (
                  <>
                    <div className="border-t border-gray-600 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Total Payment:</span>
                        <span className="text-white font-semibold">{formatBudget(taskPayment.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Platform Fee ({platformFeePercentage}%):</span>
                        <span className="text-red-400">-{formatBudget(taskPayment.fee)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-600 pt-2">
                        <span className="text-gray-300 font-medium">Net Amount to Tasker:</span>
                        <span className="text-green-400 font-bold">{formatBudget(taskPayment.netAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
                        <CheckCircle size={16} />
                        <span>Payment released on {formatDate(taskPayment.createdAt)}</span>
                      </div>
                    </div>
                  </>
                )}

                {approvedOffer && !taskPayment && task.status !== TaskStatus.completed && (
                  <div className="border-t border-gray-600 pt-3">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                      <AlertCircle size={16} />
                      <span>Payment will be released when task is marked as completed</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      <p>• Platform fee: {platformFeePercentage}% ({formatBudget(BigInt(Math.floor(Number(approvedOffer.price) * platformFeePercentage / 100)))})</p>
                      <p>• Tasker will receive: {formatBudget(BigInt(Number(approvedOffer.price) - Math.floor(Number(approvedOffer.price) * platformFeePercentage / 100)))}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Volunteer Task Info */}
          {task.taskType === TaskType.volunteer && (
            <div className="border-t border-gray-700 pt-6">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Heart size={20} />
                  <span className="font-semibold">Volunteer Task</span>
                </div>
                <p className="text-gray-300 text-sm">
                  This is a volunteer task with no payment involved. Community members are helping out of goodwill.
                  {approvedOffer && (
                    <span className="block mt-2">
                      An NFT completion certificate will be minted for the volunteer upon task completion.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Task Completion Button - Only for paid tasks */}
          {canMarkCompleted && task.taskType === TaskType.paid && (
            <div className="border-t border-gray-700 pt-6">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-semibold mb-2">Ready to Complete?</h4>
                <p className="text-gray-300 text-sm mb-4">
                  Mark this task as completed to automatically release payment to the tasker. 
                  {approvedOffer && (
                    <span className="block mt-1">
                      The tasker will receive {formatBudget(BigInt(Number(approvedOffer.price) - Math.floor(Number(approvedOffer.price) * platformFeePercentage / 100)))} 
                      (after {platformFeePercentage}% platform fee).
                    </span>
                  )}
                </p>
                <button
                  onClick={handleMarkCompleted}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  <CheckCircle size={16} />
                  <span>Complete Task & Rate Work</span>
                </button>
              </div>
            </div>
          )}

          {/* Volunteer Task Completion Button */}
          {canMarkCompleted && task.taskType === TaskType.volunteer && (
            <div className="border-t border-gray-700 pt-6">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-semibold mb-2">Ready to Complete?</h4>
                <p className="text-gray-300 text-sm mb-4">
                  Mark this volunteer task as completed. An NFT completion certificate will be minted for the volunteer.
                </p>
                <button
                  onClick={handleMarkCompleted}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  <CheckCircle size={16} />
                  <span>Complete Volunteer Task</span>
                </button>
              </div>
            </div>
          )}

          {/* Task Reactions - Interactive on detail view */}
          <div className="border-t border-gray-700 pt-6">
            <TaskReactions taskId={task.id} />
          </div>

          {/* Task Comments - Full view on detail modal with highlighting */}
          <div ref={commentsRef} className="border-t border-gray-700 pt-6">
            <TaskComments 
              taskId={task.id} 
              compact={false} 
              highlightCommentId={highlightCommentId}
            />
          </div>

          {/* Offers Section */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h4 className="text-lg font-semibold text-white">
                {task.taskType === TaskType.volunteer ? 'Volunteers' : 'Offers'} ({taskOffers.length})
              </h4>
              {!isTaskOwner && task.status === TaskStatus.open && (
                <button
                  onClick={() => setShowOfferModal(true)}
                  className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  {task.taskType === TaskType.volunteer ? 'Volunteer to Help' : 'Make Offer'}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {taskOffers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg mb-2">
                    {task.taskType === TaskType.volunteer ? 'No volunteers yet' : 'No offers yet'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {task.taskType === TaskType.volunteer 
                      ? 'Be the first to volunteer!' 
                      : 'Be the first to make an offer!'
                    }
                  </p>
                </div>
              ) : (
                taskOffers.map((offer) => (
                  <div key={offer.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-gray-400 flex-shrink-0" />
                        <span className="text-white font-medium">
                          {getUserDisplayName(offer.tasker.toString())}
                        </span>
                        <div className={`px-2 py-1 rounded-full text-xs border ${getOfferStatusColor(offer.status)}`}>
                          {getOfferStatusText(offer.status)}
                        </div>
                      </div>
                      {task.taskType === TaskType.paid && (
                        <span className="text-orange-500 font-bold text-lg">
                          {formatBudget(offer.price)}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm mb-3 leading-relaxed">{offer.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>{formatDate(offer.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
