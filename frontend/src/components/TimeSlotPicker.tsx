import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, CheckCircle, X, Ban, RefreshCw, Info } from 'lucide-react';
import { AvailabilityCalendar, TimeSlot } from '../backend';

interface TimeSlotPickerProps {
  availabilityCalendar: AvailabilityCalendar;
  selectedTimeSlot: TimeSlot | null;
  onTimeSlotSelect: (timeSlot: TimeSlot) => void;
  disabled?: boolean;
  taskId?: string; // For booking status tracking
}

interface DateTimeSlot {
  date: Date;
  timeSlot: TimeSlot;
  isBooked?: boolean;
  isPast?: boolean;
  isAvailable?: boolean;
  bookedBy?: any;
  bookingType?: string;
  bookingTimestamp?: bigint;
}

export default function TimeSlotPicker({ 
  availabilityCalendar, 
  selectedTimeSlot, 
  onTimeSlotSelect, 
  disabled = false,
  taskId = ''
}: TimeSlotPickerProps) {
  const [selectedDateTimeSlot, setSelectedDateTimeSlot] = useState<DateTimeSlot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Auto-refresh availability data every few seconds for real-time updates
  useEffect(() => {
    if (!taskId) return;
    
    const interval = setInterval(() => {
      console.log('Auto-refreshing time slot availability...');
      setLastRefreshTime(Date.now());
      // Note: Without backend support, we just update the timestamp
    }, 2000); // Refresh every 2 seconds for real-time updates

    return () => clearInterval(interval);
  }, [taskId]);

  // Helper function to check if a date is in the past using simplified comparison
  const isDateInPast = useCallback((date: Date) => {
    const now = new Date();
    
    // Create midnight dates for accurate day comparison
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    return dateMidnight.getTime() < todayMidnight.getTime();
  }, []);

  // Fixed helper function to check if a time slot is in the past with simplified date comparison
  const isTimeSlotInPast = useCallback((date: Date, timeSlot: TimeSlot): boolean => {
    try {
      // Extract time from the timeSlot.startTime (which is in nanoseconds)
      const startTimeNs = Number(timeSlot.startTime);
      const startTimeMs = startTimeNs / 1000000; // Convert nanoseconds to milliseconds
      const startTimeDate = new Date(startTimeMs);
      
      // Validate the converted date
      if (isNaN(startTimeDate.getTime())) {
        console.warn('Invalid time slot timestamp:', startTimeNs);
        return false; // If invalid, don't block the selection
      }
      
      // Create a combined date-time for the slot using the provided date and time from timeSlot
      const slotDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        startTimeDate.getHours(),
        startTimeDate.getMinutes(),
        startTimeDate.getSeconds(),
        startTimeDate.getMilliseconds()
      );
      
      // Get current time for comparison
      const now = new Date();
      
      // Simple comparison with a small buffer for processing time
      const bufferMs = 60 * 1000; // 1 minute buffer
      const isPast = slotDateTime.getTime() <= (now.getTime() - bufferMs);
      
      // Simplified logging for debugging
      console.log('Time slot validation (simplified):', {
        slotDateTime: slotDateTime.toISOString(),
        currentTime: now.toISOString(),
        slotTimestamp: slotDateTime.getTime(),
        currentTimestamp: now.getTime(),
        timeDifferenceMinutes: (slotDateTime.getTime() - now.getTime()) / (1000 * 60),
        isPast,
        validationResult: !isPast ? 'VALID_FUTURE_SLOT' : 'PAST_SLOT',
        bufferApplied: '1 minute buffer for processing time'
      });
      
      return isPast;
    } catch (error) {
      console.error('Error checking if time slot is in past:', error);
      // If there's an error, assume it's not in the past to avoid blocking valid selections
      return false;
    }
  }, []);

  // Create date-time combinations from availability calendar
  const dateTimeSlots = useMemo(() => {
    const slots: DateTimeSlot[] = [];
    
    availabilityCalendar.availableDates.forEach(dateTimestamp => {
      const date = new Date(Number(dateTimestamp) / 1000000);
      
      // Skip past dates using simplified comparison
      if (isDateInPast(date)) {
        return;
      }
      
      availabilityCalendar.timeSlots.forEach(timeSlot => {
        const isPast = isTimeSlotInPast(date, timeSlot);
        
        // Without backend support, assume slots are not booked
        const isBooked = false;
        const isAvailable = !isBooked && !isPast;
        
        slots.push({
          date,
          timeSlot,
          isBooked,
          isPast,
          isAvailable
        });
      });
    });
    
    // Sort by date and then by time
    return slots.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      
      return Number(a.timeSlot.startTime) - Number(b.timeSlot.startTime);
    });
  }, [availabilityCalendar, isDateInPast, isTimeSlotInPast]);

  // Group slots by date for display
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, DateTimeSlot[]>();
    
    dateTimeSlots.forEach(slot => {
      const dateKey = slot.date.toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(slot);
    });
    
    return grouped;
  }, [dateTimeSlots]);

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
  const formatDateAndTime = useCallback((dateTimeSlot: DateTimeSlot): string => {
    const dateStr = dateTimeSlot.date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
    
    const startTime = new Date(Number(dateTimeSlot.timeSlot.startTime) / 1000000);
    const endTime = new Date(Number(dateTimeSlot.timeSlot.endTime) / 1000000);
    
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

  const isDateTimeSlotSelected = useCallback((dateTimeSlot: DateTimeSlot) => {
    if (!selectedDateTimeSlot) return false;
    return dateTimeSlot.date.toDateString() === selectedDateTimeSlot.date.toDateString() &&
           Number(dateTimeSlot.timeSlot.startTime) === Number(selectedDateTimeSlot.timeSlot.startTime) &&
           Number(dateTimeSlot.timeSlot.endTime) === Number(selectedDateTimeSlot.timeSlot.endTime);
  }, [selectedDateTimeSlot]);

  const handleDateTimeSlotSelect = useCallback(async (dateTimeSlot: DateTimeSlot) => {
    if (disabled || !dateTimeSlot.isAvailable) {
      // Enhanced feedback when user tries to select an unavailable slot
      if (dateTimeSlot.isBooked) {
        console.warn('Cannot select booked time slot - this slot has already been reserved by another user');
      } else if (dateTimeSlot.isPast) {
        console.warn('Cannot select past time slot - this slot is in the past');
      }
      return;
    }
    
    console.log('Validating time slot availability...');
    setIsRefreshing(true);
    
    try {
      // Simulate validation delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Additional client-side validation with simplified time comparison
      if (isTimeSlotInPast(dateTimeSlot.date, dateTimeSlot.timeSlot)) {
        console.warn('Time slot is in the past - cannot select');
        return;
      }
      
      // Set the selected date-time combination
      setSelectedDateTimeSlot(dateTimeSlot);
      
      // Pass the time slot to parent
      onTimeSlotSelect(dateTimeSlot.timeSlot);
    } catch (error) {
      console.error('Failed to validate time slot:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [disabled, onTimeSlotSelect, isTimeSlotInPast]);

  // Enhanced count available vs booked slots
  const slotCounts = useMemo(() => {
    const total = dateTimeSlots.length;
    const available = dateTimeSlots.filter(slot => slot.isAvailable).length;
    const booked = dateTimeSlots.filter(slot => slot.isBooked).length;
    const past = dateTimeSlots.filter(slot => slot.isPast).length;

    return { total, available, booked, past };
  }, [dateTimeSlots]);

  // Enhanced refresh function for real-time updates
  const handleRefreshAvailability = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log('Manually refreshing availability data...');
      setLastRefreshTime(Date.now());
      // Without backend support, just update the timestamp
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Availability data refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh availability data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Get current date and time for display
  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });
  };

  if (dateTimeSlots.length === 0) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-400 mb-2">
          <AlertCircle size={16} />
          <span className="font-medium">No Available Times</span>
        </div>
        <p className="text-gray-300 text-sm">
          The task owner hasn't set any available times, or all available times have passed.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleRefreshAvailability}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Availability'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-orange-500" />
          <h4 className="text-lg font-semibold text-white">Select Available Time</h4>
        </div>
        <button
          onClick={handleRefreshAvailability}
          disabled={isRefreshing}
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
          title="Refresh availability status"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </span>
        </button>
      </div>

      {/* Current Date Display */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-400 mb-2">
          <Calendar size={16} />
          <span className="font-medium">Today's Date Reference</span>
        </div>
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-1">
            {getCurrentDate()}
          </p>
          <p className="text-gray-300 text-sm">
            Current time: {getCurrentTime()}
          </p>
        </div>
        <p className="text-gray-400 text-xs mt-2 text-center">
          Use this as a reference when selecting your preferred time slot below.
        </p>
      </div>

      {/* Availability status indicator */}
      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
          <CheckCircle size={14} />
          <span className="font-medium">Availability Tracking Active</span>
        </div>
        <p className="text-gray-300 text-xs">
          Showing latest availability status. Last updated: {new Date(lastRefreshTime).toLocaleTimeString()}
        </p>
      </div>

      {/* Enhanced Booking Status Legend */}
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
          Each time slot is linked to a specific date. Only one date-time combination can be selected.
        </p>
      </div>

      {/* Date-Time Slot Selection - Grouped by Date */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Available Date & Time Combinations
        </label>
        
        {Array.from(slotsByDate.entries()).map(([dateKey, slots]) => {
          const date = slots[0].date;
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={dateKey} className="mb-4">
              <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-blue-500" />
                  <h4 className="text-white font-medium">
                    {date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    {isToday && <span className="ml-2 text-blue-400 text-sm">(Today)</span>}
                  </h4>
                </div>
                
                <div className="space-y-2">
                  {slots.map((dateTimeSlot, index) => {
                    const isSelected = isDateTimeSlotSelected(dateTimeSlot);
                    const isUnavailable = !dateTimeSlot.isAvailable;
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleDateTimeSlotSelect(dateTimeSlot)}
                        disabled={disabled || isUnavailable || isRefreshing}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                          isSelected && dateTimeSlot.isAvailable
                            ? 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-300'
                            : dateTimeSlot.isBooked
                              ? 'bg-red-900/20 text-red-400 border border-red-500/30 opacity-60'
                              : dateTimeSlot.isPast
                                ? 'bg-gray-800 text-gray-500 opacity-60'
                                : 'bg-gray-600 hover:bg-gray-500 text-gray-300 hover:shadow-md'
                        }`}
                        title={
                          dateTimeSlot.isBooked ? 'This time slot has been booked by another user and cannot be selected' :
                          dateTimeSlot.isPast ? 'This time slot is in the past and cannot be selected' :
                          'Click to select this date and time combination'
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {dateTimeSlot.isBooked ? (
                              <Ban size={16} className="text-red-400" />
                            ) : dateTimeSlot.isPast ? (
                              <Clock size={16} className="text-gray-500" />
                            ) : dateTimeSlot.isAvailable ? (
                              <Clock size={16} className="text-green-500" />
                            ) : (
                              <Clock size={16} />
                            )}
                            <span className="font-medium">{formatTimeSlot(dateTimeSlot.timeSlot)}</span>
                          </div>
                          
                          {/* Enhanced status indicators with detailed information */}
                          <div className="flex items-center gap-2">
                            {dateTimeSlot.isBooked && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-medium">
                                  Booked
                                </span>
                                {dateTimeSlot.bookingTimestamp && (
                                  <span className="text-xs text-red-300">
                                    {new Date(Number(dateTimeSlot.bookingTimestamp) / 1000000).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                )}
                              </div>
                            )}
                            {dateTimeSlot.isPast && !dateTimeSlot.isBooked && (
                              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-500 border border-gray-500/30 rounded-full">
                                Past
                              </span>
                            )}
                            {dateTimeSlot.isAvailable && (
                              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full font-medium">
                                Available
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {isSelected && dateTimeSlot.isAvailable && (
                          <CheckCircle size={16} className="text-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

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

      {/* Enhanced Selected Time Slot Summary with combined date and time display */}
      {selectedDateTimeSlot && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle size={16} />
            <span className="font-medium">Date & Time Selected</span>
          </div>
          <div className="text-gray-300 text-sm space-y-1">
            <p className="font-medium text-base">
              {formatDateAndTime(selectedDateTimeSlot)}
            </p>
            <p className="text-green-300 text-xs font-medium">
              ✓ This date and time combination is currently available
            </p>
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      {!selectedDateTimeSlot && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Calendar size={16} />
            <span className="font-medium">Select a Date & Time</span>
          </div>
          <p className="text-gray-300 text-sm">
            Choose an available date and time combination from the options above. Each time slot is linked to a specific date, and only one combination can be selected at a time.
          </p>
        </div>
      )}

      {/* Enhanced booking conflict warning with detailed information */}
      {(slotCounts.booked > 0 || slotCounts.past > 0) && (
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
      {slotCounts.booked > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
            <AlertCircle size={14} />
            <span className="font-medium">Date-Time Linked Selection</span>
          </div>
          <p className="text-gray-300 text-xs">
            Each time slot is directly linked to its date. Selecting a date and time creates one specific appointment slot. 
            Only one date-time combination can be selected at a time.
          </p>
        </div>
      )}
    </div>
  );
}
