import React from 'react';
import { useGetTaskReactions, useAddTaskReaction, useRemoveTaskReaction, useGetCallerUserProfile, useGetUserProfiles } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import type { Reaction } from '../backend';
import { Principal } from '@dfinity/principal';

interface TaskReactionsProps {
  taskId: string;
  compact?: boolean;
}

const AVAILABLE_EMOJIS = ['👍', '❤️', '🚀', '🎉', '👏', '🔥'];

export default function TaskReactions({ taskId, compact = false }: TaskReactionsProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: reactions = [], isLoading, error, refetch } = useGetTaskReactions(taskId);
  const addReaction = useAddTaskReaction();
  const removeReaction = useRemoveTaskReaction();

  // Get unique user principals from reactions
  const userPrincipals = React.useMemo(() => {
    const uniquePrincipals = new Set<string>();
    reactions.forEach(reaction => {
      uniquePrincipals.add(reaction.userId.toString());
    });
    return Array.from(uniquePrincipals).map(p => Principal.fromText(p));
  }, [reactions]);

  // Fetch user profiles for all reaction users
  const { data: userProfiles = new Map() } = useGetUserProfiles(userPrincipals);

  const currentUserReaction = React.useMemo(() => {
    if (!identity) return null;
    const userPrincipalString = identity.getPrincipal().toString();
    return reactions.find(reaction => 
      reaction.userId.toString() === userPrincipalString
    ) || null;
  }, [reactions, identity]);

  const reactionGroups = React.useMemo(() => {
    const groups: Record<string, { emoji: string; count: number; users: string[]; userNames: string[] }> = {};
    
    reactions.forEach(reaction => {
      const emojiKey = reaction.emoji;
      
      if (!groups[emojiKey]) {
        groups[emojiKey] = {
          emoji: emojiKey,
          count: 0,
          users: [],
          userNames: []
        };
      }
      
      groups[emojiKey].count++;
      groups[emojiKey].users.push(reaction.userId.toString());
      
      // Get display name for this user
      const userPrincipal = reaction.userId.toString();
      const profile = userProfiles.get(userPrincipal);
      const displayName = profile?.name || `${userPrincipal.slice(0, 8)}...`;
      groups[emojiKey].userNames.push(displayName);
    });
    
    return groups;
  }, [reactions, userProfiles]);

  const handleReactionClick = async (emoji: string) => {
    if (!identity || !userProfile) return;

    try {
      if (currentUserReaction) {
        if (currentUserReaction.emoji === emoji) {
          await removeReaction.mutateAsync({ taskId });
        } else {
          await removeReaction.mutateAsync({ taskId });
          setTimeout(async () => {
            await addReaction.mutateAsync({ taskId, emoji });
          }, 100);
        }
      } else {
        await addReaction.mutateAsync({ taskId, emoji });
      }
      
      setTimeout(() => {
        refetch();
      }, 200);
      
    } catch (error) {
      console.error('Failed to update reaction:', error);
      refetch();
    }
  };

  const getUserDisplayName = (userPrincipal: string) => {
    if (identity && userPrincipal === identity.getPrincipal().toString()) {
      return userProfile?.name || 'You';
    }
    
    const profile = userProfiles.get(userPrincipal);
    if (profile?.name) {
      return profile.name;
    }
    
    return `${userPrincipal.slice(0, 8)}...`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-pulse bg-gray-700 rounded-full h-8 w-16"></div>
        <div className="animate-pulse bg-gray-700 rounded-full h-8 w-16"></div>
        <div className="animate-pulse bg-gray-700 rounded-full h-8 w-16"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        Failed to load reactions
      </div>
    );
  }

  if (compact) {
    const totalReactions = reactions.length;
    
    if (totalReactions === 0) return null;

    const topEmojis = Object.values(reactionGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          {topEmojis.map(({ emoji, count, userNames }) => (
            <span 
              key={emoji} 
              className="flex items-center gap-1"
              title={`${userNames.join(', ')} reacted with ${emoji}`}
            >
              <span>{emoji}</span>
              <span className="text-gray-400">{count}</span>
            </span>
          ))}
        </div>
        {totalReactions > 0 && (
          <span className="text-gray-500 text-xs">
            {totalReactions} reaction{totalReactions !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-white flex items-center gap-2">
        <span>Reactions</span>
        {reactions.length > 0 && (
          <span className="text-sm text-gray-400">({reactions.length})</span>
        )}
      </h4>

      <div className="flex flex-wrap gap-2">
        {AVAILABLE_EMOJIS.map((emoji) => {
          const group = reactionGroups[emoji];
          const count = group?.count || 0;
          const userNames = group?.userNames || [];
          const hasCurrentUserReaction = currentUserReaction?.emoji === emoji;

          return (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              disabled={!identity || addReaction.isPending || removeReaction.isPending}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                hasCurrentUserReaction
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={count > 0 ? `${userNames.join(', ')} reacted with ${emoji}` : `React with ${emoji}`}
            >
              <span className="text-base">{emoji}</span>
              {count > 0 && <span className="font-medium">{count}</span>}
            </button>
          );
        })}
      </div>

      {Object.keys(reactionGroups).some(emoji => !AVAILABLE_EMOJIS.includes(emoji)) && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(reactionGroups)
            .filter(([emoji]) => !AVAILABLE_EMOJIS.includes(emoji))
            .map(([emoji, group]) => {
              const hasCurrentUserReaction = currentUserReaction?.emoji === emoji;
              
              return (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  disabled={!identity || addReaction.isPending || removeReaction.isPending}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    hasCurrentUserReaction
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  title={`${group.userNames.join(', ')} reacted with ${emoji}`}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="font-medium">{group.count}</span>
                </button>
              );
            })}
        </div>
      )}

      {!identity && (
        <div className="text-center py-2 text-gray-400">
          <p className="text-sm">Please log in to react to tasks</p>
        </div>
      )}
    </div>
  );
}
