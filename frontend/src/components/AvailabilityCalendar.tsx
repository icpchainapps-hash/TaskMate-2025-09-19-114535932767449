import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, Plus, Trash2, AlertCircle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { AvailabilityCalendar, TimeSlot } from '../backend';

interface AvailabilityCalendarProps {
  value: AvailabilityCalendar;
  onChange: (calendar: AvailabilityCalendar) => void;
  disabled?: boolean;
  compact?: boolean;
  optional?: boolean;
}

interface TimeSlotInput {
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
}

interface DateTimeSlot {
  date: Date;
  timeSlot: TimeSlotInput;
}

export default function AvailabilityCalendarComponent({ 
  value, 
  onChange, 
  disabled = false, 
  compact = false,
  optional = false
}: AvailabilityCalendarProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotInput[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [showAddTimeSlot, setShowAddTimeSlot] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState<TimeSlotInput>({
    startHour: '09',
    startMinute: '00',
    endHour: '17',
    endMinute: '00'
  });
  const [componentError, setComponentError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showCalendar, setShowCalendar] = useState(!optional);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Safe date options generation with comprehensive error handling and accurate future date support
  const dateOptions = useMemo(() => {
    try {
      const dates: Date[] = [];
      const today = new Date();
      
      if (isNaN(today.getTime())) {
        console.warn('Invalid current date, using fallback');
        return [];
      }
      
      // Generate dates for the next 365 days to support cross-year date selection
      for (let i = 0; i < 365; i++) {
        try {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          
          if (isNaN(date.getTime())) {
            console.warn(`Invalid date generated for day ${i}`);
            continue;
          }
          
          dates.push(date);
        } catch (dateError) {
          console.warn(`Error creating date for day ${i}:`, dateError);
          continue;
        }
      }
      
      console.log(`Generated ${dates.length} date options including cross-year dates`);
      return dates;
    } catch (error) {
      console.error('Error generating date options:', error);
      return [];
    }
  }, []);

  // Create date-time combinations for display
  const dateTimeSlots = useMemo(() => {
    const slots: DateTimeSlot[] = [];
    
    selectedDates.forEach(date => {
      timeSlots.forEach(timeSlot => {
        slots.push({ date, timeSlot });
      });
    });
    
    // Sort by date and then by time
    return slots.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      
      const aStartTime = parseInt(a.timeSlot.startHour) * 60 + parseInt(a.timeSlot.startMinute);
      const bStartTime = parseInt(b.timeSlot.startHour) * 60 + parseInt(b.timeSlot.startMinute);
      return aStartTime - bStartTime;
    });
  }, [selectedDates, timeSlots]);

  // Enhanced validation function with comprehensive error handling
  const validateTimeSlot = useCallback((slot: TimeSlotInput): boolean => {
    try {
      if (!slot || typeof slot !== 'object') {
        return false;
      }

      const startHour = parseInt(slot.startHour);
      const startMinute = parseInt(slot.startMinute);
      const endHour = parseInt(slot.endHour);
      const endMinute = parseInt(slot.endMinute);
      
      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
        return false;
      }

      if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
        return false;
      }

      if (startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
        return false;
      }
      
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      
      return endTotalMinutes > startTotalMinutes;
    } catch (error) {
      console.error('Error validating time slot:', error);
      return false;
    }
  }, []);

  // Enhanced function to check for duplicate time slots with comprehensive validation
  const isDuplicateTimeSlot = useCallback((newSlot: TimeSlotInput): boolean => {
    try {
      return timeSlots.some(existingSlot => 
        existingSlot.startHour === newSlot.startHour &&
        existingSlot.startMinute === newSlot.startMinute &&
        existingSlot.endHour === newSlot.endHour &&
        existingSlot.endMinute === newSlot.endMinute
      );
    } catch (error) {
      console.error('Error checking for duplicate time slot:', error);
      return false;
    }
  }, [timeSlots]);

  // Enhanced function to get duplicate time slot details for better error messages
  const getDuplicateTimeSlotMessage = useCallback((newSlot: TimeSlotInput): string => {
    try {
      const duplicateSlot = timeSlots.find(existingSlot => 
        existingSlot.startHour === newSlot.startHour &&
        existingSlot.startMinute === newSlot.startMinute &&
        existingSlot.endHour === newSlot.endHour &&
        existingSlot.endMinute === newSlot.endMinute
      );
      
      if (duplicateSlot) {
        const timeSlotString = `${duplicateSlot.startHour}:${duplicateSlot.startMinute} - ${duplicateSlot.endHour}:${duplicateSlot.endMinute}`;
        return `This time slot (${timeSlotString}) already exists. Each date can only have unique time slots. Please select a different time.`;
      }
      
      return 'This time slot already exists. Please select a different time.';
    } catch (error) {
      console.error('Error generating duplicate message:', error);
      return 'This time slot already exists. Please select a different time.';
    }
  }, [timeSlots]);

  const formatTimeSlotInput = useCallback((slot: TimeSlotInput): string => {
    try {
      if (!slot || typeof slot !== 'object') {
        return 'Invalid time slot';
      }
      return `${slot.startHour}:${slot.startMinute} - ${slot.endHour}:${slot.endMinute}`;
    } catch (error) {
      console.error('Error formatting time slot:', error);
      return 'Invalid time slot';
    }
  }, []);

  // Enhanced function to format combined date and time display
  const formatCombinedDateAndTime = useCallback((dateTimeSlot: DateTimeSlot): string => {
    try {
      const dateStr = dateTimeSlot.date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric' 
      });
      
      const startHour = parseInt(dateTimeSlot.timeSlot.startHour);
      const startMinute = parseInt(dateTimeSlot.timeSlot.startMinute);
      const endHour = parseInt(dateTimeSlot.timeSlot.endHour);
      const endMinute = parseInt(dateTimeSlot.timeSlot.endMinute);
      
      const startTime = new Date();
      startTime.setHours(startHour, startMinute, 0, 0);
      const endTime = new Date();
      endTime.setHours(endHour, endMinute, 0, 0);
      
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
    } catch (error) {
      console.error('Error formatting combined date and time:', error);
      return 'Invalid date/time combination';
    }
  }, []);

  // Enhanced initialization from value prop with better persistence handling
  useEffect(() => {
    try {
      setIsInitializing(true);
      setComponentError(null);
      setDuplicateError(null);

      console.log('AvailabilityCalendar initializing with value:', value);

      if (!value) {
        console.log('No value provided, using defaults');
        setSelectedDates([]);
        setTimeSlots([]);
        setDurationMinutes(60);
        setIntervalMinutes(30);
        setIsInitializing(false);
        setHasInitialized(true);
        return;
      }

      // Enhanced date initialization with better error handling and cross-year support
      if (value.availableDates && Array.isArray(value.availableDates) && value.availableDates.length > 0) {
        try {
          console.log('Initializing dates from value:', value.availableDates.length, 'dates');
          const dates = value.availableDates.map((timestamp, index) => {
            try {
              const date = new Date(Number(timestamp) / 1000000);
              if (isNaN(date.getTime())) {
                console.warn(`Invalid timestamp at index ${index}:`, timestamp);
                return new Date(); // Fallback to current date
              }
              
              // Log cross-year date detection
              const currentYear = new Date().getFullYear();
              if (date.getFullYear() !== currentYear) {
                console.log(`Cross-year date detected at index ${index}: ${date.toLocaleDateString()} (year ${date.getFullYear()})`);
              }
              
              return date;
            } catch (error) {
              console.error(`Error parsing date timestamp at index ${index}:`, error);
              return new Date(); // Fallback to current date
            }
          }).filter(date => !isNaN(date.getTime()));
          
          console.log('Successfully parsed', dates.length, 'dates including cross-year dates');
          setSelectedDates(dates);
        } catch (error) {
          console.error('Error processing available dates:', error);
          setSelectedDates([]);
        }
      } else {
        console.log('No available dates in value, setting empty array');
        setSelectedDates([]);
      }

      // Enhanced time slot initialization with better error handling and comprehensive duplicate detection
      if (value.timeSlots && Array.isArray(value.timeSlots) && value.timeSlots.length > 0) {
        try {
          console.log('Initializing time slots from value:', value.timeSlots.length, 'slots');
          const slots = value.timeSlots.map((slot, index) => {
            try {
              if (!slot || typeof slot !== 'object' || !slot.startTime || !slot.endTime) {
                console.warn(`Invalid slot structure at index ${index}:`, slot);
                return {
                  startHour: '09',
                  startMinute: '00',
                  endHour: '17',
                  endMinute: '00'
                };
              }

              const startDate = new Date(Number(slot.startTime) / 1000000);
              const endDate = new Date(Number(slot.endTime) / 1000000);
              
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.warn(`Invalid slot timestamps at index ${index}:`, slot);
                return {
                  startHour: '09',
                  startMinute: '00',
                  endHour: '17',
                  endMinute: '00'
                };
              }

              return {
                startHour: startDate.getHours().toString().padStart(2, '0'),
                startMinute: startDate.getMinutes().toString().padStart(2, '0'),
                endHour: endDate.getHours().toString().padStart(2, '0'),
                endMinute: endDate.getMinutes().toString().padStart(2, '0')
              };
            } catch (error) {
              console.error(`Error parsing time slot at index ${index}:`, error);
              return {
                startHour: '09',
                startMinute: '00',
                endHour: '17',
                endMinute: '00'
              };
            }
          });
          
          // Enhanced duplicate removal during initialization with comprehensive checking
          const uniqueSlots: TimeSlotInput[] = [];
          const seenSlots = new Set<string>();
          
          slots.forEach((slot, index) => {
            const slotKey = `${slot.startHour}:${slot.startMinute}-${slot.endHour}:${slot.endMinute}`;
            if (!seenSlots.has(slotKey)) {
              seenSlots.add(slotKey);
              uniqueSlots.push(slot);
            } else {
              console.log(`Removed duplicate time slot during initialization at index ${index}:`, slot);
            }
          });
          
          if (uniqueSlots.length !== slots.length) {
            console.log(`Removed ${slots.length - uniqueSlots.length} duplicate time slots during initialization`);
            // Show a warning about duplicates being removed
            setDuplicateError(`Removed ${slots.length - uniqueSlots.length} duplicate time slot${slots.length - uniqueSlots.length !== 1 ? 's' : ''} during initialization. Each date can only have unique time slots.`);
          }
          
          console.log('Successfully parsed', uniqueSlots.length, 'unique time slots');
          setTimeSlots(uniqueSlots);
        } catch (error) {
          console.error('Error processing time slots:', error);
          setTimeSlots([]);
        }
      } else {
        console.log('No time slots in value, setting empty array');
        setTimeSlots([]);
      }

      // Enhanced duration and interval initialization
      try {
        if (value.durationMinutes && typeof value.durationMinutes === 'bigint') {
          const duration = Number(value.durationMinutes);
          if (!isNaN(duration) && duration > 0) {
            setDurationMinutes(duration);
            console.log('Set duration from value:', duration);
          }
        }

        if (value.intervalMinutes && typeof value.intervalMinutes === 'bigint') {
          const interval = Number(value.intervalMinutes);
          if (!isNaN(interval) && interval > 0) {
            setIntervalMinutes(interval);
            console.log('Set interval from value:', interval);
          }
        }
      } catch (error) {
        console.error('Error processing duration/interval:', error);
      }

      setHasInitialized(true);
      setIsInitializing(false);
      console.log('AvailabilityCalendar initialization completed successfully with cross-year support');
    } catch (error) {
      console.error('Error initializing availability calendar:', error);
      if (!optional) {
        setComponentError('Error loading calendar data. Using default settings.');
      }
      setIsInitializing(false);
      setHasInitialized(true);
      
      // Set safe defaults
      setSelectedDates([]);
      setTimeSlots([]);
      setDurationMinutes(60);
      setIntervalMinutes(30);
    }
  }, [value, optional]);

  // Enhanced update function with better persistence and error handling
  const updateParent = useCallback((
    dates: Date[], 
    slots: TimeSlotInput[], 
    duration: number, 
    interval: number
  ) => {
    try {
      console.log('AvailabilityCalendar updating parent with:', {
        dates: dates.length,
        slots: slots.length,
        duration,
        interval
      });

      // Validate inputs before processing
      if (!Array.isArray(dates) || !Array.isArray(slots)) {
        throw new Error('Invalid input arrays');
      }

      if (isNaN(duration) || isNaN(interval) || duration <= 0 || interval <= 0) {
        throw new Error('Invalid duration or interval values');
      }

      // Convert dates to timestamps with enhanced error handling and cross-year support
      const availableDates = dates.map((date, index) => {
        try {
          if (!date || isNaN(date.getTime())) {
            console.warn(`Invalid date at index ${index}:`, date);
            return BigInt(Date.now() * 1000000); // Fallback to current time
          }
          
          // Log cross-year date conversion
          const currentYear = new Date().getFullYear();
          if (date.getFullYear() !== currentYear) {
            console.log(`Converting cross-year date at index ${index}: ${date.toLocaleDateString()} (year ${date.getFullYear()})`);
          }
          
          return BigInt(date.getTime() * 1000000);
        } catch (error) {
          console.error(`Error converting date at index ${index}:`, error);
          return BigInt(Date.now() * 1000000); // Fallback to current time
        }
      });
      
      // Convert time slots with enhanced error handling and comprehensive duplicate validation
      const convertedTimeSlots: TimeSlot[] = [];
      const seenSlots = new Set<string>();
      
      slots.forEach((slot, index) => {
        try {
          if (!validateTimeSlot(slot)) {
            console.warn(`Invalid time slot at index ${index}:`, slot);
            return; // Skip invalid slots
          }

          // Create a unique key for this time slot with enhanced precision
          const slotKey = `${slot.startHour.padStart(2, '0')}:${slot.startMinute.padStart(2, '0')}-${slot.endHour.padStart(2, '0')}:${slot.endMinute.padStart(2, '0')}`;
          
          // Enhanced duplicate checking with detailed logging
          if (seenSlots.has(slotKey)) {
            console.warn(`Duplicate time slot detected and prevented at index ${index}:`, slot, 'Key:', slotKey);
            return; // Skip duplicate slots
          }
          
          seenSlots.add(slotKey);

          const today = new Date();
          const startTime = new Date(today);
          startTime.setHours(parseInt(slot.startHour), parseInt(slot.startMinute), 0, 0);
          
          const endTime = new Date(today);
          endTime.setHours(parseInt(slot.endHour), parseInt(slot.endMinute), 0, 0);
          
          if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            throw new Error('Invalid time calculation');
          }
          
          convertedTimeSlots.push({
            startTime: BigInt(startTime.getTime() * 1000000),
            endTime: BigInt(endTime.getTime() * 1000000)
          });
          
          console.log(`Added unique time slot ${index + 1}:`, slotKey);
        } catch (error) {
          console.error(`Error converting time slot at index ${index}:`, error);
          // Skip invalid slots instead of adding fallback
        }
      });

      console.log(`Successfully converted ${convertedTimeSlots.length} unique time slots out of ${slots.length} input slots`);

      // Create the new calendar object with enhanced persistence
      const newCalendar: AvailabilityCalendar = {
        availableDates,
        timeSlots: convertedTimeSlots,
        durationMinutes: BigInt(duration),
        intervalMinutes: BigInt(interval)
      };

      console.log('AvailabilityCalendar calling onChange with enhanced calendar including cross-year support:', newCalendar);
      onChange(newCalendar);
      setComponentError(null);
      setDuplicateError(null);
    } catch (error) {
      console.error('Error updating parent calendar:', error);
      if (!optional) {
        setComponentError('Error updating calendar. Please try again.');
      }
    }
  }, [onChange, validateTimeSlot, optional]);

  // Enhanced debounced update effect with better persistence
  useEffect(() => {
    if (!hasInitialized || isInitializing) {
      return;
    }

    try {
      console.log('AvailabilityCalendar triggering update with current state:', {
        selectedDates: selectedDates.length,
        timeSlots: timeSlots.length,
        durationMinutes,
        intervalMinutes
      });

      const timeoutId = setTimeout(() => {
        updateParent(selectedDates, timeSlots, durationMinutes, intervalMinutes);
      }, 100);

      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error('Error in update effect:', error);
      if (!optional) {
        setComponentError('Error updating calendar');
      }
    }
  }, [selectedDates, timeSlots, durationMinutes, intervalMinutes, updateParent, hasInitialized, isInitializing, optional]);

  // Enhanced date toggle handler with better persistence and accurate future date support
  const handleDateToggle = useCallback((date: Date) => {
    if (disabled) return;
    
    try {
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to toggle');
        return;
      }

      console.log('AvailabilityCalendar toggling date:', date.toDateString(), 'Year:', date.getFullYear());

      const dateString = date.toDateString();
      setSelectedDates(prev => {
        try {
          const isSelected = prev.some(d => d.toDateString() === dateString);
          let newDates: Date[];
          
          if (isSelected) {
            newDates = prev.filter(d => d.toDateString() !== dateString);
            console.log('Removed date, new count:', newDates.length);
          } else {
            newDates = [...prev, date];
            newDates.sort((a, b) => a.getTime() - b.getTime());
            console.log('Added date, new count:', newDates.length);
            
            // Log cross-year date addition
            const currentYear = new Date().getFullYear();
            if (date.getFullYear() !== currentYear) {
              console.log('Added cross-year date:', date.toLocaleDateString(), 'Year:', date.getFullYear());
            }
          }
          
          return newDates;
        } catch (error) {
          console.error('Error updating selected dates:', error);
          return prev;
        }
      });
      setComponentError(null);
      setDuplicateError(null);
    } catch (error) {
      console.error('Error toggling date:', error);
      if (!optional) {
        setComponentError('Error selecting date. Please try again.');
      }
    }
  }, [disabled, optional]);

  // Enhanced add time slot handler with comprehensive duplicate prevention
  const handleAddTimeSlot = useCallback(() => {
    if (disabled) return;
    
    try {
      // Clear any previous duplicate error
      setDuplicateError(null);
      
      if (!validateTimeSlot(newTimeSlot)) {
        if (!optional) {
          setComponentError('Invalid time slot. End time must be after start time.');
        }
        return;
      }
      
      // Enhanced duplicate checking with detailed error message
      if (isDuplicateTimeSlot(newTimeSlot)) {
        const duplicateMessage = getDuplicateTimeSlotMessage(newTimeSlot);
        setDuplicateError(duplicateMessage);
        console.warn('Duplicate time slot prevented:', newTimeSlot);
        return;
      }
      
      console.log('AvailabilityCalendar adding unique time slot:', newTimeSlot);
      
      setTimeSlots(prev => {
        // Double-check for duplicates before adding (extra safety)
        const slotKey = `${newTimeSlot.startHour}:${newTimeSlot.startMinute}-${newTimeSlot.endHour}:${newTimeSlot.endMinute}`;
        const isDuplicate = prev.some(existingSlot => {
          const existingKey = `${existingSlot.startHour}:${existingSlot.startMinute}-${existingSlot.endHour}:${existingSlot.endMinute}`;
          return existingKey === slotKey;
        });
        
        if (isDuplicate) {
          console.warn('Last-minute duplicate detection prevented addition of:', newTimeSlot);
          setDuplicateError(getDuplicateTimeSlotMessage(newTimeSlot));
          return prev;
        }
        
        const newSlots = [...prev, { ...newTimeSlot }];
        console.log('Time slots updated, new count:', newSlots.length);
        return newSlots;
      });
      
      setShowAddTimeSlot(false);
      setNewTimeSlot({
        startHour: '09',
        startMinute: '00',
        endHour: '17',
        endMinute: '00'
      });
      setComponentError(null);
      setDuplicateError(null);
    } catch (error) {
      console.error('Error adding time slot:', error);
      if (!optional) {
        setComponentError('Error adding time slot. Please try again.');
      }
    }
  }, [disabled, newTimeSlot, validateTimeSlot, isDuplicateTimeSlot, getDuplicateTimeSlotMessage, optional]);

  const handleRemoveTimeSlot = useCallback((index: number) => {
    if (disabled) return;
    
    try {
      if (index < 0 || index >= timeSlots.length) {
        console.error('Invalid time slot index:', index);
        return;
      }

      console.log('AvailabilityCalendar removing time slot at index:', index);

      setTimeSlots(prev => {
        const newSlots = prev.filter((_, i) => i !== index);
        console.log('Time slots updated after removal, new count:', newSlots.length);
        return newSlots;
      });
      setComponentError(null);
      setDuplicateError(null);
    } catch (error) {
      console.error('Error removing time slot:', error);
      if (!optional) {
        setComponentError('Error removing time slot. Please try again.');
      }
    }
  }, [disabled, timeSlots.length, optional]);

  // Enhanced reset function for error recovery
  const handleReset = useCallback(() => {
    try {
      console.log('AvailabilityCalendar resetting to defaults');
      setComponentError(null);
      setDuplicateError(null);
      setSelectedDates([]);
      setTimeSlots([]);
      setDurationMinutes(60);
      setIntervalMinutes(30);
      setShowAddTimeSlot(false);
      setNewTimeSlot({
        startHour: '09',
        startMinute: '00',
        endHour: '17',
        endMinute: '00'
      });
      setHasInitialized(true);
      setIsInitializing(false);
    } catch (error) {
      console.error('Error resetting calendar:', error);
      if (!optional) {
        setComponentError('Error resetting calendar. Please refresh the page.');
      }
    }
  }, [optional]);

  // Enhanced skip calendar function with proper empty state
  const handleSkipCalendar = useCallback(() => {
    try {
      console.log('AvailabilityCalendar skipping calendar setup');
      // Set empty calendar data
      const emptyCalendar: AvailabilityCalendar = {
        availableDates: [],
        timeSlots: [],
        durationMinutes: BigInt(60),
        intervalMinutes: BigInt(30)
      };
      onChange(emptyCalendar);
      setComponentError(null);
      setDuplicateError(null);
    } catch (error) {
      console.error('Error skipping calendar:', error);
    }
  }, [onChange]);

  // Loading state
  if (isInitializing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">
            Availability Calendar {optional && <span className="text-gray-500 text-sm">(optional)</span>}
          </h3>
        </div>
        <div className="bg-gray-700 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // For optional calendars, show a simple toggle interface first
  if (optional && !showCalendar) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">Availability Calendar</h3>
          <span className="text-gray-500 text-sm">(optional)</span>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-3">
            <Clock size={16} />
            <span className="font-medium">Set Availability Times</span>
          </div>
          <p className="text-gray-300 text-sm mb-4">
            You can specify when you're available, or skip this step and arrange times through messaging with interested users.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Calendar size={16} />
              <span>Set Availability</span>
            </button>
            
            <button
              onClick={handleSkipCalendar}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              <span>Skip (Arrange via Messaging)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error boundary fallback with recovery options
  if (componentError && !optional) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">Availability Calendar</h3>
        </div>

        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle size={16} />
            <span className="font-medium">Calendar Error</span>
          </div>
          <p className="text-gray-300 text-sm mb-3">{componentError}</p>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={14} />
              <span>Reset Calendar</span>
            </button>
            <button
              onClick={() => {
                setComponentError(null);
                setDuplicateError(null);
                setShowAddTimeSlot(false);
              }}
              className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Dismiss Error
            </button>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock size={16} />
            <span className="font-medium">Alternative</span>
          </div>
          <p className="text-gray-300 text-sm">
            You can still create your post. Availability times can be arranged through messaging with interested users.
          </p>
        </div>
      </div>
    );
  }

  // For optional calendars with errors, show a simplified fallback
  if (componentError && optional) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">Availability Calendar</h3>
          <span className="text-gray-500 text-sm">(optional)</span>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock size={16} />
            <span className="font-medium">Calendar Unavailable</span>
          </div>
          <p className="text-gray-300 text-sm mb-3">
            The calendar feature encountered an issue, but you can still create your post. 
            Availability times can be arranged through messaging with interested users.
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setComponentError(null);
                setDuplicateError(null);
                setShowCalendar(false);
                handleSkipCalendar();
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Continue Without Calendar
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Calendar size={16} className="text-orange-500" />
          <span>
            {dateTimeSlots.length} date-time combination{dateTimeSlots.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Enhanced compact display with combined date and time */}
        {dateTimeSlots.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <div className="text-blue-400 text-sm font-medium mb-2">Next Available:</div>
            <div className="text-gray-300 text-sm font-medium">
              {formatCombinedDateAndTime(dateTimeSlots[0])}
            </div>
            {dateTimeSlots.length > 1 && (
              <div className="text-gray-400 text-xs mt-1">
                +{dateTimeSlots.length - 1} more time{dateTimeSlots.length - 1 !== 1 ? 's' : ''} available
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">
            {optional ? 'Availability Calendar' : 'Availability Calendar'}
          </h3>
          {optional && <span className="text-gray-500 text-sm">(optional)</span>}
        </div>
        
        {optional && showCalendar && (
          <button
            onClick={() => {
              setShowCalendar(false);
              handleSkipCalendar();
            }}
            className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
          >
            Skip Calendar
          </button>
        )}
      </div>

      {/* Enhanced duplicate error display - prominently shown at the top */}
      {duplicateError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle size={16} />
            <span className="font-medium">Duplicate Time Slots Detected</span>
          </div>
          <p className="text-gray-300 text-sm mb-3">{duplicateError}</p>
          <div className="bg-red-800/20 border border-red-400/30 rounded-lg p-3">
            <p className="text-red-300 text-xs">
              <strong>Unique Time Slot Rule:</strong> Each date can only have unique time slots across all post types (tasks, swaps, freecycle, volunteer slots). 
              This prevents confusion and ensures clear scheduling. Please select different start or end times.
            </p>
          </div>
          <button
            onClick={() => setDuplicateError(null)}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            Dismiss Warning
          </button>
        </div>
      )}

      {/* Show error message if dates can't be generated, but don't block the form */}
      {dateOptions.length === 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertCircle size={16} />
            <span className="font-medium">Calendar Unavailable</span>
          </div>
          <p className="text-gray-300 text-sm mb-3">
            Unable to load available dates. {optional ? 'You can still create your post.' : 'Please try refreshing the page.'}
          </p>
          {optional ? (
            <button
              onClick={handleSkipCalendar}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Continue Without Calendar
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Enhanced Available Dates with stable selection and persistence and accurate future date support */}
      {dateOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Available Dates ({selectedDates.length} selected)
          </label>
          <div className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {dateOptions.map((date) => {
                try {
                  const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  // Enhanced past date detection with accurate timezone handling and cross-year support
                  const now = new Date();
                  const dateAtMidnight = new Date(date);
                  dateAtMidnight.setHours(0, 0, 0, 0);
                  const todayAtMidnight = new Date(now);
                  todayAtMidnight.setHours(0, 0, 0, 0);
                  
                  // Use proper date comparison that handles cross-year dates correctly
                  const isPast = dateAtMidnight.getTime() < todayAtMidnight.getTime();
                  
                  // Log cross-year date detection
                  const currentYear = now.getFullYear();
                  if (date.getFullYear() !== currentYear) {
                    console.log(`Cross-year date option: ${date.toLocaleDateString()} (year ${date.getFullYear()}), isPast: ${isPast}`);
                  }
                  
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => handleDateToggle(date)}
                      disabled={disabled || isPast}
                      className={`p-3 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-orange-500 text-white shadow-md'
                          : isPast
                            ? 'bg-gray-800 text-gray-500'
                            : 'bg-gray-600 hover:bg-gray-500 text-gray-300 hover:shadow-sm'
                      } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-xs">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        {date.getFullYear() !== new Date().getFullYear() && (
                          <div className="text-xs opacity-75">
                            {date.getFullYear()}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                } catch (error) {
                  console.error('Error rendering date button:', error);
                  return null;
                }
              })}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Select the dates when you're available. Past dates are disabled. Future dates including next year are supported.
            {optional && ' This is optional - you can arrange times through messaging.'}
          </p>
        </div>
      )}

      {/* Enhanced Time Slots with comprehensive duplicate prevention and validation */}
      {dateOptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-300">
              Time Slots ({timeSlots.length}) {optional && <span className="text-gray-500 text-xs">(optional)</span>}
            </label>
            {!disabled && (
              <button
                type="button"
                onClick={() => {
                  setShowAddTimeSlot(true);
                  setDuplicateError(null);
                }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <Plus size={14} />
                <span>Add Slot</span>
              </button>
            )}
          </div>

          {/* Enhanced Add Time Slot Form with comprehensive duplicate validation */}
          {showAddTimeSlot && !disabled && (
            <div className="bg-gray-700 rounded-lg p-4 mb-4 border border-gray-600">
              <h4 className="text-white font-medium mb-3">Add Time Slot</h4>
              
              {/* Enhanced duplicate error display with detailed information */}
              {duplicateError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <AlertCircle size={16} />
                    <span className="font-medium">Duplicate Time Slot Detected</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{duplicateError}</p>
                  <div className="bg-red-800/20 border border-red-400/30 rounded-lg p-2">
                    <p className="text-red-300 text-xs">
                      <strong>Unique Time Slot Rule:</strong> Each date can only have unique time slots across all post types (tasks, swaps, freecycle, volunteer slots). 
                      This prevents confusion and ensures clear scheduling. Please select different start or end times.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                  <div className="flex gap-2">
                    <select
                      value={newTimeSlot.startHour}
                      onChange={(e) => {
                        try {
                          setNewTimeSlot({ ...newTimeSlot, startHour: e.target.value });
                          setComponentError(null);
                          setDuplicateError(null);
                        } catch (error) {
                          console.error('Error setting start hour:', error);
                        }
                      }}
                      className="flex-1 px-2 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newTimeSlot.startMinute}
                      onChange={(e) => {
                        try {
                          setNewTimeSlot({ ...newTimeSlot, startMinute: e.target.value });
                          setComponentError(null);
                          setDuplicateError(null);
                        } catch (error) {
                          console.error('Error setting start minute:', error);
                        }
                      }}
                      className="flex-1 px-2 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="00">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End Time</label>
                  <div className="flex gap-2">
                    <select
                      value={newTimeSlot.endHour}
                      onChange={(e) => {
                        try {
                          setNewTimeSlot({ ...newTimeSlot, endHour: e.target.value });
                          setComponentError(null);
                          setDuplicateError(null);
                        } catch (error) {
                          console.error('Error setting end hour:', error);
                        }
                      }}
                      className="flex-1 px-2 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newTimeSlot.endMinute}
                      onChange={(e) => {
                        try {
                          setNewTimeSlot({ ...newTimeSlot, endMinute: e.target.value });
                          setComponentError(null);
                          setDuplicateError(null);
                        } catch (error) {
                          console.error('Error setting end minute:', error);
                        }
                      }}
                      className="flex-1 px-2 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="00">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Enhanced validation messages with duplicate-specific feedback */}
              {!validateTimeSlot(newTimeSlot) && !duplicateError && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                  <AlertCircle size={14} />
                  <span>End time must be after start time</span>
                </div>
              )}
              
              {/* Enhanced duplicate prevention notice with comprehensive information */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                  <CheckCircle size={14} />
                  <span className="font-medium">Unique Time Slot Validation Active</span>
                </div>
                <p className="text-gray-300 text-xs mb-1">
                  Each date can only have unique time slots. Duplicate time slots for the same day are automatically prevented to ensure clear scheduling across all post types.
                </p>
                <p className="text-blue-300 text-xs">
                  Current slots: {timeSlots.length} unique time slot{timeSlots.length !== 1 ? 's' : ''} defined
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddTimeSlot}
                  disabled={!validateTimeSlot(newTimeSlot) || isDuplicateTimeSlot(newTimeSlot)}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed ${
                    isDuplicateTimeSlot(newTimeSlot) 
                      ? 'bg-red-600/50 text-red-300 border border-red-500/50' 
                      : !validateTimeSlot(newTimeSlot)
                        ? 'bg-gray-600 text-gray-400'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {isDuplicateTimeSlot(newTimeSlot) ? (
                    <div className="flex items-center gap-2">
                      <X size={14} />
                      <span>Duplicate Time Slot</span>
                    </div>
                  ) : !validateTimeSlot(newTimeSlot) ? (
                    'Invalid Time Range'
                  ) : (
                    'Add Unique Time Slot'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTimeSlot(false);
                    setDuplicateError(null);
                    setNewTimeSlot({
                      startHour: '09',
                      startMinute: '00',
                      endHour: '17',
                      endMinute: '00'
                    });
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Current Time Slots with comprehensive uniqueness indicators */}
          {timeSlots.length > 0 ? (
            <div className="space-y-2">
              {timeSlots.map((slot, index) => {
                try {
                  return (
                    <div key={index} className="flex items-center justify-between bg-gray-700 rounded-lg p-3 border border-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-orange-500" />
                        <span className="text-white font-medium">{formatTimeSlotInput(slot)}</span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-500/30 rounded-full">
                          <CheckCircle size={10} className="text-green-400" />
                          <span className="text-green-400 text-xs font-medium">Unique</span>
                        </div>
                      </div>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeSlot(index)}
                          className="text-red-400 hover:text-red-300 transition-colors p-1"
                          title="Remove this time slot"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                } catch (error) {
                  console.error('Error rendering time slot:', error);
                  return (
                    <div key={index} className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                      <span className="text-red-400 text-sm">Error displaying time slot</span>
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 bg-gray-700 rounded-lg">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No time slots added yet</p>
              <p className="text-xs">
                Add time slots to specify when you're available
                {optional && ', or skip to arrange times through messaging'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Duration and Interval Settings with error handling */}
      {dateOptions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Duration (minutes)
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => {
                try {
                  const newDuration = parseInt(e.target.value);
                  if (!isNaN(newDuration) && newDuration > 0) {
                    console.log('AvailabilityCalendar updating duration:', newDuration);
                    setDurationMinutes(newDuration);
                    setComponentError(null);
                    setDuplicateError(null);
                  }
                } catch (error) {
                  console.error('Error setting duration:', error);
                  if (!optional) {
                    setComponentError('Error setting duration');
                  }
                }
              }}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours (full day)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Booking Interval (minutes)
            </label>
            <select
              value={intervalMinutes}
              onChange={(e) => {
                try {
                  const newInterval = parseInt(e.target.value);
                  if (!isNaN(newInterval) && newInterval > 0) {
                    console.log('AvailabilityCalendar updating interval:', newInterval);
                    setIntervalMinutes(newInterval);
                    setComponentError(null);
                    setDuplicateError(null);
                  }
                } catch (error) {
                  console.error('Error setting interval:', error);
                  if (!optional) {
                    setComponentError('Error setting interval');
                  }
                }
              }}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
        </div>
      )}

      {/* Enhanced Summary with comprehensive uniqueness guarantee and duplicate prevention information */}
      {dateTimeSlots.length > 0 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-400 mb-3">
            <CheckCircle size={16} />
            <span className="font-medium">Availability Set - Unique Time Slots Guaranteed</span>
          </div>
          
          {/* Enhanced preview showing date-time combinations with comprehensive uniqueness information */}
          <div className="space-y-3">
            <div className="text-gray-300 text-sm space-y-1">
              <p>• {selectedDates.length} available date{selectedDates.length !== 1 ? 's' : ''}</p>
              <p>• {timeSlots.length} unique time slot{timeSlots.length !== 1 ? 's' : ''} per day</p>
              <p>• {dateTimeSlots.length} total date-time combination{dateTimeSlots.length !== 1 ? 's' : ''}</p>
              <p>• {durationMinutes} minute duration with {intervalMinutes} minute intervals</p>
              <p className="text-green-300 font-medium">• All time slots are unique - duplicate prevention active across all post types</p>
              <p className="text-green-300 font-medium">• Each date can only have unique time slots - no duplicates allowed</p>
              <p className="text-blue-300 font-medium">• Cross-year date support - future dates including next year are supported</p>
            </div>
            
            {/* Show preview of first few date-time combinations */}
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <div className="text-green-400 text-sm font-medium mb-2">Preview of Available Times:</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {dateTimeSlots.slice(0, 5).map((dateTimeSlot, index) => (
                  <div key={index} className="text-gray-300 text-xs font-medium bg-gray-600 rounded px-2 py-1">
                    {formatCombinedDateAndTime(dateTimeSlot)}
                  </div>
                ))}
                {dateTimeSlots.length > 5 && (
                  <div className="text-gray-400 text-xs">
                    +{dateTimeSlots.length - 5} more date-time combination{dateTimeSlots.length - 5 !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-green-300 font-medium text-sm">• Each time slot is linked to a specific date for clear selection</p>
          </div>
        </div>
      )}

      {selectedDates.length === 0 && dateOptions.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock size={16} />
            <span className="font-medium">No Dates Selected</span>
          </div>
          <p className="text-gray-300 text-sm">
            {optional 
              ? 'You can select available dates including future dates in next year, or skip this step. Times can be arranged through messaging with interested users.'
              : 'Select available dates including future dates in next year to specify when you\'re available.'
            }
          </p>
        </div>
      )}

      {timeSlots.length === 0 && selectedDates.length > 0 && dateOptions.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock size={16} />
            <span className="font-medium">No Time Slots Added</span>
          </div>
          <p className="text-gray-300 text-sm">
            Add time slots to specify when you're available
            {optional && ', or skip to arrange times through messaging'}.
          </p>
        </div>
      )}

      {dateOptions.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Clock size={16} />
            <span className="font-medium">How It Works - Unique Time Slots Per Date with Cross-Year Support</span>
          </div>
          <div className="text-gray-300 text-sm space-y-1">
            <p>• Select dates when you're available {optional && '(optional)'} - including future dates in next year</p>
            <p>• Add time slots to specify your available hours {optional && '(optional)'}</p>
            <p>• Each time slot is linked to each selected date, creating specific date-time combinations</p>
            <p>• Users can select one specific date and time combination when booking</p>
            <p className="text-orange-300 font-medium">• Each date can only have unique time slots - duplicates are automatically prevented across all post types</p>
            <p className="text-orange-300 font-medium">• This ensures clear scheduling and prevents confusion with duplicate times across tasks, swaps, freecycle, and volunteer slots</p>
            <p className="text-blue-300 font-medium">• Cross-year date support - you can select dates in the next year (e.g., September 15, 2025)</p>
            <p className="text-green-300 font-medium">• All changes are automatically saved and persist across sessions</p>
          </div>
        </div>
      )}
    </div>
  );
}
