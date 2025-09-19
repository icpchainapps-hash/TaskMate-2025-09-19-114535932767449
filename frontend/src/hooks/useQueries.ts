import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import { Task, Reaction, Comment, AvailabilityCalendar, TimeSlot, Offer, Message, Notification, Payment, StripeConfiguration, UserProfile, PoliceCheckStatus, Accreditation, FeedPost, FeedPostType, SwapStatus } from '../backend';
import { Principal } from '@dfinity/principal';

// Optimized query options
const defaultQueryOptions = {
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 15000),
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
};

// Feed post types for client-side compatibility
export interface NeighbourhoodPost {
  id: string;
  postType: 'task_promo' | 'swap' | 'freecycle' | 'notice' | 'volunteer_slotpack';
  title: string;
  description: string;
  category?: string;
  author: Principal;
  createdAt: bigint;
  location: {
    address?: string;
    suburb: string;
    state: string;
    postcode: string;
    latitude: number;
    longitude: number;
  };
  visibilityRadius: number;
  taskId?: string;
  slotCount?: number;
  pledgedSlots?: number;
  images?: string[];
  tags?: string[];
  isSaved?: boolean;
  commentCount?: number;
  reactionCount?: number;
  availabilityCalendar?: AvailabilityCalendar;
  status?: 'open' | 'pending' | 'assigned' | 'closed';
  assignedTo?: Principal;
  isActive?: boolean;
}

export interface FeedPostReaction {
  id: string;
  postId: string;
  userId: Principal;
  emoji: string;
  createdAt: bigint;
}

export interface FeedPostComment {
  id: string;
  postId: string;
  userId: Principal;
  text: string;
  timestamp: bigint;
}

export interface ClaimedItem {
  id: string;
  postId: string;
  userId: Principal;
  itemType: 'swap' | 'freecycle' | 'volunteer_slot';
  title: string;
  description: string;
  location: {
    suburb: string;
    state: string;
    postcode: string;
  };
  status: ClaimedItemStatus;
  claimedAt: bigint;
  completedAt?: bigint;
  postAuthor: Principal;
  selectedTimeSlot?: TimeSlot;
}

export type ClaimedItemStatus = 
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// Client-side storage
let feedPostReactions: FeedPostReaction[] = [];
let feedPostComments: FeedPostComment[] = [];
let claimedItems: ClaimedItem[] = [];
const archivedMessageThreads = new Set<string>();
let updatedPosts: Map<string, NeighbourhoodPost> = new Map();
let feedPostMessageThreads: Map<string, {
  id: string;
  authorPrincipal: string;
  authorName: string;
  messages: Message[];
  lastMessage?: Message;
  isArchived: boolean;
  createdAt: bigint;
  isReady: boolean;
}> = new Map();

interface MessageThread {
  task: Task;
  lastMessage?: Message;
  messageCount: number;
  isMessageThreadArchived: boolean;
}

interface FeedPostMessageThread {
  id: string;
  authorPrincipal: string;
  authorName: string;
  lastMessage?: Message;
  messageCount: number;
  isArchived: boolean;
}

// Core user profile hooks
export function useHasDisplayName() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<boolean>({
    queryKey: ['hasDisplayName'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.hasDisplayName();
    },
    enabled: !!actor && !actorFetching,
    ...defaultQueryOptions,
    staleTime: 10 * 60 * 1000,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    ...defaultQueryOptions,
    staleTime: 10 * 60 * 1000,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useGetUserProfile(userPrincipal: Principal) {
  const { actor, isFetching } = useActor();

  return useQuery<UserProfile | null>({
    queryKey: ['userProfile', userPrincipal.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getUserProfile(userPrincipal);
    },
    enabled: !!actor && !isFetching,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetUserProfiles(userPrincipals: Principal[]) {
  const { actor, isFetching } = useActor();

  return useQuery<Map<string, UserProfile | null>>({
    queryKey: ['userProfiles', userPrincipals.map(p => p.toString()).sort()],
    queryFn: async () => {
      if (!actor) return new Map();
      
      const profileMap = new Map<string, UserProfile | null>();
      const BATCH_SIZE = 3;
      
      for (let i = 0; i < userPrincipals.length; i += BATCH_SIZE) {
        const batch = userPrincipals.slice(i, i + BATCH_SIZE);
        const profilePromises = batch.map(async (principal: Principal) => {
          try {
            const profile = await actor.getUserProfile(principal);
            return { principal: principal.toString(), profile };
          } catch (error) {
            console.warn('Failed to fetch profile for', principal.toString(), error);
            return { principal: principal.toString(), profile: null };
          }
        });
        
        const results = await Promise.all(profilePromises);
        results.forEach(({ principal, profile }) => {
          profileMap.set(principal, profile);
        });
      }
      
      return profileMap;
    },
    enabled: !!actor && !isFetching && userPrincipals.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      const queriesToInvalidate = ['currentUserProfile', 'userProfile', 'userProfiles', 'hasDisplayName'];
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
  });
}

// Police check hooks
export function useGetPoliceCheckStatus() {
  const { actor, isFetching } = useActor();

  return useQuery<PoliceCheckStatus>({
    queryKey: ['policeCheckStatus'],
    queryFn: async () => {
      if (!actor) return PoliceCheckStatus.notRequested;
      return actor.getPoliceCheckStatus();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30000,
    refetchInterval: (query) => {
      return query.state.data === PoliceCheckStatus.inProgress ? 30000 : false;
    },
  });
}

export function useRequestPoliceCheck() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.requestPoliceCheck();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['policeCheckStatus'] });
    },
  });
}

// Accreditation hooks
function createAccreditationMutation(action: 'add' | 'remove' | 'update') {
  return function() {
    const { actor } = useActor();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (data: Accreditation | string) => {
        if (!actor) throw new Error('Actor not available');
        switch (action) {
          case 'add':
            return actor.addAccreditation(data as Accreditation);
          case 'remove':
            return actor.removeAccreditation(data as string);
          case 'update':
            return actor.updateAccreditation(data as Accreditation);
        }
      },
      onSuccess: () => {
        const queriesToInvalidate = ['currentUserProfile', 'userProfile', 'userProfiles'];
        queriesToInvalidate.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      },
    });
  };
}

export const useAddAccreditation = createAccreditationMutation('add');
export const useRemoveAccreditation = createAccreditationMutation('remove');
export const useUpdateAccreditation = createAccreditationMutation('update');

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
    ...defaultQueryOptions,
  });
}

export function useMakeOffer() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offer: Offer) => {
      if (!actor || !identity) throw new Error('Actor or identity not available');
      return actor.makeOffer(offer);
    },
    onSuccess: () => {
      const queriesToInvalidate = ['offers', 'notifications', 'myOfferedTasks', 'tasks', 'tasksWithinRadius'];
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
          ? ['offers', 'tasks', 'notifications', 'myCreatedTasks', 'myOfferedTasks', 'tasksWithinRadius']
          : ['offers', 'notifications', 'myOfferedTasks'];
        queriesToInvalidate.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      },
    });
  };
}

export const useApproveOffer = createOfferActionMutation('approve');
export const useRejectOffer = createOfferActionMutation('reject');

// Message hooks
export function useGetMessagesForTask(taskId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Message[]>({
    queryKey: ['messages', taskId],
    queryFn: async () => {
      if (!actor) return [];
      
      // Check if this is a feed post message thread
      if (taskId.startsWith('feed_message_')) {
        const thread = feedPostMessageThreads.get(taskId);
        return thread ? thread.messages : [];
      }
      
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
      
      // Handle feed post message threads
      if (message.taskId.startsWith('feed_message_')) {
        const thread = feedPostMessageThreads.get(message.taskId);
        if (thread) {
          thread.messages.push(message);
          thread.lastMessage = message;
          feedPostMessageThreads.set(message.taskId, thread);
        }
        return;
      }
      
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

  return useQuery<(MessageThread | FeedPostMessageThread)[]>({
    queryKey: ['messageThreads'],
    queryFn: async () => {
      if (!actor || !identity) return [];
      
      const currentUserPrincipal = identity.getPrincipal().toString();
      const threads: (MessageThread | FeedPostMessageThread)[] = [];
      
      // Get regular task-based message threads
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
      
      // Add feed post message threads
      for (const [threadId, thread] of feedPostMessageThreads.entries()) {
        const hasParticipatedInMessages = thread.messages.some(message => 
          message.sender.toString() === currentUserPrincipal || 
          message.recipient.toString() === currentUserPrincipal
        );
        
        if (hasParticipatedInMessages || thread.messages.length === 0) {
          threads.push({
            id: threadId,
            authorPrincipal: thread.authorPrincipal,
            authorName: thread.authorName,
            lastMessage: thread.lastMessage,
            messageCount: thread.messages.length,
            isArchived: thread.isArchived
          });
        }
      }
      
      return threads.sort((a, b) => {
        const aLastMessage = 'lastMessage' in a ? a.lastMessage : a.lastMessage;
        const bLastMessage = 'lastMessage' in b ? b.lastMessage : b.lastMessage;
        
        if (!aLastMessage && !bLastMessage) return 0;
        if (!aLastMessage) return 1;
        if (!bLastMessage) return -1;
        return Number(bLastMessage.timestamp - aLastMessage.timestamp);
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
      
      if (taskId.startsWith('feed_message_')) {
        return 0;
      }
      
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

export function useGetOrCreateFeedPostMessageThread() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ authorPrincipal, authorName }: { authorPrincipal: string; authorName: string }) => {
      if (!identity) throw new Error('Identity not available');
      
      const currentUserPrincipal = identity.getPrincipal().toString();
      
      // Create a deterministic thread ID based on both participants
      const participants = [currentUserPrincipal, authorPrincipal].sort();
      const threadId = `feed_message_${participants[0]}_${participants[1]}`;
      
      // Check if thread already exists
      let thread = feedPostMessageThreads.get(threadId);
      if (thread) {
        return { threadId, isNew: false };
      }
      
      // Create new thread immediately
      thread = {
        id: threadId,
        authorPrincipal,
        authorName,
        messages: [],
        isArchived: false,
        createdAt: BigInt(Date.now() * 1000000),
        isReady: true
      };
      
      feedPostMessageThreads.set(threadId, thread);
      
      return { threadId, isNew: true };
    },
    onSuccess: ({ threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['messageThreads'] });
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
      
      queryClient.refetchQueries({ queryKey: ['messageThreads'] });
      queryClient.refetchQueries({ queryKey: ['messages', threadId] });
    },
  });
}

// Message thread archive hooks
function createMessageArchiveMutation(action: 'archive' | 'unarchive') {
  return function() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (taskId: string) => {
        if (taskId.startsWith('feed_message_')) {
          const thread = feedPostMessageThreads.get(taskId);
          if (thread) {
            thread.isArchived = action === 'archive';
            feedPostMessageThreads.set(taskId, thread);
          }
        } else {
          if (action === 'archive') {
            archivedMessageThreads.add(taskId);
          } else {
            archivedMessageThreads.delete(taskId);
          }
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

// Payment hooks
export function useGetPayments() {
  const { actor, isFetching } = useActor();

  return useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPayments();
    },
    enabled: !!actor && !isFetching,
    ...defaultQueryOptions,
  });
}

export function useIsStripeConfigured() {
  const { actor, isFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['isStripeConfigured'],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return actor.isStripeConfigured();
      } catch (error) {
        console.warn('Failed to check Stripe configuration:', error);
        return false;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetStripeConfiguration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: StripeConfiguration) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setStripeConfiguration(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['isStripeConfigured'] });
    },
  });
}

export function useGetPlatformFeePercentage() {
  const { actor, isFetching } = useActor();

  return useQuery<number>({
    queryKey: ['platformFeePercentage'],
    queryFn: async () => {
      if (!actor) return 5;
      try {
        const result = await actor.getPlatformFeePercentage();
        return Number(result);
      } catch (error) {
        console.warn('Failed to get platform fee percentage:', error);
        return 5;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSetPlatformFeePercentage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (percentage: number) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setPlatformFeePercentage(BigInt(percentage));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformFeePercentage'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// Admin hooks
export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['isCallerAdmin'],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return actor.isCallerAdmin();
      } catch (error) {
        console.warn('Failed to check admin status:', error);
        return false;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: 500,
  });
}

// NFT hooks
export function useGetMyNFTs() {
  const { actor, isFetching } = useActor();
  const { data: payments = [] } = useGetPayments();
  const { data: tasks = [] } = useGetTasks();

  return useQuery({
    queryKey: ['myNFTs'],
    queryFn: async () => {
      if (!actor) return [];
      
      const mockNFTs = payments
        .filter(payment => payment.status === 'completed')
        .map((payment, index) => {
          const task = tasks.find(t => t.id === payment.taskId);
          if (!task) return null;
          
          return {
            tokenId: `${payment.taskId.slice(-8)}_${index}`,
            metadata: {
              task_id: payment.taskId,
              title: task.title,
              description_hash: `hash_${payment.taskId}`,
              poster_principal: payment.requester.toString(),
              worker_principal: payment.tasker.toString(),
              amount: Number(payment.amount),
              currency: 'AUD',
              completed_at: new Date(Number(payment.createdAt) / 1000000).toISOString(),
              evidence_media: task.images.map(url => ({
                url,
                sha256: `sha256_${url.slice(-10)}`
              })),
              ...(Math.random() > 0.3 && { rating_by_poster: Math.floor(Math.random() * 2) + 4 })
            },
            mintedAt: new Date(Number(payment.createdAt) / 1000000).toISOString()
          };
        })
        .filter(nft => nft !== null);
      
      return mockNFTs;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

// Feed post hooks
export function useGetNeighbourhoodPosts() {
  const { actor, isFetching } = useActor();

  return useQuery<NeighbourhoodPost[]>({
    queryKey: ['neighbourhoodPosts'],
    queryFn: async () => {
      if (!actor) return [];
      
      try {
        const backendPosts = await actor.getFeedPosts();
        
        const convertedPosts = backendPosts.map(post => {
          try {
            const locationParts = post.location.split(',').map(part => part.trim());
            
            let postType: 'task_promo' | 'swap' | 'freecycle' | 'notice' | 'volunteer_slotpack';
            switch (post.postType) {
              case 'taskPromo':
                postType = 'task_promo';
                break;
              case 'volunteerSlotpack':
                postType = 'volunteer_slotpack';
                break;
              default:
                postType = post.postType as 'swap' | 'freecycle' | 'notice';
            }
            
            const clientUpdate = updatedPosts.get(post.id);
            if (clientUpdate) {
              return clientUpdate;
            }
            
            let status: 'open' | 'pending' | 'assigned' | 'closed' = 'open';
            
            if (postType === 'swap') {
              switch (post.status) {
                case 'open':
                  status = 'open';
                  break;
                case 'pending':
                  status = 'pending';
                  break;
                case 'assigned':
                  status = 'assigned';
                  break;
                case 'closed':
                  status = 'closed';
                  break;
              }
            }
            
            const neighbourhoodPost: NeighbourhoodPost = {
              id: post.id,
              postType,
              title: post.title,
              description: post.description,
              author: post.creator,
              createdAt: post.createdAt,
              location: {
                address: locationParts[0] || '',
                suburb: locationParts[1] || '',
                state: locationParts[2] || '',
                postcode: locationParts[3] || '',
                latitude: post.latitude,
                longitude: post.longitude
              },
              visibilityRadius: Number(post.visibilityRadius),
              taskId: post.taskId,
              slotCount: post.postType === 'volunteerSlotpack' ? Number(post.availableSlots) : undefined,
              pledgedSlots: post.postType === 'volunteerSlotpack' ? Number(post.claimedSlots) : undefined,
              images: [],
              tags: [],
              isSaved: false,
              commentCount: feedPostComments.filter(c => c.postId === post.id).length,
              reactionCount: feedPostReactions.filter(r => r.postId === post.id).length,
              availabilityCalendar: post.availabilityCalendar,
              status,
              isActive: post.isActive,
            };
            
            return neighbourhoodPost;
          } catch (conversionError) {
            console.error('Error converting backend post to neighbourhood post:', conversionError, post);
            return null;
          }
        }).filter((post): post is NeighbourhoodPost => post !== null);
        
        const sortedPosts = convertedPosts.sort((a, b) => Number(b.createdAt - a.createdAt));
        
        return sortedPosts;
      } catch (error) {
        console.error('Failed to fetch feed posts from backend:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 15000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useCreateNeighbourhoodPost() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: Omit<NeighbourhoodPost, 'id' | 'author' | 'createdAt'>) => {
      if (!actor || !identity) {
        throw new Error('Actor or identity not available');
      }
      
      let backendPostType: FeedPostType;
      switch (post.postType) {
        case 'task_promo':
          backendPostType = FeedPostType.taskPromo;
          break;
        case 'volunteer_slotpack':
          backendPostType = FeedPostType.volunteerSlotpack;
          break;
        default:
          backendPostType = post.postType as FeedPostType;
      }
      
      const locationParts = [
        (post.location.address && post.location.address.trim()) || '',
        post.location.suburb,
        post.location.state,
        post.location.postcode
      ].filter(part => part.trim() !== '');
      
      let validatedAvailabilityCalendar: AvailabilityCalendar | undefined = undefined;
      if (post.availabilityCalendar && 
          (post.postType === 'freecycle' || post.postType === 'swap' || post.postType === 'volunteer_slotpack')) {
        
        if (post.availabilityCalendar.availableDates.length > 0 && post.availabilityCalendar.timeSlots.length > 0) {
          validatedAvailabilityCalendar = {
            availableDates: [...post.availabilityCalendar.availableDates],
            timeSlots: [...post.availabilityCalendar.timeSlots],
            durationMinutes: post.availabilityCalendar.durationMinutes,
            intervalMinutes: post.availabilityCalendar.intervalMinutes
          };
        }
      }
      
      const backendPost: FeedPost = {
        id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        postType: backendPostType,
        title: post.title,
        description: post.description,
        creator: identity.getPrincipal(),
        createdAt: BigInt(Date.now() * 1000000),
        location: locationParts.join(', '),
        latitude: post.location.latitude,
        longitude: post.location.longitude,
        visibilityRadius: BigInt(post.visibilityRadius),
        taskId: post.taskId || undefined,
        availableSlots: BigInt(post.slotCount || 0),
        claimedSlots: BigInt(0),
        isActive: true,
        availabilityCalendar: validatedAvailabilityCalendar,
        status: SwapStatus.open
      };
      
      try {
        await actor.createFeedPost(backendPost);
      } catch (backendError) {
        console.error('Failed to save feed post to backend:', backendError);
        throw new Error(`Failed to save post to backend: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`);
      }
      
      const createdPost: NeighbourhoodPost = {
        ...post,
        id: backendPost.id,
        author: identity.getPrincipal(),
        createdAt: backendPost.createdAt,
        pledgedSlots: 0,
        commentCount: 0,
        reactionCount: 0,
        availabilityCalendar: validatedAvailabilityCalendar,
        images: post.images || [],
        status: post.postType === 'swap' ? 'open' : undefined,
        isActive: true,
      };
      
      updatedPosts.set(createdPost.id, createdPost);
      
      return createdPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPostsWithinRadius'] });
      
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPosts'], 
        type: 'active' 
      });
      
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPostsWithinRadius'], 
        type: 'active' 
      });
    },
    onError: (error) => {
      console.error('Feed post creation failed:', error);
    },
  });
}

export function useUpdateNeighbourhoodPost() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: NeighbourhoodPost) => {
      if (!actor || !identity) {
        throw new Error('Actor or identity not available');
      }
      
      const persistedPost: NeighbourhoodPost = {
        ...post,
        availabilityCalendar: post.availabilityCalendar ? {
          availableDates: [...post.availabilityCalendar.availableDates],
          timeSlots: [...post.availabilityCalendar.timeSlots],
          durationMinutes: post.availabilityCalendar.durationMinutes,
          intervalMinutes: post.availabilityCalendar.intervalMinutes
        } : undefined,
        images: post.images ? [...post.images] : [],
        status: post.status,
        isActive: post.isActive,
      };
      
      updatedPosts.set(post.id, persistedPost);
      
      return persistedPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPostsWithinRadius'] });
      
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPosts'], 
        type: 'active' 
      });
    },
    onError: (error) => {
      console.error('Feed post update failed:', error);
    },
  });
}

export function useDeleteNeighbourhoodPost() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!actor || !identity) {
        throw new Error('Actor or identity not available');
      }
      
      try {
        await actor.deleteFeedPost(postId);
        updatedPosts.delete(postId);
        return postId;
      } catch (backendError) {
        console.error('Failed to delete feed post from backend:', backendError);
        throw new Error(`Failed to delete post: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPostsWithinRadius'] });
      
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPosts'], 
        type: 'active' 
      });
      
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPostsWithinRadius'], 
        type: 'active' 
      });
    },
    onError: (error) => {
      console.error('Feed post deletion failed:', error);
    },
  });
}

export function useGetNeighbourhoodPostsWithinRadius(latitude?: number, longitude?: number, radiusKm?: number) {
  const { actor, isFetching } = useActor();

  return useQuery<NeighbourhoodPost[]>({
    queryKey: ['neighbourhoodPostsWithinRadius', latitude, longitude, radiusKm],
    queryFn: async () => {
      if (!actor) return [];
      
      try {
        let backendPosts: FeedPost[];
        
        if (latitude === undefined || longitude === undefined || radiusKm === undefined) {
          backendPosts = await actor.getFeedPosts();
        } else {
          backendPosts = await actor.getFeedPostsWithinRadius(latitude, longitude, BigInt(radiusKm));
        }
        
        const convertedPosts = backendPosts.map(post => {
          try {
            const locationParts = post.location.split(',').map(part => part.trim());
            
            let postType: 'task_promo' | 'swap' | 'freecycle' | 'notice' | 'volunteer_slotpack';
            switch (post.postType) {
              case 'taskPromo':
                postType = 'task_promo';
                break;
              case 'volunteerSlotpack':
                postType = 'volunteer_slotpack';
                break;
              default:
                postType = post.postType as 'swap' | 'freecycle' | 'notice';
            }
            
            const clientUpdate = updatedPosts.get(post.id);
            if (clientUpdate) {
              return clientUpdate;
            }
            
            let status: 'open' | 'pending' | 'assigned' | 'closed' = 'open';
            
            if (postType === 'swap') {
              switch (post.status) {
                case 'open':
                  status = 'open';
                  break;
                case 'pending':
                  status = 'pending';
                  break;
                case 'assigned':
                  status = 'assigned';
                  break;
                case 'closed':
                  status = 'closed';
                  break;
              }
            }
            
            const neighbourhoodPost: NeighbourhoodPost = {
              id: post.id,
              postType,
              title: post.title,
              description: post.description,
              author: post.creator,
              createdAt: post.createdAt,
              location: {
                address: locationParts[0] || '',
                suburb: locationParts[1] || '',
                state: locationParts[2] || '',
                postcode: locationParts[3] || '',
                latitude: post.latitude,
                longitude: post.longitude
              },
              visibilityRadius: Number(post.visibilityRadius),
              taskId: post.taskId,
              slotCount: post.postType === 'volunteerSlotpack' ? Number(post.availableSlots) : undefined,
              pledgedSlots: post.postType === 'volunteerSlotpack' ? Number(post.claimedSlots) : undefined,
              images: [],
              tags: [],
              isSaved: false,
              commentCount: feedPostComments.filter(c => c.postId === post.id).length,
              reactionCount: feedPostReactions.filter(r => r.postId === post.id).length,
              availabilityCalendar: post.availabilityCalendar,
              status,
              isActive: post.isActive,
            };
            
            return neighbourhoodPost;
          } catch (conversionError) {
            console.error('Error converting backend post in radius query:', conversionError, post);
            return null;
          }
        }).filter((post): post is NeighbourhoodPost => post !== null);
        
        const sortedPosts = convertedPosts.sort((a, b) => Number(b.createdAt - a.createdAt));
        
        return sortedPosts;
      } catch (error) {
        console.error('Failed to fetch feed posts within radius from backend:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Feed post reaction hooks
export function useGetFeedPostReactions(postId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<FeedPostReaction[]>({
    queryKey: ['feedPostReactions', postId],
    queryFn: async () => {
      return feedPostReactions.filter(reaction => reaction.postId === postId);
    },
    enabled: !!actor && !isFetching && !!postId,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

function createFeedReactionMutation(action: 'add' | 'remove') {
  return function() {
    const { actor } = useActor();
    const { identity } = useInternetIdentity();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ postId, emoji }: { postId: string; emoji?: string }) => {
        if (!actor || !identity) throw new Error('Actor or identity not available');
        
        if (action === 'remove') {
          feedPostReactions = feedPostReactions.filter(r => 
            !(r.postId === postId && r.userId.toString() === identity.getPrincipal().toString())
          );
          return true;
        }

        feedPostReactions = feedPostReactions.filter(r => 
          !(r.postId === postId && r.userId.toString() === identity.getPrincipal().toString())
        );
        
        const reaction: FeedPostReaction = {
          id: `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          postId,
          userId: identity.getPrincipal(),
          emoji: emoji!,
          createdAt: BigInt(Date.now() * 1000000),
        };
        
        feedPostReactions.push(reaction);
        return reaction;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['feedPostReactions', variables.postId] });
        queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
        queryClient.refetchQueries({ 
          queryKey: ['feedPostReactions', variables.postId],
          type: 'active'
        });
      },
    });
  };
}

export const useAddFeedPostReaction = createFeedReactionMutation('add');
export const useRemoveFeedPostReaction = createFeedReactionMutation('remove');

// Feed post comment hooks
export function useGetFeedPostComments(postId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<FeedPostComment[]>({
    queryKey: ['feedPostComments', postId],
    queryFn: async () => {
      return feedPostComments
        .filter(comment => comment.postId === postId)
        .sort((a, b) => Number(a.timestamp - b.timestamp));
    },
    enabled: !!actor && !isFetching && !!postId,
    staleTime: 30000,
  });
}

export function useAddFeedPostComment() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
      if (!actor || !identity) throw new Error('Actor or identity not available');
      
      const comment: FeedPostComment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        postId,
        userId: identity.getPrincipal(),
        text,
        timestamp: BigInt(Date.now() * 1000000),
      };
      
      feedPostComments.push(comment);
      return comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feedPostComments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
    },
  });
}

// Claimed items hooks
export function useGetMyClaimedItems() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<ClaimedItem[]>({
    queryKey: ['myClaimedItems'],
    queryFn: async () => {
      if (!identity) return [];
      
      const userPrincipal = identity.getPrincipal().toString();
      const userClaimedItems = claimedItems.filter(item => 
        item.userId.toString() === userPrincipal
      );
      
      return userClaimedItems.sort((a, b) => Number(b.claimedAt - a.claimedAt));
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// Feed interaction hooks
function createClaimMutation(itemType: 'swap' | 'freecycle' | 'volunteer_slot') {
  return function() {
    const { actor } = useActor();
    const { identity } = useInternetIdentity();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ postId, post, selectedTimeSlot }: { 
        postId: string; 
        post: NeighbourhoodPost; 
        selectedTimeSlot?: TimeSlot;
      }) => {
        if (!actor || !identity) throw new Error('Actor or identity not available');
        
        // Enhanced validation for completed swaps
        if (itemType === 'swap' && post.status === 'closed') {
          throw new Error('This swap has been completed and is no longer available for claiming. Please look for other available swaps.');
        }
        
        if (itemType === 'swap' && post.status !== 'open') {
          const statusMessages = {
            'pending': 'This swap is pending approval from another user and cannot be claimed.',
            'assigned': 'This swap has already been assigned to another user.',
            'closed': 'This swap has been completed and is no longer available for claiming.'
          };
          throw new Error(statusMessages[post.status as keyof typeof statusMessages] || 'This swap is not available for claiming.');
        }
        
        const hasAvailabilitySlots = post.availabilityCalendar && 
                                   post.availabilityCalendar.availableDates.length > 0 && 
                                   post.availabilityCalendar.timeSlots.length > 0;
        
        if (hasAvailabilitySlots && !selectedTimeSlot) {
          throw new Error('Time slot selection is required for this post. Please select an available time slot to proceed.');
        }
        
        const claimedItem: ClaimedItem = {
          id: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          postId,
          userId: identity.getPrincipal(),
          itemType,
          title: post.title,
          description: post.description,
          location: {
            suburb: post.location.suburb,
            state: post.location.state,
            postcode: post.location.postcode,
          },
          status: 'pending_approval',
          claimedAt: BigInt(Date.now() * 1000000),
          postAuthor: post.author,
          selectedTimeSlot: selectedTimeSlot,
        };
        
        try {
          if (itemType === 'volunteer_slot') {
            await actor.claimVolunteerSlot(postId);
            claimedItem.status = 'approved';
          } else if (itemType === 'swap') {
            await actor.claimSwap(postId);
            claimedItem.status = 'pending_approval';
          } else {
            await new Promise(resolve => setTimeout(resolve, 500));
            claimedItem.status = 'pending_approval';
          }
          
        } catch (backendError) {
          console.error(`Failed to ${itemType} action in backend:`, backendError);
          
          if (backendError instanceof Error) {
            if (backendError.message.includes('already been booked') || 
                backendError.message.includes('time slot') ||
                backendError.message.includes('not available') ||
                backendError.message.includes('not open for claiming') ||
                backendError.message.includes('closed and cannot be claimed')) {
              throw new Error('This time slot has been booked by another user or the post is no longer available for claiming. Please select a different available time slot or refresh the page.');
            }
          }
          
          if (itemType === 'volunteer_slot') {
            throw new Error(`Failed to pledge volunteer slot: ${backendError instanceof Error ? backendError.message : 'Please try again or contact support if the issue persists.'}`);
          } else if (itemType === 'swap') {
            throw new Error(`Failed to claim swap: ${backendError instanceof Error ? backendError.message : 'Please try again later or contact the post owner.'}`);
          } else {
            const actionName = itemType === 'freecycle' ? 'request pickup' : 'claim item';
            throw new Error(`Unable to ${actionName}: ${backendError instanceof Error ? backendError.message : 'Please try again later or contact the post owner.'}`);
          }
        }
        
        claimedItems.push(claimedItem);
        
        return claimedItem;
      },
      onSuccess: () => {
        const queriesToInvalidate = [
          'myClaimedItems', 
          'neighbourhoodPosts', 
          'neighbourhoodPostsWithinRadius',
          'notifications'
        ];
        
        queriesToInvalidate.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
        
        queryClient.refetchQueries({ queryKey: ['myClaimedItems'], type: 'active' });
        queryClient.refetchQueries({ queryKey: ['neighbourhoodPosts'], type: 'active' });
        queryClient.refetchQueries({ queryKey: ['neighbourhoodPostsWithinRadius'], type: 'active' });
        queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
      },
    });
  };
}

export const useClaimSwap = createClaimMutation('swap');
export const useClaimFreecycleItem = createClaimMutation('freecycle');
export const usePledgeVolunteerSlot = createClaimMutation('volunteer_slot');

// Swap claim approval hooks
export function useApproveSwapClaim() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, claimant }: { postId: string; claimant: Principal }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.approveSwapClaim(postId, claimant);
    },
    onSuccess: (_, variables) => {
      const claimedItem = claimedItems.find(item => 
        item.postId === variables.postId && 
        item.userId.toString() === variables.claimant.toString() &&
        item.itemType === 'swap'
      );
      
      if (claimedItem) {
        claimedItem.status = 'approved';
      }

      const queriesToInvalidate = [
        'myClaimedItems',
        'neighbourhoodPosts',
        'neighbourhoodPostsWithinRadius',
        'notifications'
      ];
      
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
      
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['myClaimedItems'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPosts'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPostsWithinRadius'], type: 'active' });
    },
  });
}

export function useRejectSwapClaim() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, claimant }: { postId: string; claimant: Principal }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.rejectSwapClaim(postId, claimant);
    },
    onSuccess: (_, variables) => {
      const claimedItem = claimedItems.find(item => 
        item.postId === variables.postId && 
        item.userId.toString() === variables.claimant.toString() &&
        item.itemType === 'swap'
      );
      
      if (claimedItem) {
        claimedItem.status = 'rejected';
      }

      const queriesToInvalidate = [
        'myClaimedItems',
        'neighbourhoodPosts',
        'neighbourhoodPostsWithinRadius',
        'notifications'
      ];
      
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
      
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['myClaimedItems'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPosts'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPostsWithinRadius'], type: 'active' });
    },
  });
}

export function useMarkSwapCompleted() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, claimant }: { postId: string; claimant: Principal }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.markSwapCompleted(postId, claimant);
    },
    onSuccess: (_, variables) => {
      const claimedItem = claimedItems.find(item => 
        item.postId === variables.postId && 
        item.userId.toString() === variables.claimant.toString() &&
        item.itemType === 'swap'
      );
      
      if (claimedItem) {
        claimedItem.status = 'completed';
        claimedItem.completedAt = BigInt(Date.now() * 1000000);
      }

      const updatedPost = updatedPosts.get(variables.postId);
      if (updatedPost && updatedPost.postType === 'swap') {
        updatedPost.status = 'closed';
        updatedPosts.set(variables.postId, updatedPost);
      }

      const queriesToInvalidate = [
        'myClaimedItems',
        'neighbourhoodPosts',
        'neighbourhoodPostsWithinRadius',
        'notifications'
      ];
      
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
      
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPosts'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPostsWithinRadius'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['myClaimedItems'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
    },
  });
}

export function useMarkSwapDidNotOccur() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.markSwapDidNotOccur(postId);
    },
    onSuccess: (_, postId) => {
      const updatedPost = updatedPosts.get(postId);
      if (updatedPost && updatedPost.postType === 'swap') {
        updatedPost.status = 'open';
        updatedPosts.set(postId, updatedPost);
      }

      const queriesToInvalidate = [
        'neighbourhoodPosts',
        'neighbourhoodPostsWithinRadius',
        'notifications'
      ];
      
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
      
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPosts'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['neighbourhoodPostsWithinRadius'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
    },
  });
}
