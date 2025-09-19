import React from 'react';
import { useGetTaskReactions, useGetUserProfiles } from '../hooks/useQueries';
import { Principal } from '@dfinity/principal';

interface TaskReactionsDisplayProps {
  taskId: string;
}

export default function TaskReactionsDisplay({ taskId }: TaskReactionsDisplayProps) {
  const { data: reactions = [], isLoading, error } = useGetTaskReactions(taskId);

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

  // Group reactions by exact emoji from backend with zero modification
  const reactionGroups = React.useMemo(() => {
    const groups: Record<string, { emoji: string; count: number; users: string[]; userNames: string[] }> = {};
    
    reactions.forEach(reaction => {
      // Use the exact emoji string from backend without any processing
      const emojiKey = reaction.emoji;
      
      if (!groups[emojiKey]) {
        groups[emojiKey] = {
          emoji: emojiKey, // Store exact backend emoji
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-pulse bg-gray-600 rounded-full h-6 w-12"></div>
        <div className="animate-pulse bg-gray-600 rounded-full h-6 w-12"></div>
        <div className="animate-pulse bg-gray-600 rounded-full h-6 w-12"></div>
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

  if (reactions.length === 0) {
    return (
      <div className="text-gray-400 text-sm">
        No reactions yet
      </div>
    );
  }

  // Get all emojis sorted by count
  const sortedEmojis = Object.values(reactionGroups)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-wrap gap-2">
      {sortedEmojis.map(({ emoji, count, userNames }) => (
        <div
          key={emoji}
          className="flex items-center gap-1 px-2 py-1 bg-gray-600 rounded-full text-sm text-gray-300"
          title={`${userNames.join(', ')} reacted with ${emoji}`}
        >
          <span className="text-base">{emoji}</span>
          <span className="font-medium">{count}</span>
        </div>
      ))}
    </div>
  );
}
