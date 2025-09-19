import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { useInternetIdentity } from '../useInternetIdentity';
import { Message, Task, Notification } from '../../backend';
import { Principal } from '@dfinity/principal';

// Client-side storage for archived message threads
const archivedMessageThreads = new Set<string>();

interface MessageThread {
  task: Task;
  lastMessage?: Message;
  messageCount: number;
  isMessageThreadArchived: boolean;
}

// Message hooks
export function useGetMessagesForTask(taskId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Message[]>({
    queryKey: ['messages', taskId],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return actor.getMessagesForTask(taskId);
      } catch (error) {
        console.warn('Error fetching messages for task:', taskId, error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!taskId,
    refetchInterval: 5000,
    staleTime: 1000,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: Message) => {
      if (!actor) throw new Error('Actor not available');
      return actor.sendMessage(message);
    },
    onSuccess: (_, variables) => {
      const queriesToInvalidate = ['messages', 'messageThreads', 'notifications', 'unreadMessageCount'];
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey, variables.taskId] });
      });
      queryClient.refetchQueries({ queryKey: ['messageThreads'] });
      queryClient.refetchQueries({ queryKey: ['unreadMessageCount'] });
    },
  });
}

export function useGetMessageThreads() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<MessageThread[]>({
    queryKey: ['messageThreads'],
    queryFn: async () => {
      if (!actor || !identity) return [];
      
      const currentUserPrincipal = identity.getPrincipal().toString();
      const threads: MessageThread[] = [];
      
      // Get tasks and offers to determine relevant tasks
      const [tasks, offers] = await Promise.all([
        actor.getTasks(),
        actor.getOffers()
      ]);
      
      const relevantTasks = tasks.filter(task => {
        const isTaskOwner = task.requester.toString() === currentUserPrincipal;
        const isAssignedTasker = task.assignedTasker?.toString() === currentUserPrincipal;
        const hasOfferedOnTask = offers.some(offer => 
          offer.taskId === task.id && offer.tasker.toString() === currentUserPrincipal
        );
        
        return isTaskOwner || isAssignedTasker || hasOfferedOnTask;
      });
      
      const messagePromises = relevantTasks.map(async (task) => {
        try {
          const messages = await actor.getMessagesForTask(task.id);
          return { task, messages };
        } catch (error) {
          console.warn('Error fetching messages for task:', task.id, error);
          return { task, messages: [] };
        }
      });
      
      const taskMessagesResults = await Promise.all(messagePromises);
      
      for (const { task, messages } of taskMessagesResults) {
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          const isMessageThreadArchived = archivedMessageThreads.has(task.id);
          
          const hasParticipatedInMessages = messages.some(message => 
            message.sender.toString() === currentUserPrincipal || 
            message.recipient.toString() === currentUserPrincipal
          );
          
          if (hasParticipatedInMessages) {
            threads.push({
              task,
              lastMessage,
              messageCount: messages.length,
              isMessageThreadArchived
            });
          }
        }
      }
      
      return threads.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return Number(b.lastMessage.timestamp - a.lastMessage.timestamp);
      });
    },
    enabled: !!actor && !isFetching && !!identity,
    refetchInterval: 5000,
    staleTime: 2000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useGetUnreadMessageCount() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<number>({
    queryKey: ['unreadMessageCount'],
    queryFn: async () => {
      if (!actor || !identity) return 0;
      
      try {
        const notifications = await actor.getNotifications();
        const unreadMessageNotifications = notifications.filter(n => 
          n.notificationType === 'message' && !n.isRead
        );
        return unreadMessageNotifications.length;
      } catch (error) {
        console.warn('Failed to get unread message count:', error);
        return 0;
      }
    },
    enabled: !!actor && !isFetching && !!identity,
    refetchInterval: 2000,
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchIntervalInBackground: false,
  });
}

export function useMarkMessageNotificationsAsRead() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        const notifications = await actor.getNotifications();
        const messageNotifications = notifications.filter(n => 
          n.notificationType === 'message' && 
          n.taskId === taskId && 
          !n.isRead
        );
        
        const markReadPromises = messageNotifications.map(notification => 
          actor.markNotificationAsRead(notification.id)
        );
        
        await Promise.all(markReadPromises);
        return messageNotifications.length;
      } catch (error) {
        console.warn('Failed to mark message notifications as read:', error);
        return 0;
      }
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['unreadMessageCount'] });
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousUnreadCount = queryClient.getQueryData<number>(['unreadMessageCount']) || 0;
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']) || [];

      const unreadMessageNotificationsForTask = previousNotifications.filter(n => 
        n.notificationType === 'message' && 
        n.taskId === taskId && 
        !n.isRead
      ).length;

      const newUnreadCount = Math.max(0, previousUnreadCount - unreadMessageNotificationsForTask);
      queryClient.setQueryData(['unreadMessageCount'], newUnreadCount);

      const updatedNotifications = previousNotifications.map(n => 
        n.notificationType === 'message' && n.taskId === taskId && !n.isRead
          ? { ...n, isRead: true }
          : n
      );
      queryClient.setQueryData(['notifications'], updatedNotifications);

      return { previousUnreadCount, previousNotifications, unreadMessageNotificationsForTask };
    },
    onError: (err, taskId, context) => {
      if (context) {
        queryClient.setQueryData(['unreadMessageCount'], context.previousUnreadCount);
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['unreadMessageCount'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessageCount'] });
    },
  });
}

// Message thread archive hooks
function createMessageArchiveMutation(action: 'archive' | 'unarchive') {
  return function() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (taskId: string) => {
        if (action === 'archive') {
          archivedMessageThreads.add(taskId);
        } else {
          archivedMessageThreads.delete(taskId);
        }
        return Promise.resolve();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['messageThreads'] });
      },
    });
  };
}

export const useArchiveMessageThreadOnly = createMessageArchiveMutation('archive');
export const useUnarchiveMessageThreadOnly = createMessageArchiveMutation('unarchive');
