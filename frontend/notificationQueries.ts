import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { Notification } from '../../backend';

// Notification hooks
export function useGetNotifications() {
  const { actor, isFetching } = useActor();

  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getNotifications();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
    staleTime: 2000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationAsRead() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.markNotificationAsRead(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessageCount'] });
      queryClient.refetchQueries({ queryKey: ['unreadMessageCount'] });
    },
  });
}

// Notification clearing hooks
function createNotificationClearMutation(action: 'single' | 'all') {
  return function() {
    const { actor } = useActor();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (notificationId?: string) => {
        if (!actor) throw new Error('Actor not available');
        return action === 'single' ? actor.clearNotification(notificationId!) : actor.clearAllNotifications();
      },
      onMutate: async (notificationId) => {
        await queryClient.cancelQueries({ queryKey: ['notifications'] });
        const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']) || [];
        
        if (action === 'single' && notificationId) {
          const updatedNotifications = previousNotifications.filter(n => n.id !== notificationId);
          queryClient.setQueryData(['notifications'], updatedNotifications);
        } else {
          queryClient.setQueryData(['notifications'], []);
        }
        
        return { previousNotifications };
      },
      onError: (err, notificationId, context) => {
        if (context) {
          queryClient.setQueryData(['notifications'], context.previousNotifications);
        }
      },
      onSuccess: () => {
        queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      },
    });
  };
}

export const useClearNotification = createNotificationClearMutation('single');
export const useClearAllNotifications = createNotificationClearMutation('all');