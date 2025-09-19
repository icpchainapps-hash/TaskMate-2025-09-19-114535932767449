import React, { useState } from 'react';
import { X, ArrowLeft, DollarSign, MessageSquare, Heart, Clock, AlertCircle } from 'lucide-react';
import { useMakeOffer } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Offer, OfferStatus, Task, TaskType, TimeSlot } from '../backend';
import TimeSlotPicker from './TimeSlotPicker';

interface MakeOfferModalProps {
  task: Task;
  onClose: () => void;
}

export default function MakeOfferModal({ task, onClose }: MakeOfferModalProps) {
  const { identity } = useInternetIdentity();
  const makeOffer = useMakeOffer();

  const [formData, setFormData] = useState({
    price: '',
    message: ''
  });

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  const [validationErrors, setValidationErrors] = useState({
    price: '',
    message: '',
    timeSlot: '',
    booking: ''
  });

  const validateForm = (): boolean => {
    const errors = {
      price: '',
      message: '',
      timeSlot: '',
      booking: ''
    };

    // Only validate price for paid tasks
    if (task.taskType === TaskType.paid) {
      if (!formData.price.trim()) {
        errors.price = 'Price is required for paid tasks';
      } else {
        const price = parseInt(formData.price);
        if (isNaN(price) || price <= 0) {
          errors.price = 'Please enter a valid price';
        } else if (price > Number(task.budget) / 100) {
          errors.price = `Price cannot exceed task budget of $${(Number(task.budget) / 100).toLocaleString()}`;
        }
      }
    }

    if (!formData.message.trim()) {
      errors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters long';
    }

    // Validate time slot selection
    if (!selectedTimeSlot) {
      errors.timeSlot = 'Please select an available time slot';
    }

    setValidationErrors(errors);
    return !errors.price && !errors.message && !errors.timeSlot && !errors.booking;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identity || !validateForm()) return;

    const offer: Offer = {
      id: `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: task.id,
      tasker: identity.getPrincipal(),
      price: task.taskType === TaskType.paid ? BigInt(parseInt(formData.price) * 100) : BigInt(0), // Convert to cents for paid tasks, 0 for volunteer
      message: formData.message.trim(),
      createdAt: BigInt(Date.now() * 1000000),
      status: OfferStatus.pending,
      selectedTimeSlot: selectedTimeSlot || undefined // Convert null to undefined to match backend interface
    };

    try {
      await makeOffer.mutateAsync(offer);
      onClose();
    } catch (error) {
      console.error('Failed to make offer:', error);
      
      // Enhanced error handling for booking conflicts
      if (error instanceof Error) {
        if (error.message.includes('already been booked') || error.message.includes('time slot')) {
          setValidationErrors(prev => ({
            ...prev,
            booking: 'This time slot has been booked by another user while you were making your offer. Please select a different available time slot.',
            timeSlot: ''
          }));
          setSelectedTimeSlot(null); // Clear the selected slot so user must choose again
        } else if (error.message.includes('not available')) {
          setValidationErrors(prev => ({
            ...prev,
            booking: 'The selected time slot is no longer available. Please choose a different time slot.',
            timeSlot: ''
          }));
          setSelectedTimeSlot(null);
        } else {
          setValidationErrors(prev => ({
            ...prev,
            booking: error.message || 'Failed to submit offer. Please try again.'
          }));
        }
      } else {
        setValidationErrors(prev => ({
          ...prev,
          booking: 'Failed to submit offer. Please try again.'
        }));
      }
    }
  };

  const formatBudget = (budget: bigint) => {
    return `$${(Number(budget) / 100).toLocaleString()}`;
  };

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
        <h2 className="text-lg font-bold text-white">
          {task.taskType === TaskType.volunteer ? 'Volunteer to Help' : 'Make Offer'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors sm:block hidden"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8 space-y-6 max-w-2xl mx-auto">
          {/* Booking Error Display */}
          {validationErrors.booking && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle size={16} />
                <span className="font-medium">Booking Conflict</span>
              </div>
              <p className="text-gray-300 text-sm">{validationErrors.booking}</p>
              <div className="mt-3 p-3 bg-red-800/20 border border-red-400/30 rounded-lg">
                <p className="text-red-300 text-xs">
                  <strong>What happened:</strong> The time slot you selected was booked by another user while you were making your offer. 
                  Please select a different available time slot to continue.
                </p>
              </div>
            </div>
          )}

          {/* Task Summary */}
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Task Details</h3>
            <div className="space-y-3">
              <div>
                <h4 className="text-white font-medium text-base mb-1">{task.title}</h4>
                <p className="text-gray-300 text-sm line-clamp-3">{task.description}</p>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-600">
                <span className="text-gray-400 text-sm">Task Type:</span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
                  task.taskType === TaskType.paid
                    ? 'bg-orange-900/20 text-orange-400 border-orange-500/30'
                    : 'bg-green-900/20 text-green-400 border-green-500/30'
                }`}>
                  {task.taskType === TaskType.paid ? (
                    <>
                      <DollarSign size={12} />
                      <span>Paid Task</span>
                    </>
                  ) : (
                    <>
                      <Heart size={12} />
                      <span>Volunteer Task</span>
                    </>
                  )}
                </div>
              </div>

              {task.taskType === TaskType.paid && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Task Budget:</span>
                  <span className="text-orange-500 font-bold text-lg">
                    {formatBudget(task.budget)}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Category:</span>
                <span className="text-gray-300 text-sm">{task.category}</span>
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

          {/* Time Slot Selection with enhanced booking validation */}
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            <TimeSlotPicker
              availabilityCalendar={task.availabilityCalendar}
              selectedTimeSlot={selectedTimeSlot}
              onTimeSlotSelect={setSelectedTimeSlot}
              disabled={false}
              taskId={task.id} // Pass taskId for booking status tracking
            />
            {validationErrors.timeSlot && (
              <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
                <AlertCircle size={16} />
                <span>{validationErrors.timeSlot}</span>
              </div>
            )}
          </div>

          {/* Offer Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-6">
                {task.taskType === TaskType.volunteer ? 'Your Volunteer Offer' : 'Your Offer'}
              </h3>
              
              <div className="space-y-6">
                {/* Price Field - Only show for paid tasks */}
                {task.taskType === TaskType.paid && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Your Price ($) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="number"
                        required
                        min="1"
                        max={Number(task.budget) / 100}
                        value={formData.price}
                        onChange={(e) => {
                          setFormData({ ...formData, price: e.target.value });
                          if (validationErrors.price) {
                            setValidationErrors({ ...validationErrors, price: '' });
                          }
                        }}
                        className={`w-full pl-10 pr-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base ${
                          validationErrors.price ? 'border-red-500' : 'border-gray-600'
                        }`}
                        placeholder="Enter your price"
                      />
                    </div>
                    {validationErrors.price && (
                      <p className="text-red-400 text-sm mt-2">{validationErrors.price}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Maximum: {formatBudget(task.budget)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    {task.taskType === TaskType.volunteer ? 'Message to Task Owner *' : 'Message to Task Owner *'}
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <MessageSquare size={16} className="text-gray-400" />
                    </div>
                    <textarea
                      required
                      value={formData.message}
                      onChange={(e) => {
                        setFormData({ ...formData, message: e.target.value });
                        if (validationErrors.message) {
                          setValidationErrors({ ...validationErrors, message: '' });
                        }
                      }}
                      rows={5}
                      className={`w-full pl-10 pr-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-base ${
                        validationErrors.message ? 'border-red-500' : 'border-gray-600'
                      }`}
                      placeholder={
                        task.taskType === TaskType.volunteer
                          ? "Explain why you'd like to volunteer for this task, your experience, availability, and any questions you have..."
                          : "Explain why you're the right person for this job, your experience, timeline, and any questions you have..."
                      }
                    />
                  </div>
                  {validationErrors.message && (
                    <p className="text-red-400 text-sm mt-2">{validationErrors.message}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Minimum 10 characters. Be specific about your approach and timeline.
                  </p>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className={`rounded-lg p-4 sm:p-6 border ${
              task.taskType === TaskType.volunteer
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-blue-900/20 border-blue-500/30'
            }`}>
              <h4 className={`font-semibold mb-3 ${
                task.taskType === TaskType.volunteer ? 'text-green-400' : 'text-blue-400'
              }`}>
                Important Notes
              </h4>
              <div className="space-y-2 text-sm text-gray-300">
                {task.taskType === TaskType.volunteer ? (
                  <>
                    <p>• This is a volunteer task with no payment involved</p>
                    <p>• Your offer will be sent to the task owner for review</p>
                    <p>• You can only make one offer per task</p>
                    <p>• You'll receive an NFT completion certificate when finished</p>
                    <p>• Be clear about your availability and commitment</p>
                    <p>• You must select an available time slot from the owner's availability</p>
                    <p>• Time slots that are already booked cannot be selected</p>
                  </>
                ) : (
                  <>
                    <p>• Your offer will be sent to the task owner for review</p>
                    <p>• You can only make one offer per task</p>
                    <p>• If accepted, payment will be held in escrow until completion</p>
                    <p>• Platform fee: 5% (you'll receive 95% of your quoted price)</p>
                    <p>• Be professional and detailed in your message</p>
                    <p>• You must select an available time slot from the owner's availability</p>
                    <p>• Time slots that are already booked cannot be selected</p>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <button
                type="submit"
                disabled={makeOffer.isPending || !formData.message.trim() || (task.taskType === TaskType.paid && !formData.price.trim()) || !selectedTimeSlot}
                className={`w-full flex items-center justify-center gap-2 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base ${
                  task.taskType === TaskType.volunteer
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600'
                    : 'bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600'
                }`}
              >
                {makeOffer.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    {task.taskType === TaskType.volunteer ? (
                      <>
                        <Heart size={20} />
                        <span>Submit Volunteer Offer</span>
                      </>
                    ) : (
                      <>
                        <DollarSign size={20} />
                        <span>Submit Offer</span>
                      </>
                    )}
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                disabled={makeOffer.isPending}
                className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
              >
                <X size={20} />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
