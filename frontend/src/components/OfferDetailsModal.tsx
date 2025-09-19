import React, { useEffect, useRef } from 'react';
import { X, DollarSign, User, Calendar, Clock, MessageSquare, AlertCircle, CheckCircle, ArrowLeft, Award, Briefcase, MapPin, Heart, Star } from 'lucide-react';
import { useGetUserProfiles, useApproveOffer, useRejectOffer } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Offer, Task, TaskType } from '../backend';
import { Principal } from '@dfinity/principal';

interface OfferDetailsModalProps {
  offer: Offer;
  task: Task;
  onClose: () => void;
}

export default function OfferDetailsModal({ offer, task, onClose }: OfferDetailsModalProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfiles = new Map() } = useGetUserProfiles([offer.tasker]);
  const approveOffer = useApproveOffer();
  const rejectOffer = useRejectOffer();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  const isTaskOwner = identity?.getPrincipal().toString() === task.requester.toString();
  const taskerProfile = userProfiles.get(offer.tasker.toString());

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

  const handleApproveOffer = async () => {
    try {
      await approveOffer.mutateAsync(offer.id);
      onClose();
    } catch (error) {
      console.error('Failed to approve offer:', error);
    }
  };

  const handleRejectOffer = async () => {
    try {
      await rejectOffer.mutateAsync(offer.id);
      onClose();
    } catch (error) {
      console.error('Failed to reject offer:', error);
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

  const formatDateOnly = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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

  const formatBudget = (budget: bigint) => {
    return `$${(Number(budget) / 100).toLocaleString()}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
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

  return (
    <div 
      className="fixed inset-0 z-50 h-[100dvh] w-full bg-gray-900 md:bg-black md:bg-opacity-50 md:flex md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-details-title"
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
            aria-label="Close offer details"
          >
            <ArrowLeft size={20} />
            <span className="md:hidden">Back</span>
          </button>
          <h2 id="offer-details-title" className="text-lg md:text-xl font-bold text-white truncate mx-4">
            Offer Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors hidden md:block focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-lg p-1"
            aria-label="Close offer details"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-safe-area-inset-bottom md:pb-0">
          <div className="p-4 md:p-6 space-y-6 md:space-y-8">
            {/* Offer Summary */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {taskerProfile?.profilePicture ? (
                      <img
                        src={taskerProfile.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-lg md:text-xl">
                        {taskerProfile?.name?.charAt(0).toUpperCase() || 'T'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-medium text-base md:text-lg">
                      {taskerProfile?.name || `${offer.tasker.toString().slice(0, 8)}...`}
                    </h3>
                    {taskerProfile?.averageRating > 0 && (
                      <div className="flex items-center gap-1 mb-1">
                        {renderStars(Math.round(taskerProfile.averageRating))}
                        <span className="text-gray-400 text-sm ml-1">
                          ({Number(taskerProfile.completedJobs)} jobs)
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-gray-400 text-sm">
                      <Clock size={12} />
                      <span>Offered {formatDate(offer.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {task.taskType === TaskType.paid ? (
                    <>
                      <div className="text-2xl md:text-3xl font-bold text-orange-500">
                        {formatBudget(offer.price)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Task budget: {formatBudget(task.budget)}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 text-green-400 border border-green-500/30 rounded-lg">
                      <Heart size={16} />
                      <span className="font-semibold">Volunteer</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Time Slot */}
              {offer.selectedTimeSlot && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={16} className="text-blue-400" />
                    <span className="text-blue-400 font-medium">Selected Time Slot</span>
                  </div>
                  <div className="text-gray-300 text-sm space-y-1">
                    <p>
                      <strong>Date:</strong> {new Date(Number(offer.selectedTimeSlot.startTime) / 1000000).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p>
                      <strong>Time:</strong> {formatTimeSlot(offer.selectedTimeSlot.startTime, offer.selectedTimeSlot.endTime)}
                    </p>
                  </div>
                </div>
              )}

              {offer.message && (
                <div className="bg-gray-700 rounded-lg p-3 md:p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="text-gray-300 font-medium text-sm md:text-base">Message from tasker:</span>
                  </div>
                  <p className="text-gray-200 leading-relaxed text-sm md:text-base break-words">
                    {offer.message}
                  </p>
                </div>
              )}

              {/* Offer Status */}
              {offer.status !== 'pending' && (
                <div className="mt-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border ${
                    offer.status === 'approved' 
                      ? 'bg-green-900/20 text-green-400 border-green-500/30'
                      : 'bg-red-900/20 text-red-400 border-red-500/30'
                  }`}>
                    {offer.status === 'approved' ? (
                      <CheckCircle size={16} />
                    ) : (
                      <X size={16} />
                    )}
                    <span>
                      Offer {offer.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bidder Profile Information */}
            {taskerProfile && (
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <h4 className="text-lg md:text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <User size={20} className="text-orange-500" />
                  Bidder Profile
                </h4>
                
                {/* Basic Profile Info */}
                <div className="space-y-4 mb-6">
                  {taskerProfile.bio && (
                    <div>
                      <span className="text-gray-400 text-sm">Bio:</span>
                      <p className="text-gray-300 text-sm mt-1 leading-relaxed">{taskerProfile.bio}</p>
                    </div>
                  )}

                  {taskerProfile.skills.length > 0 && (
                    <div>
                      <span className="text-gray-400 text-sm mb-2 block">Skills:</span>
                      <div className="flex flex-wrap gap-2">
                        {taskerProfile.skills.map((skill, index) => (
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
                </div>

                {/* Accreditations Section */}
                <div className="mb-6">
                  <h5 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Award size={18} className="text-blue-500" />
                    Accreditations & Certifications ({taskerProfile.accreditations.length})
                  </h5>
                  {taskerProfile.accreditations.length > 0 ? (
                    <div className="space-y-3">
                      {taskerProfile.accreditations.map((accreditation) => (
                        <div key={accreditation.id} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
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
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 bg-gray-700 rounded-lg">
                      <Award size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No accreditations listed</p>
                    </div>
                  )}
                </div>

                {/* Work History Section */}
                <div className="mb-6">
                  <h5 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Briefcase size={18} className="text-green-500" />
                    Work History on Taskmate ({taskerProfile.workHistory.length})
                  </h5>
                  {taskerProfile.workHistory.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {taskerProfile.workHistory
                        .sort((a, b) => Number(b.completionDate - a.completionDate))
                        .slice(0, 5) // Show only the 5 most recent
                        .map((work) => (
                          <div key={work.taskId} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h6 className="text-white font-medium text-sm mb-1">{work.title}</h6>
                                <p className="text-gray-300 text-xs mb-2 line-clamp-2">{work.description}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    {formatDateOnly(work.completionDate)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin size={10} />
                                    {work.category}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 ml-2">
                                {work.taskType === 'paid' ? (
                                  <span className="text-green-400 font-semibold text-sm">
                                    ${(Number(work.budget) / 100).toLocaleString()}
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                                    <Heart size={10} />
                                    <span>Volunteer</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 border border-green-500/30 rounded-full text-xs">
                                  <CheckCircle size={10} />
                                  <span>Completed</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      {taskerProfile.workHistory.length > 5 && (
                        <p className="text-xs text-gray-400 text-center py-2">
                          Showing 5 most recent completed tasks
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 bg-gray-700 rounded-lg">
                      <Briefcase size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No completed tasks yet</p>
                      <p className="text-xs">This would be their first task on Taskmate</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Task Details */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
              <h4 className="text-lg md:text-xl font-semibold text-white mb-4">Task Details</h4>
              <div className="space-y-4">
                <div>
                  <h5 className="text-white font-medium text-base md:text-lg mb-2">{task.title}</h5>
                  <p className="text-gray-300 text-sm md:text-base leading-relaxed break-words">{task.description}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Calendar size={14} className="flex-shrink-0" />
                    <span>Due: {formatDate(task.dueDate)}</span>
                  </div>
                  {task.taskType === TaskType.paid && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <DollarSign size={14} className="flex-shrink-0" />
                      <span>Budget: {formatBudget(task.budget)}</span>
                    </div>
                  )}
                </div>

                {task.requiredSkills.length > 0 && (
                  <div className="pt-3 border-t border-gray-600">
                    <span className="text-gray-400 text-sm mb-2 block">Required Skills:</span>
                    <div className="flex flex-wrap gap-2">
                      {task.requiredSkills.map((skill, index) => (
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

            {/* Contact Information */}
            {isTaskOwner && (
              <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <h4 className="text-white font-medium mb-3 text-base md:text-lg">Contact Tasker</h4>
                <p className="text-gray-300 text-sm md:text-base mb-3 leading-relaxed">
                  Use the messaging system to communicate with the tasker about this offer.
                </p>
                <div className="text-gray-400 text-sm space-y-1">
                  <p><span className="font-medium">Tasker:</span> {taskerProfile?.name || 'Anonymous Tasker'}</p>
                  {taskerProfile?.bio && (
                    <p><span className="font-medium">Bio:</span> {taskerProfile.bio}</p>
                  )}
                  {offer.selectedTimeSlot && (
                    <p>
                      <span className="font-medium">Requested Time:</span> {' '}
                      {new Date(Number(offer.selectedTimeSlot.startTime) / 1000000).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })} at {formatTimeSlot(offer.selectedTimeSlot.startTime, offer.selectedTimeSlot.endTime)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!isTaskOwner && (
              <div className="text-center py-4 text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-sm md:text-base">Only the task owner can approve or reject offers</p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer Actions - Mobile */}
        {isTaskOwner && offer.status === 'pending' && (
          <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 pb-safe-area-inset-bottom md:pb-4 md:bg-gray-900 md:rounded-b-2xl flex-shrink-0">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleApproveOffer}
                disabled={approveOffer.isPending}
                className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 md:py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                {approveOffer.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <CheckCircle size={16} />
                )}
                <span>{approveOffer.isPending ? 'Approving...' : 'Approve Offer'}</span>
              </button>
              <button
                ref={lastFocusableRef}
                onClick={handleRejectOffer}
                disabled={rejectOffer.isPending}
                className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 md:py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                {rejectOffer.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <X size={16} />
                )}
                <span>{rejectOffer.isPending ? 'Rejecting...' : 'Reject Offer'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Set last focusable element for non-task owners */}
        {!isTaskOwner && (
          <div className="hidden">
            <button ref={lastFocusableRef} />
          </div>
        )}
      </div>
    </div>
  );
}
