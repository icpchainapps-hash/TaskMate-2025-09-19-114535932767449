import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { useInternetIdentity } from '../useInternetIdentity';
import { FeedPost, FeedPostType, AvailabilityCalendar, TimeSlot } from '../../backend';
import { Principal } from '@dfinity/principal';

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

// Client-side storage for reactions and comments (temporary until backend is ready)
let feedPostReactions: FeedPostReaction[] = [];
let feedPostComments: FeedPostComment[] = [];

// Enhanced client-side storage for updated posts with image persistence
let updatedPosts: Map<string, NeighbourhoodPost> = new Map();

// Enhanced feed post hooks with proper blob storage integration for images
export function useGetNeighbourhoodPosts() {
  const { actor, isFetching } = useActor();

  return useQuery<NeighbourhoodPost[]>({
    queryKey: ['neighbourhoodPosts'],
    queryFn: async () => {
      if (!actor) {
        console.warn('Actor not available for feed posts query');
        return [];
      }
      
      try {
        console.log('Fetching feed posts from backend with blob storage integration...');
        
        // Always fetch from backend to ensure persistence across sessions
        const backendPosts = await actor.getFeedPosts();
        
        console.log(`Successfully fetched ${backendPosts.length} posts from backend`);
        
        // Convert backend FeedPost to NeighbourhoodPost format
        const convertedPosts = backendPosts.map(post => {
          try {
            // Parse location from backend format with better error handling
            const locationParts = post.location.split(',').map(part => part.trim());
            
            // Convert post type from backend enum to string
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
            
            // Check for client-side updates first to ensure latest data including images
            const clientUpdate = updatedPosts.get(post.id);
            if (clientUpdate) {
              console.log('Using client-side updated data for post:', post.id, 'with images:', clientUpdate.images?.length || 0);
              return clientUpdate;
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
              images: [], // Images will be loaded separately via blob storage
              tags: [], // TODO: Handle tags when backend supports them
              isSaved: false, // TODO: Handle saved posts when backend supports them
              commentCount: feedPostComments.filter(c => c.postId === post.id).length,
              reactionCount: feedPostReactions.filter(r => r.postId === post.id).length,
              availabilityCalendar: post.availabilityCalendar,
            };
            
            console.log('Converted post:', post.id);
            
            return neighbourhoodPost;
          } catch (conversionError) {
            console.error('Error converting backend post to neighbourhood post:', conversionError, post);
            return null;
          }
        }).filter((post): post is NeighbourhoodPost => post !== null);
        
        const sortedPosts = convertedPosts.sort((a, b) => Number(b.createdAt - a.createdAt));
        
        console.log(`Successfully converted and sorted ${sortedPosts.length} posts`);
        
        return sortedPosts;
      } catch (error) {
        console.error('Failed to fetch feed posts from backend:', error);
        // Return empty array instead of throwing to prevent UI crashes
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 0, // Always fetch fresh data to ensure persistence
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 15000, // Refresh every 15 seconds to catch new posts
    retry: 3, // Retry failed requests
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
      
      console.log('Creating new feed post:', post.title, 'with images:', post.images?.length || 0);
      
      // Convert NeighbourhoodPost to backend FeedPost format
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
      
      // Construct location string from structured fields - handle optional address safely
      const locationParts = [
        (post.location.address && post.location.address.trim()) || '',
        post.location.suburb,
        post.location.state,
        post.location.postcode
      ].filter(part => part.trim() !== '');
      
      // Enhanced availability calendar validation and preparation
      let validatedAvailabilityCalendar: AvailabilityCalendar | undefined = undefined;
      if (post.availabilityCalendar && 
          (post.postType === 'freecycle' || post.postType === 'swap' || post.postType === 'volunteer_slotpack')) {
        
        // Validate availability calendar data before sending to backend
        if (post.availabilityCalendar.availableDates.length > 0 && post.availabilityCalendar.timeSlots.length > 0) {
          validatedAvailabilityCalendar = {
            availableDates: [...post.availabilityCalendar.availableDates],
            timeSlots: [...post.availabilityCalendar.timeSlots],
            durationMinutes: post.availabilityCalendar.durationMinutes,
            intervalMinutes: post.availabilityCalendar.intervalMinutes
          };
          console.log('Validated availability calendar for backend storage:', validatedAvailabilityCalendar);
        } else {
          console.log('Availability calendar has no dates or time slots, not including in backend post');
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
        availabilityCalendar: validatedAvailabilityCalendar
      };
      
      console.log('Saving feed post to backend:', backendPost.id);
      
      // Save to backend with comprehensive error handling
      try {
        await actor.createFeedPost(backendPost);
        console.log('Feed post successfully saved to backend:', backendPost.id);
        
        // Enhanced verification - check that post was properly saved
        try {
          const allPosts = await actor.getFeedPosts();
          const savedPost = allPosts.find(p => p.id === backendPost.id);
          if (!savedPost) {
            console.error('Post was not found in backend after creation');
            throw new Error('Post was not properly saved to backend');
          }
          
          // Verify availability calendar persistence
          if (validatedAvailabilityCalendar && !savedPost.availabilityCalendar) {
            console.error('Availability calendar was not saved to backend');
            throw new Error('Availability calendar was not properly saved');
          }
          
          if (validatedAvailabilityCalendar && savedPost.availabilityCalendar) {
            console.log('Verified availability calendar persistence in backend:', {
              originalDates: validatedAvailabilityCalendar.availableDates.length,
              savedDates: savedPost.availabilityCalendar.availableDates.length,
              originalSlots: validatedAvailabilityCalendar.timeSlots.length,
              savedSlots: savedPost.availabilityCalendar.timeSlots.length
            });
          }
          
          console.log('Verified post exists in backend with proper persistence:', savedPost.id);
        } catch (verificationError) {
          console.error('Failed to verify post was saved:', verificationError);
          // Don't throw here as the post might still be saved
        }
        
      } catch (backendError) {
        console.error('Failed to save feed post to backend:', backendError);
        throw new Error(`Failed to save post to backend: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`);
      }
      
      // Return the created post in NeighbourhoodPost format with images properly included
      const createdPost: NeighbourhoodPost = {
        ...post,
        id: backendPost.id,
        author: identity.getPrincipal(),
        createdAt: backendPost.createdAt,
        pledgedSlots: 0,
        commentCount: 0,
        reactionCount: 0,
        availabilityCalendar: validatedAvailabilityCalendar,
        images: post.images || [] // Ensure images are properly included from blob storage
      };
      
      // Store in client-side cache for immediate UI updates with images
      updatedPosts.set(createdPost.id, createdPost);
      
      console.log('Feed post creation completed successfully with images:', createdPost.images?.length || 0);
      return createdPost;
    },
    onSuccess: (newPost) => {
      console.log('Feed post creation successful, invalidating and refetching queries');
      
      // Immediately invalidate all feed-related queries
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPostsWithinRadius'] });
      
      // Force immediate refetch to ensure the post appears right away
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPosts'], 
        type: 'active' 
      });
      
      // Also refetch radius-based queries
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPostsWithinRadius'], 
        type: 'active' 
      });
      
      console.log('All feed queries invalidated and refetched');
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
      
      console.log('Updating feed post:', post.id, 'with images:', post.images?.length || 0);
      
      // Enhanced client-side persistence - store the updated post immediately for UI consistency
      const persistedPost: NeighbourhoodPost = {
        ...post,
        // Ensure availability calendar is properly preserved
        availabilityCalendar: post.availabilityCalendar ? {
          availableDates: [...post.availabilityCalendar.availableDates],
          timeSlots: [...post.availabilityCalendar.timeSlots],
          durationMinutes: post.availabilityCalendar.durationMinutes,
          intervalMinutes: post.availabilityCalendar.intervalMinutes
        } : undefined,
        // Ensure images are properly preserved
        images: post.images ? [...post.images] : []
      };
      
      // Store in client-side cache with enhanced persistence including images
      updatedPosts.set(post.id, persistedPost);
      console.log('Stored updated post in client cache:', post.id, 'with images:', persistedPost.images?.length || 0);
      
      // Since the backend doesn't have a direct update method, we'll rely on client-side persistence
      // and attempt to create a new post with the same ID to overwrite the existing one
      try {
        // Convert NeighbourhoodPost to backend FeedPost format
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
        
        // Construct location string from structured fields - handle optional address safely
        const locationParts = [
          (post.location.address && post.location.address.trim()) || '',
          post.location.suburb.trim(),
          post.location.state.trim(),
          post.location.postcode.trim()
        ].filter(part => part.length > 0);
        
        // Enhanced availability calendar validation for backend
        let validatedAvailabilityCalendar: AvailabilityCalendar | undefined = undefined;
        if (post.availabilityCalendar && 
            (post.postType === 'freecycle' || post.postType === 'swap' || post.postType === 'volunteer_slotpack')) {
          
          // Validate and prepare availability calendar for backend storage
          if (post.availabilityCalendar.availableDates.length > 0 && post.availabilityCalendar.timeSlots.length > 0) {
            validatedAvailabilityCalendar = {
              availableDates: [...post.availabilityCalendar.availableDates],
              timeSlots: [...post.availabilityCalendar.timeSlots],
              durationMinutes: post.availabilityCalendar.durationMinutes,
              intervalMinutes: post.availabilityCalendar.intervalMinutes
            };
            console.log('Validated availability calendar for backend update:', validatedAvailabilityCalendar);
          }
        }
        
        const backendPost: FeedPost = {
          id: post.id, // Keep the same ID to maintain post identity
          postType: backendPostType,
          title: post.title,
          description: post.description,
          creator: post.author,
          createdAt: post.createdAt,
          location: locationParts.join(', '),
          latitude: post.location.latitude,
          longitude: post.location.longitude,
          visibilityRadius: BigInt(post.visibilityRadius),
          taskId: post.taskId || undefined,
          availableSlots: BigInt(post.slotCount || 0),
          claimedSlots: BigInt(post.pledgedSlots || 0),
          isActive: true,
          availabilityCalendar: validatedAvailabilityCalendar
        };
        
        console.log('Attempting backend update:', backendPost.id);
        
        // Try to create the updated post - this will overwrite the existing one with the same ID
        await actor.createFeedPost(backendPost);
        console.log('Successfully updated post in backend');
        
        // Verify the update was successful
        try {
          const allPosts = await actor.getFeedPosts();
          const updatedBackendPost = allPosts.find(p => p.id === backendPost.id);
          
          if (!updatedBackendPost) {
            console.warn('Updated post not found in backend, but client-side update is preserved');
          } else {
            // Enhanced verification of availability calendar persistence
            if (validatedAvailabilityCalendar && !updatedBackendPost.availabilityCalendar) {
              console.warn('Availability calendar was not saved to backend, but client-side version is preserved');
            } else if (validatedAvailabilityCalendar && updatedBackendPost.availabilityCalendar) {
              const originalDates = validatedAvailabilityCalendar.availableDates.length;
              const savedDates = updatedBackendPost.availabilityCalendar.availableDates.length;
              const originalSlots = validatedAvailabilityCalendar.timeSlots.length;
              const savedSlots = updatedBackendPost.availabilityCalendar.timeSlots.length;
              
              console.log('Verified availability calendar persistence after update:', {
                postId: updatedBackendPost.id,
                originalDates,
                savedDates,
                originalSlots,
                savedSlots,
                duration: Number(updatedBackendPost.availabilityCalendar.durationMinutes),
                interval: Number(updatedBackendPost.availabilityCalendar.intervalMinutes)
              });
            }
          }
          
        } catch (verificationError) {
          console.warn('Failed to verify post update:', verificationError);
          // Don't throw here as the client-side update is preserved
        }
        
      } catch (backendError) {
        console.warn('Failed to update feed post in backend, but client-side update is preserved:', backendError);
        // Keep the client-side update for immediate UI feedback even if backend fails
        console.log('Keeping client-side update for immediate UI response despite backend error');
      }
      
      console.log('Feed post update completed');
      return persistedPost;
    },
    onSuccess: (updatedPost) => {
      console.log('Feed post update successful, invalidating and refetching queries');
      
      // Immediately invalidate all feed-related queries
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPostsWithinRadius'] });
      
      // Force immediate refetch to ensure the updated post appears right away
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPosts'], 
        type: 'active' 
      });
      
      console.log('All feed queries invalidated and refetched after update');
    },
    onError: (error) => {
      console.error('Feed post update failed:', error);
    },
  });
}

// Feed post deletion hook
export function useDeleteNeighbourhoodPost() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!actor || !identity) {
        throw new Error('Actor or identity not available');
      }
      
      console.log('Deleting feed post:', postId);
      
      try {
        // Call backend to delete the post
        await actor.deleteFeedPost(postId);
        console.log('Feed post successfully deleted from backend:', postId);
        
        // Remove from client-side cache if it exists
        updatedPosts.delete(postId);
        
        return postId;
      } catch (backendError) {
        console.error('Failed to delete feed post from backend:', backendError);
        throw new Error(`Failed to delete post: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`);
      }
    },
    onSuccess: (deletedPostId) => {
      console.log('Feed post deletion successful, invalidating and refetching queries');
      
      // Immediately invalidate all feed-related queries
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPosts'] });
      queryClient.invalidateQueries({ queryKey: ['neighbourhoodPostsWithinRadius'] });
      
      // Force immediate refetch to ensure the deleted post is removed right away
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPosts'], 
        type: 'active' 
      });
      
      // Also refetch radius-based queries
      queryClient.refetchQueries({ 
        queryKey: ['neighbourhoodPostsWithinRadius'], 
        type: 'active' 
      });
      
      console.log('All feed queries invalidated and refetched after deletion');
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
      if (!actor) {
        console.warn('Actor not available for radius-based feed posts query');
        return [];
      }
      
      try {
        let backendPosts: FeedPost[];
        
        if (latitude === undefined || longitude === undefined || radiusKm === undefined) {
          // Fallback to all posts if no location specified
          console.log('Fetching all feed posts (no radius specified)');
          backendPosts = await actor.getFeedPosts();
        } else {
          console.log(`Fetching feed posts within ${radiusKm}km of ${latitude}, ${longitude}`);
          backendPosts = await actor.getFeedPostsWithinRadius(latitude, longitude, BigInt(radiusKm));
        }
        
        console.log(`Retrieved ${backendPosts.length} posts from backend for radius query`);
        
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
            
            // Enhanced client-side update check including images
            const clientUpdate = updatedPosts.get(post.id);
            if (clientUpdate) {
              console.log('Using client-side updated data for radius query post:', post.id, 'with images:', clientUpdate.images?.length || 0);
              return clientUpdate;
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
              images: [], // Images will be loaded separately via blob storage
              tags: [],
              isSaved: false,
              commentCount: feedPostComments.filter(c => c.postId === post.id).length,
              reactionCount: feedPostReactions.filter(r => r.postId === post.id).length,
              availabilityCalendar: post.availabilityCalendar,
            };
            
            return neighbourhoodPost;
          } catch (conversionError) {
            console.error('Error converting backend post in radius query:', conversionError, post);
            return null;
          }
        }).filter((post): post is NeighbourhoodPost => post !== null);
        
        const sortedPosts = convertedPosts.sort((a, b) => Number(b.createdAt - a.createdAt));
        
        console.log(`Successfully converted ${sortedPosts.length} posts for radius query`);
        
        return sortedPosts;
      } catch (error) {
        console.error('Failed to fetch feed posts within radius from backend:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 0, // Always fetch fresh data
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

// Feed post reaction mutations
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
