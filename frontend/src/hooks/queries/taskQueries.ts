import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { useInternetIdentity } from '../useInternetIdentity';
import { Task, Reaction, Comment, AvailabilityCalendar, TimeSlot, Offer } from '../../backend';
import { Principal } from '@dfinity/principal';

// Optimized query options
const defaultQueryOptions = {
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 15000),
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
};

// Real-time availability data interface
export interface RealTimeAvailabilityData {
  availableSlots: TimeSlot[];
  bookedSlots: TimeSlot[];
  slotAvailability: TimeSlotAvailability[];
  lastUpdated: number;
}

// Time slot booking status interface based on approved offers
export interface TimeSlotBookingStatus {
  timeSlot: TimeSlot;
  isBooked: boolean;
  bookedBy?: Principal;
  bookingType: 'offer';
  bookingId: string;
  bookingTimestamp: bigint;
}

// Client-side booking validation interface
export interface TimeSlotAvailability {
  timeSlot: TimeSlot;
  isAvailable: boolean;
  isBooked: boolean;
  isPast: boolean;
  bookedBy?: Principal;
  reason?: 'available' | 'booked' | 'past';
}

// Client-side booking validation result
export interface BookingValidationResult {
  isValid: boolean;
  errorMessage?: string;
  availableAlternatives?: TimeSlot[];
}

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + 
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * 
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Helper function to check if a time slot is in the past
function isTimeSlotInPast(timeSlot: TimeSlot): boolean {
  const slotStartTime = new Date(Number(timeSlot.startTime) / 1000000);
  const now = new Date();
  return slotStartTime < now;
}

// Client-side validation for time slot availability based on approved offers
export function validateTimeSlotAvailability(
  taskId: string, 
  timeSlot: TimeSlot, 
  availabilityCalendar: AvailabilityCalendar,
  approvedOffers: Offer[] = []
): BookingValidationResult {
  try {
    // Check if time slot exists in availability calendar
    const slotExists = availabilityCalendar.timeSlots.some(slot => 
      Number(slot.startTime) === Number(timeSlot.startTime) &&
      Number(slot.endTime) === Number(timeSlot.endTime)
    );

    if (!slotExists) {
      return {
        isValid: false,
        errorMessage: 'Selected time slot is not available in the calendar.',
        availableAlternatives: availabilityCalendar.timeSlots.filter(slot => 
          !isTimeSlotBookedByOffers(slot, approvedOffers) && !isTimeSlotInPast(slot)
        )
      };
    }

    // Check if time slot is already booked by approved offers
    if (isTimeSlotBookedByOffers(timeSlot, approvedOffers)) {
      return {
        isValid: false,
        errorMessage: 'This time slot has already been booked by another user. Please select a different available time slot.',
        availableAlternatives: availabilityCalendar.timeSlots.filter(slot => 
          !isTimeSlotBookedByOffers(slot, approvedOffers) && !isTimeSlotInPast(slot)
        )
      };
    }

    // Check if time slot is in the past
    if (isTimeSlotInPast(timeSlot)) {
      return {
        isValid: false,
        errorMessage: 'Selected time slot is in the past. Please choose a future time slot.',
        availableAlternatives: availabilityCalendar.timeSlots.filter(slot => 
          !isTimeSlotInPast(slot) && !isTimeSlotBookedByOffers(slot, approvedOffers)
        )
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating time slot availability:', error);
    return {
      isValid: false,
      errorMessage: 'Error validating time slot availability. Please try again.'
    };
  }
}

// Helper function to check if a time slot is booked by approved offers
function isTimeSlotBookedByOffers(timeSlot: TimeSlot, approvedOffers: Offer[]): boolean {
  return approvedOffers.some(offer => 
    offer.selectedTimeSlot &&
    Number(offer.selectedTimeSlot.startTime) === Number(timeSlot.startTime) &&
    Number(offer.selectedTimeSlot.endTime) === Number(timeSlot.endTime)
  );
}

// Helper function to get time slot availability with client-side validation
function getTimeSlotAvailability(timeSlot: TimeSlot, approvedOffers: Offer[]): TimeSlotAvailability {
  const now = new Date();
  const slotStartTime = new Date(Number(timeSlot.startTime) / 1000000);
  const isPast = slotStartTime < now;
  
  const isBooked = isTimeSlotBookedByOffers(timeSlot, approvedOffers);
  const isAvailable = !isBooked && !isPast;
  
  let reason: 'available' | 'booked' | 'past';
  if (isPast) {
    reason = 'past';
  } else if (isBooked) {
    reason = 'booked';
  } else {
    reason = 'available';
  }

  return {
    timeSlot,
    isAvailable,
    isBooked,
    isPast,
    reason
  };
}

// Helper function to get available time slots only with client-side validation
export function getAvailableTimeSlots(availabilityCalendar: AvailabilityCalendar, approvedOffers: Offer[] = []): TimeSlot[] {
  return availabilityCalendar.timeSlots.filter(slot => {
    // Check if slot is not booked by approved offers
    if (isTimeSlotBookedByOffers(slot, approvedOffers)) {
      return false;
    }
    
    // Check if slot is not in the past
    if (isTimeSlotInPast(slot)) {
      return false;
    }
    
    return true;
  });
}

// Helper function to get unavailable time slots with reasons
export function getUnavailableTimeSlots(availabilityCalendar: AvailabilityCalendar, approvedOffers: Offer[] = []): Array<{
  timeSlot: TimeSlot;
  reason: 'booked' | 'past';
  bookedBy?: Principal;
}> {
  const unavailableSlots: Array<{
    timeSlot: TimeSlot;
    reason: 'booked' | 'past';
    bookedBy?: Principal;
  }> = [];

  availabilityCalendar.timeSlots.forEach(slot => {
    if (isTimeSlotInPast(slot)) {
      unavailableSlots.push({
        timeSlot: slot,
        reason: 'past'
      });
    } else if (isTimeSlotBookedByOffers(slot, approvedOffers)) {
      const bookingOffer = approvedOffers.find(offer => 
        offer.selectedTimeSlot &&
        Number(offer.selectedTimeSlot.startTime) === Number(slot.startTime) &&
        Number(offer.selectedTimeSlot.endTime) === Number(slot.endTime)
      );
      
      unavailableSlots.push({
        timeSlot: slot,
        reason: 'booked',
        bookedBy: bookingOffer?.tasker
      });
    }
  });

  return unavailableSlots;
}

// Helper function to get comprehensive time slot availability
export function getTimeSlotAvailabilityStatus(availabilityCalendar: AvailabilityCalendar, approvedOffers: Offer[] = []): TimeSlotAvailability[] {
  return availabilityCalendar.timeSlots.map(slot => getTimeSlotAvailability(slot, approvedOffers));
}

// Task hooks
export function useGetTasks() {
  const { actor, isFetching } = useActor();

  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTasks();
    },
    enabled: !!actor && !isFetching,
    ...defaultQueryOptions,
  });
}

export function useGetTasksWithinRadius(latitude?: number, longitude?: number, radiusKm?: number) {
  const { actor, isFetching } = useActor();

  return useQuery<Task[]>({
    queryKey: ['tasksWithinRadius', latitude, longitude, radiusKm],
    queryFn: async () => {
      if (!actor || latitude === undefined || longitude === undefined || radiusKm === undefined) {
        return [];
      }
      return actor.getTasksWithinRadius(latitude, longitude, radiusKm);
    },
    enabled: !!actor && !isFetching && latitude !== undefined && longitude !== undefined && radiusKm !== undefined,
    staleTime: 60000,
  });
}

export function useCreateTask() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createTask(task);
    },
    onSuccess: () => {
      const queriesToInvalidate = ['tasks', 'myCreatedTasks', 'tasksWithinRadius'];
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
  });
}

export function useUpdateTask() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createTask(task);
    },
    onSuccess: () => {
      const queriesToInvalidate = ['tasks', 'myCreatedTasks', 'myOfferedTasks', 'tasksWithinRadius'];
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
  });
}

export function useGetMyCreatedTasks() {
  const { actor, isFetching } = useActor();

  return useQuery<Task[]>({
    queryKey: ['myCreatedTasks'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMyCreatedTasks();
    },
    enabled: !!actor && !isFetching,
    ...defaultQueryOptions,
  });
}

export function useGetMyOfferedTasks() {
  const { actor, isFetching } = useActor();

  return useQuery<Task[]>({
    queryKey: ['myOfferedTasks'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMyOfferedTasks();
    },
    enabled: !!actor && !isFetching,
    ...defaultQueryOptions,
  });
}

export function useGetArchivedTasks() {
  const { actor, isFetching } = useActor();

  return useQuery<Task[]>({
    queryKey: ['archivedTasks'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getArchivedTasks();
    },
    enabled: !!actor && !isFetching,
    staleTime: 5 * 60 * 1000,
  });
}

// Archive task hooks
function createArchiveMutation(action: 'archive' | 'unarchive') {
  return function() {
    const { actor } = useActor();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (taskId: string) => {
        if (!actor) throw new Error('Actor not available');
        return action === 'archive' ? actor.archiveTask(taskId) : actor.unarchiveTask(taskId);
      },
      onSuccess: () => {
        const queriesToInvalidate = ['tasks', 'archivedTasks', 'myCreatedTasks', 'myOfferedTasks', 'messageThreads', 'tasksWithinRadius'];
        queriesToInvalidate.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      },
    });
  };
}

export const useArchiveTask = createArchiveMutation('archive');
export const useUnarchiveTask = createArchiveMutation('unarchive');

// Task reactions and comments
export function useGetTaskReactions(taskId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Reaction[]>({
    queryKey: ['taskReactions', taskId],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return actor.getReactionsForTask(taskId);
      } catch (error) {
        console.error('Failed to fetch reactions:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!taskId,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// Task reaction mutations
function createTaskReactionMutation(action: 'add' | 'remove') {
  return function() {
    const { actor } = useActor();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ taskId, emoji }: { taskId: string; emoji?: string }) => {
        if (!actor) throw new Error('Actor not available');
        return action === 'add' ? actor.addReaction(taskId, emoji!) : actor.removeReaction(taskId);
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['taskReactions', variables.taskId] });
        queryClient.refetchQueries({ queryKey: ['taskReactions', variables.taskId], type: 'active' });
        if (action === 'add') {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      },
    });
  };
}

export const useAddTaskReaction = createTaskReactionMutation('add');
export const useRemoveTaskReaction = createTaskReactionMutation('remove');

export function useGetTaskComments(taskId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Comment[]>({
    queryKey: ['taskComments', taskId],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCommentsForTask(taskId);
    },
    enabled: !!actor && !isFetching && !!taskId,
    staleTime: 30000,
  });
}

export function useAddTaskComment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, text }: { taskId: string; text: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addComment(taskId, text);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Enhanced hook to get real-time availability data from backend
export function useGetRealTimeAvailability(taskId: string, availabilityCalendar?: AvailabilityCalendar) {
  const { actor, isFetching } = useActor();

  return useQuery<RealTimeAvailabilityData>({
    queryKey: ['realTimeAvailability', taskId],
    queryFn: async () => {
      if (!actor || !availabilityCalendar) {
        return {
          availableSlots: [],
          bookedSlots: [],
          slotAvailability: [],
          lastUpdated: Date.now()
        };
      }

      try {
        // Always fetch fresh offers data to ensure we have the latest booking status
        console.log('Fetching latest offers data for real-time availability...');
        const freshOffers = await actor.getOffers();
        const approvedOffers = freshOffers.filter(o => o.taskId === taskId && o.status === 'approved');

        const availableSlots = getAvailableTimeSlots(availabilityCalendar, approvedOffers);
        const unavailableSlots = getUnavailableTimeSlots(availabilityCalendar, approvedOffers);
        const bookedSlots = unavailableSlots.filter(slot => slot.reason === 'booked').map(slot => slot.timeSlot);
        const slotAvailability = getTimeSlotAvailabilityStatus(availabilityCalendar, approvedOffers);

        console.log(`Real-time availability: ${availableSlots.length} available, ${bookedSlots.length} booked`);

        return {
          availableSlots,
          bookedSlots,
          slotAvailability,
          lastUpdated: Date.now()
        };
      } catch (error) {
        console.error('Failed to get real-time availability:', error);
        return {
          availableSlots: [],
          bookedSlots: [],
          slotAvailability: [],
          lastUpdated: Date.now()
        };
      }
    },
    enabled: !!actor && !isFetching && !!taskId && !!availabilityCalendar,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 1000, // Refresh every second for real-time updates
  });
}

// Hook to get time slot booking status based on approved offers
export function useGetTimeSlotBookingStatus(taskId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<TimeSlotBookingStatus[]>({
    queryKey: ['timeSlotBookings', taskId],
    queryFn: async () => {
      if (!actor || !taskId) return [];
      
      try {
        // Always fetch fresh offers data for real-time booking status
        console.log('Fetching fresh offers data for booking status...');
        const offers = await actor.getOffers();
        const approvedOffers = offers.filter(offer => offer.taskId === taskId && offer.status === 'approved');
        
        // Convert approved offers to booking status
        const bookingStatus: TimeSlotBookingStatus[] = approvedOffers
          .filter(offer => offer.selectedTimeSlot)
          .map(offer => ({
            timeSlot: offer.selectedTimeSlot!,
            isBooked: true,
            bookedBy: offer.tasker,
            bookingType: 'offer',
            bookingId: offer.id,
            bookingTimestamp: offer.createdAt
          }));
        
        console.log(`Found ${bookingStatus.length} booked time slots for task ${taskId}`);
        return bookingStatus;
      } catch (error) {
        console.error('Failed to get booking status:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!taskId,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 1000, // Refresh every second for real-time updates
  });
}

// Hook to validate time slot availability with backend data
export function useValidateTimeSlotAvailability(taskId: string, availabilityCalendar?: AvailabilityCalendar) {
  const { actor, isFetching } = useActor();

  return useQuery<{
    availableSlots: TimeSlot[];
    unavailableSlots: Array<{
      timeSlot: TimeSlot;
      reason: 'booked' | 'past';
      bookedBy?: Principal;
    }>;
    slotAvailability: TimeSlotAvailability[];
  }>({
    queryKey: ['timeSlotAvailability', taskId],
    queryFn: async () => {
      if (!availabilityCalendar || !actor) {
        return { 
          availableSlots: [], 
          unavailableSlots: [],
          slotAvailability: []
        };
      }

      try {
        // Always fetch fresh offers data for accurate availability
        console.log('Validating time slot availability with latest backend data...');
        const offers = await actor.getOffers();
        const approvedOffers = offers.filter(o => o.taskId === taskId && o.status === 'approved');

        const availableSlots = getAvailableTimeSlots(availabilityCalendar, approvedOffers);
        const unavailableSlots = getUnavailableTimeSlots(availabilityCalendar, approvedOffers);
        const slotAvailability = getTimeSlotAvailabilityStatus(availabilityCalendar, approvedOffers);

        console.log(`Validation complete: ${availableSlots.length} available, ${unavailableSlots.length} unavailable`);
        return { availableSlots, unavailableSlots, slotAvailability };
      } catch (error) {
        console.error('Failed to validate time slot availability:', error);
        return { 
          availableSlots: [], 
          unavailableSlots: [],
          slotAvailability: []
        };
      }
    },
    enabled: !!actor && !isFetching && !!taskId && !!availabilityCalendar,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 1000, // Refresh every second
  });
}

// Hook to check if a specific time slot is available with client-side validation
export function useCheckTimeSlotAvailability(taskId: string, timeSlot: TimeSlot | null, availabilityCalendar?: AvailabilityCalendar) {
  const { actor, isFetching } = useActor();

  return useQuery<BookingValidationResult>({
    queryKey: ['timeSlotValidation', taskId, timeSlot ? `${timeSlot.startTime.toString()}_${timeSlot.endTime.toString()}` : 'none'],
    queryFn: async () => {
      if (!timeSlot || !availabilityCalendar || !actor) {
        return { isValid: false, errorMessage: 'No time slot selected' };
      }

      try {
        // Always fetch fresh offers data for accurate validation
        console.log('Checking time slot availability with latest backend data...');
        const offers = await actor.getOffers();
        const approvedOffers = offers.filter(o => o.taskId === taskId && o.status === 'approved');

        const result = validateTimeSlotAvailability(taskId, timeSlot, availabilityCalendar, approvedOffers);
        console.log('Time slot validation result:', result.isValid ? 'VALID' : 'INVALID');
        return result;
      } catch (error) {
        console.error('Failed to check time slot availability:', error);
        return { isValid: false, errorMessage: 'Error checking availability. Please try again.' };
      }
    },
    enabled: !!actor && !isFetching && !!taskId && !!timeSlot && !!availabilityCalendar,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 500, // Refresh every 500ms for real-time validation
  });
}

export function useMarkTaskCompleted() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.markTaskCompleted(taskId);
    },
    onSuccess: () => {
      const queriesToInvalidate = [
        'tasks', 'myCreatedTasks', 'myOfferedTasks', 'payments', 'notifications', 
        'myNFTs', 'tasksWithinRadius', 'currentUserProfile', 'userProfile', 'userProfiles'
      ];
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
  });
}
