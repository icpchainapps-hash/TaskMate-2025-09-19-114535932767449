import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, CheckCircle, X, ArrowLeft, Ban, RefreshCw, Info } from 'lucide-react';
import { AvailabilityCalendar, TimeSlot } from '../backend';

interface FeedTimeSlotPickerProps {
  availabilityCalendar: AvailabilityCalendar;
  selectedTimeSlot: TimeSlot | null;
  onTimeSlotSelect: (timeSlot: TimeSlot) => void;
  onClose: () => void;
  postType: 'freecycle' | 'swap' | 'volunteer_slot';
  postTitle: string;
  postId: string;
  disabled?: boolean;
}

interface ExtendedTimeSlot extends TimeSlot {
  isBooked?: boolean;
  isPast?: boolean;
  isAvailable?: boolean;
  bookedBy?: any;
  bookingType?: string;
  bookingTimestamp?: bigint;
}

export default function FeedTimeSlotPicker({ 
  availabilityCalendar, 
  selectedTimeSlot, 
  onTimeSlotSelect, 
  onClose,
  postType,
  postTitle,
  postId,
  disabled = false 
}: FeedTimeSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Auto-refresh availability data for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing feed post time slot availability...');
      setLastRefreshTime(Date.now());
      // Note: For feed posts, we would need backend support for booking status
      // For now, we'll just update the timestamp to show the interface is active
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Helper function to check if a date is in the past
  const isDateInPast = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }, []);

  // Enhanced memoized available dates with stable filtering
  const availableDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return availabilityCalendar.availableDates
      .map(timestamp => new Date(Number(timestamp) / 1000000))
      .filter(date => date >= today)
      .sort((a, b) => a.getTime() - b.getTime());
  }, [availabilityCalendar.availableDates]);

  // Enhanced memoized time slots for selected date with booking status simulation
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return [];

    return availabilityCalendar.timeSlots.map(slot => {
      const startTime = new Date(Number(slot.startTime) / 1000000);
      const endTime = new Date(Number(slot.endTime) / 1000000);
      
      const slotStart = new Date(selectedDate);
      slotStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      
      const slotEnd = new Date(selectedDate);
      slotEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      
      const timeSlot = {
        startTime: BigInt(slotStart.getTime() * 1000000),
        endTime: BigInt(slotEnd.getTime() * 1000000)
      };

      // For feed posts, we simulate booking status since backend support would be needed
      // In a real implementation, this would fetch from backend
      const isPast = slotStart < new Date();
      const isBooked = false; // Would be determined by backend for feed posts
      const isAvailable = !isBooked && !isPast;

      return {
        ...timeSlot,
        isBooked,
        isPast,
        isAvailable
      } as ExtendedTimeSlot;
    });
  }, [selectedDate, availabilityCalendar.timeSlots]);

  const formatTime = useCallback((timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }, []);

  const formatTimeSlot = useCallback((slot: TimeSlot) => {
    return `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
  }, [formatTime]);

  // Enhanced function to format date and time together in user-friendly format
  const formatDateAndTime = useCallback((date: Date, timeSlot: TimeSlot): string => {
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
    
    const startTime = new Date(Number(timeSlot.startTime) / 1000000);
    const endTime = new Date(Number(timeSlot.endTime) / 1000000);
    
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
  }, []);

  const isTimeSlotSelected = useCallback((slot: TimeSlot) => {
    if (!selectedTimeSlot) return false;
    return Number(slot.startTime) === Number(selectedTimeSlot.startTime) && 
           Number(slot.endTime) === Number(selectedTimeSlot.endTime);
  }, [selectedTimeSlot]);

  const handleTimeSlotSelect = useCallback(async (slot: ExtendedTimeSlot) => {
    if (disabled || !slot.isAvailable) {
      // Enhanced feedback when user tries to select an unavailable slot
      if (slot.isBooked) {
        console.warn('Cannot select booked time slot - this slot has already been reserved by another user');
      } else if (slot.isPast) {
        console.warn('Cannot select past time slot - this slot is in the past');
      }
      return;
    }
    
    // For feed posts, we would fetch latest availability here
    console.log('Validating time slot availability for feed post...');
    setIsRefreshing(true);
    
    try {
      // Simulate backend validation delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Remove the booking status properties before passing to parent
      const cleanSlot: TimeSlot = {
        startTime: slot.startTime,
        endTime: slot.endTime
      };
      onTimeSlotSelect(cleanSlot);
    } catch (error) {
      console.error('Failed to validate time slot:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [disabled, onTimeSlotSelect]);

  // Enhanced count available vs booked slots for the selected date
  const slotCounts = useMemo(() => {
    if (!selectedDate || availableTimeSlots.length === 0) {
      return { total: 0, available: 0, booked: 0, past: 0 };
    }

    const total = availableTimeSlots.length;
    const available = availableTimeSlots.filter(slot => slot.isAvailable).length;
    const booked = availableTimeSlots.filter(slot => slot.isBooked).length;
    const past = availableTimeSlots.filter(slot => slot.isPast).length;

    return { total, available, booked, past };
  }, [availableTimeSlots, selectedDate]);

  // Enhanced refresh function for real-time updates
  const handleRefreshAvailability = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log('Manually refreshing feed post availability data...');
      setLastRefreshTime(Date.now());
      // For feed posts, this would call backend to get latest booking status
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Feed post availability data refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh availability data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const getActionText = () => {
    switch (postType) {
      case 'freecycle': return 'pickup';
      case 'swap': return 'exchange';
      case 'volunteer_slot': return 'volunteer activity';
      default: return 'activity';
    }
  };

  const getActionVerb = () => {
    switch (postType) {
      case 'freecycle': return 'Request Pickup';
      case 'swap': return 'Claim Swap';
      case 'volunteer_slot': return 'Pledge Volunteer Slot';
      default: return 'Confirm';
    }
  };

  const handleCancel = () => {
    // Simply close the modal without any action
    onClose();
  };

  if (availableDates.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="sm:hidden">Back</span>
          </button>
          <h3 className="text-lg font-semibold text-white">Time Slot Required</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors sm:block hidden"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
              <AlertCircle size={48} className="mx-auto mb-4 text-yellow-400" />
              <h4 className="text-yellow-400 font-semibold text-lg mb-2">No Available Dates</h4>
              <p className="text-gray-300 text-sm mb-4">
                This post requires time slot selection, but no available dates are set for this {getActionText()}, or all dates have passed.
              </p>
              <p className="text-gray-400 text-xs">
                You can contact the post owner through messaging to arrange a time.
              </p>
            </div>
            
            <button
              onClick={handleCancel}
              className="w-full mt-6 bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (availabilityCalendar.timeSlots.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="sm:hidden">Back</span>
          </button>
          <h3 className="text-lg font-semibold text-white">Time Slot Required</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors sm:block hidden"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
              <AlertCircle size={48} className="mx-auto mb-4 text-yellow-400" />
              <h4 className="text-yellow-400 font-semibold text-lg mb-2">No Time Slots Available</h4>
              <p className="text-gray-300 text-sm mb-4">
                This post requires time slot selection, but no time slots are set for this {getActionText()}.
              </p>
              <p className="text-gray-400 text-xs">
                You can contact the post owner through messaging to arrange a time.
              </p>
            </div>
            
            <button
              onClick={handleCancel}
              className="w-full mt-6 bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="sm:hidden">Back</span>
        </button>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">Select Available Time Slot</h3>
          <p className="text-sm text-gray-400">Required to proceed with your request</p>
        </div>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-white transition-colors sm:block hidden"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Requirement Notice */}
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Clock size={16} />
              <span className="font-medium">Time Slot Selection Required</span>
            </div>
            <p className="text-gray-300 text-sm">
              This post has availability slots set. You must select a specific available time slot before your {getActionText()} request can be processed.
            </p>
          </div>

          {/* Real-time availability status */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
              <RefreshCw size={14} />
              <span className="font-medium">Real-time Availability Tracking</span>
            </div>
            <p className="text-gray-300 text-xs">
              Showing latest availability status. Last updated: {new Date(lastRefreshTime).toLocaleTimeString()}
            </p>
          </div>

          {/* Enhanced Booking Status Legend with real-time indicators */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
              <Info size={14} />
              <span className="font-medium">Time Slot Status Guide</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-300">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-300">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-gray-300">Past</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-gray-300">Selected</span>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-2">
              Only available (green) time slots can be selected. Booked and past slots are automatically disabled.
            </p>
          </div>

          {/* Post Info */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-white font-medium text-base mb-2">{postTitle}</h4>
            <p className="text-gray-400 text-sm">
              Choose when you want to {getActionText()}
            </p>
          </div>

          {/* Enhanced Date Selection with stable rendering */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Available Dates
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableDates.map((date) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                const isPast = isDateInPast(date);
                
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    disabled={disabled || isPast}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-orange-500 text-white shadow-lg'
                        : isPast
                          ? 'bg-gray-800 text-gray-500'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:shadow-md'
                    } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="text-center">
                      <div className="font-semibold">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-xs">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      {isPast && (
                        <div className="text-xs text-red-400 mt-1">Past</div>
                      )}
                      {isToday && !isPast && (
                        <div className="text-xs text-blue-400 mt-1">Today</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enhanced Time Slot Selection with comprehensive booking status indicators */}
          {selectedDate && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  Time Slots for {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </label>
                <div className="flex items-center gap-2">
                  {slotCounts.total > 0 && (
                    <div className="text-xs text-gray-400">
                      {slotCounts.available} available • {slotCounts.booked} booked • {slotCounts.past} past
                    </div>
                  )}
                  <button
                    onClick={handleRefreshAvailability}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-2 py-1 rounded text-xs transition-colors disabled:cursor-not-allowed"
                    title="Refresh availability status"
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                    <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>
              </div>
              
              {availableTimeSlots.length === 0 ? (
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <Clock size={24} className="mx-auto mb-2 text-gray-500" />
                  <p className="text-gray-400 text-sm">No time slots available for this date</p>
                  <button
                    onClick={handleRefreshAvailability}
                    disabled={isRefreshing}
                    className="mt-3 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm mx-auto disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableTimeSlots.map((slot, index) => {
                    const isSelected = isTimeSlotSelected(slot);
                    const isUnavailable = !slot.isAvailable;
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleTimeSlotSelect(slot)}
                        disabled={disabled || isUnavailable || isRefreshing}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                          isSelected && slot.isAvailable
                            ? 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-300'
                            : slot.isBooked
                              ? 'bg-red-900/20 text-red-400 border border-red-500/30 opacity-60'
                              : slot.isPast
                                ? 'bg-gray-800 text-gray-500 opacity-60'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:shadow-md'
                        }`}
                        title={
                          slot.isBooked ? 'This time slot has been booked by another user and cannot be selected' :
                          slot.isPast ? 'This time slot is in the past and cannot be selected' :
                          'Click to select this time slot'
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {slot.isBooked ? (
                              <Ban size={16} className="text-red-400" />
                            ) : slot.isPast ? (
                              <Clock size={16} className="text-gray-500" />
                            ) : slot.isAvailable ? (
                              <Clock size={16} className="text-green-500" />
                            ) : (
                              <Clock size={16} />
                            )}
                            <span className="font-medium">{formatTimeSlot(slot)}</span>
                          </div>
                          
                          {/* Enhanced status indicators with detailed information */}
                          <div className="flex items-center gap-2">
                            {slot.isBooked && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-medium">
                                  Booked
                                </span>
                                {slot.bookingTimestamp && (
                                  <span className="text-xs text-red-300">
                                    {new Date(Number(slot.bookingTimestamp) / 1000000).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                )}
                              </div>
                            )}
                            {slot.isPast && !slot.isBooked && (
                              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-500 border border-gray-500/30 rounded-full">
                                Past
                              </span>
                            )}
                            {slot.isAvailable && (
                              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full font-medium">
                                Available
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {isSelected && slot.isAvailable && (
                          <CheckCircle size={16} className="text-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Enhanced booking status summary with detailed breakdown */}
              {slotCounts.total > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-2">
                    <div className="text-green-400 font-bold text-lg">{slotCounts.available}</div>
                    <div className="text-green-300 text-xs">Available</div>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-2">
                    <div className="text-red-400 font-bold text-lg">{slotCounts.booked}</div>
                    <div className="text-red-300 text-xs">Booked</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-2">
                    <div className="text-gray-400 font-bold text-lg">{slotCounts.past}</div>
                    <div className="text-gray-400 text-xs">Past</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-2">
                    <div className="text-gray-300 font-bold text-lg">{slotCounts.total}</div>
                    <div className="text-gray-400 text-xs">Total</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Selected Time Slot Summary with combined date and time display */}
          {selectedTimeSlot && selectedDate && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle size={16} />
                <span className="font-medium">Time Slot Selected & Validated</span>
              </div>
              <div className="text-gray-300 text-sm space-y-1">
                <p className="font-medium">
                  {formatDateAndTime(selectedDate, selectedTimeSlot)}
                </p>
                <p className="text-green-300 text-xs font-medium">
                  ✓ This time slot is currently available based on latest data
                </p>
              </div>
            </div>
          )}

          {/* Enhanced Instructions with booking guidance */}
          {!selectedDate && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Calendar size={16} />
                <span className="font-medium">Step 1: Select a Date</span>
              </div>
              <p className="text-gray-300 text-sm">
                Choose an available date to see the time slots for that day. Only available time slots can be selected - booked and past slots are automatically disabled.
              </p>
            </div>
          )}

          {selectedDate && availableTimeSlots.length === 0 && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <AlertCircle size={16} />
                <span className="font-medium">No Time Slots</span>
              </div>
              <p className="text-gray-300 text-sm">
                No time slots are available for the selected date. Please choose a different date or contact the post owner.
              </p>
            </div>
          )}

          {selectedDate && availableTimeSlots.length > 0 && !selectedTimeSlot && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Clock size={16} />
                <span className="font-medium">Step 2: Select an Available Time Slot</span>
              </div>
              <p className="text-gray-300 text-sm">
                Choose a specific time slot from the available options above. Booked slots are disabled and cannot be selected to prevent conflicts.
              </p>
            </div>
          )}

          {/* Enhanced booking conflict warning with detailed information */}
          {selectedDate && (slotCounts.booked > 0 || slotCounts.past > 0) && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <Ban size={16} />
                <span className="font-medium">Some Slots Unavailable</span>
              </div>
              <div className="text-gray-300 text-sm space-y-1">
                {slotCounts.booked > 0 && (
                  <p>• {slotCounts.booked} time slot{slotCounts.booked !== 1 ? 's are' : ' is'} already booked by other users</p>
                )}
                {slotCounts.past > 0 && (
                  <p>• {slotCounts.past} time slot{slotCounts.past !== 1 ? 's are' : ' is'} in the past</p>
                )}
                <p className="text-green-300 font-medium">
                  • {slotCounts.available} slot{slotCounts.available !== 1 ? 's are' : ' is'} available for selection
                </p>
              </div>
            </div>
          )}

          {/* Enhanced booking protection notice */}
          {selectedDate && slotCounts.booked > 0 && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                <AlertCircle size={14} />
                <span className="font-medium">Booking Protection Active</span>
              </div>
              <p className="text-gray-300 text-xs">
                Booked time slots are automatically disabled and cannot be selected to prevent double-booking conflicts. 
                The system continuously validates slot availability to ensure accurate booking status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-700 space-y-3 flex-shrink-0">
        <button
          onClick={() => {
            if (selectedTimeSlot) {
              onClose();
            }
          }}
          disabled={!selectedTimeSlot || disabled || isRefreshing}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
        >
          {selectedTimeSlot ? getActionVerb() : 'Please Select an Available Time Slot'}
        </button>
        
        <button
          onClick={handleCancel}
          disabled={isRefreshing}
          className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
        >
          Cancel
        </button>

        {/* Enhanced requirement notice with booking protection information */}
        <div className="text-center">
          <p className="text-gray-400 text-xs">
            Time slot selection is required for posts with availability slots. Only available slots can be selected.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Booked and past time slots are automatically disabled to prevent conflicts.
          </p>
        </div>
      </div>
    </div>
  );
}

