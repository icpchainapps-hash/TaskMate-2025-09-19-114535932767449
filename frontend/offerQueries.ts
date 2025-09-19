import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { useInternetIdentity } from '../useInternetIdentity';
import { Offer } from '../../backend';
import { validateTimeSlotAvailability } from './taskQueries';

// Optimized query options
const defaultQueryOptions = {
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 15000),
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
};

// Offer hooks
export function useGetOffers() {
  const { actor, isFetching } = useActor();

  return useQuery<Offer[]>({
    queryKey: ['offers'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getOffers();
    },
    enabled: !!actor && !isFetching,
    staleTime: 0, // Always fetch fresh data for real-time booking updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 2000, // Refresh every 2 seconds for booking status
  });
}

export function useMakeOffer() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offer: Offer) => {
      if (!actor || !identity) throw new Error('Actor or identity not available');
      
      // Always fetch latest availability before making offer
      if (offer.selectedTimeSlot) {
        console.log('Fetching latest availability before making offer...');
        
        // Get the task to access its availability calendar
        const tasks = await actor.getTasks();
        const task = tasks.find(t => t.id === offer.taskId);
        
        if (!task) {
          throw new Error('Task not found. Please refresh and try again.');
        }

        // Get fresh offers data to check for conflicts
        const freshOffers = await actor.getOffers();
        const approvedOffers = freshOffers.filter(o => o.taskId === offer.taskId && o.status === 'approved');

        // Client-side validation with fresh data for immediate feedback
        const validationResult = validateTimeSlotAvailability(offer.taskId, offer.selectedTimeSlot, task.availabilityCalendar, approvedOffers);
        
        if (!validationResult.isValid) {
          // Provide specific error message with alternatives
          let errorMessage = validationResult.errorMessage || 'Time slot is not available.';
          
          if (validationResult.availableAlternatives && validationResult.availableAlternatives.length > 0) {
            errorMessage += ` There are ${validationResult.availableAlternatives.length} other available time slot${validationResult.availableAlternatives.length !== 1 ? 's' : ''} to choose from.`;
          } else {
            errorMessage += ' No alternative time slots are currently available.';
          }
          
          throw new Error(errorMessage);
        }
      }
      
      // Backend will handle the actual offer creation and validation
      const result = await actor.makeOffer(offer);
      
      return result;
    },
    onSuccess: (_, variables) => {
      const queriesToInvalidate = ['offers', 'notifications', 'myOfferedTasks', 'tasks', 'tasksWithinRadius', 'realTimeAvailability'];
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
  });
}

// Offer approval/rejection hooks
function createOfferActionMutation(action: 'approve' | 'reject') {
  return function() {
    const { actor } = useActor();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (offerId: string) => {
        if (!actor) throw new Error('Actor not available');
        return action === 'approve' ? actor.approveOffer(offerId) : actor.rejectOffer(offerId);
      },
      onSuccess: () => {
        const queriesToInvalidate = action === 'approve' 
          ? ['offers', 'tasks', 'notifications', 'myCreatedTasks', 'myOfferedTasks', 'tasksWithinRadius', 'realTimeAvailability']
          : ['offers', 'notifications', 'myOfferedTasks', 'realTimeAvailability'];
        queriesToInvalidate.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      },
    });
  };
}

export const useApproveOffer = createOfferActionMutation('approve');
export const useRejectOffer = createOfferActionMutation('reject');
