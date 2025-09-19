import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { useInternetIdentity } from '../useInternetIdentity';
import { UserProfile, PoliceCheckStatus, Accreditation } from '../../backend';
import { Principal } from '@dfinity/principal';

// Optimized query options
const defaultQueryOptions = {
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 15000),
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
};

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
      const BATCH_SIZE = 3; // Reduced batch size for better performance
      
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
