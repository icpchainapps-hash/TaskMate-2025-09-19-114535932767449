import { useQuery } from '@tanstack/react-query';
import { useActor } from '../useActor';

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