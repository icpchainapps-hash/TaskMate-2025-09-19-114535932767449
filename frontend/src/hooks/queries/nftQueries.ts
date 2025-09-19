import { useQuery } from '@tanstack/react-query';
import { useActor } from '../useActor';
import { useGetPayments, useGetTasks } from './index';

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
