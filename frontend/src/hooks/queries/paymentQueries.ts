import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { Payment, StripeConfiguration } from '../../backend';

// Optimized query options
const defaultQueryOptions = {
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 15000),
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
};

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
