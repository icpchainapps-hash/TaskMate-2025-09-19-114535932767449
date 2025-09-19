import React, { useState } from 'react';
import { useGetFeedPostReactions, useAddFeedPostReaction, useRemoveFeedPostReaction, useGetCallerUserProfile, useGetUserProfiles } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { FeedPostReaction } from '../hooks/useQueries';
import { Principal } from '@dfinity/principal';

interface FeedPostReactionsProps {
  postId: string;
  compact?: boolean;
}

const AVAILABLE_EMOJIS = ['👍', '❤️', '🚀', '🎉', '👏', '🔥'];

export default function FeedPostReactions({ postId, compact = false }: FeedPostReactionsProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: reactions = [], isLoading, error, refetch } = useGetFeedPostReactions(postId);
  const addReaction = useAddFeedPostReaction();
  const removeReaction = useRemoveFeedPostReaction();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
          await removeReaction.mutateAsync({ postId });
        } else {
          await removeReaction.mutateAsync({ postId });
          setTimeout(async () => {
            await addReaction.mutateAsync({ postId, emoji });
          }, 100);
        }
      } else {
        await addReaction.mutateAsync({ postId, emoji });
      }
      
      setTimeout(() => {
        refetch();
      }, 200);
      
    } catch (error) {
      console.error('Failed to update reaction:', error);
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-pulse bg-gray-700 rounded-full h-6 w-12"></div>
        <div className="animate-pulse bg-gray-700 rounded-full h-6 w-12"></div>
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
    
    if (totalReactions === 0) {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker(!showEmojiPicker);
            }}
            disabled={!identity}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded-full text-sm transition-colors disabled:cursor-not-allowed"
          >
            <span>👍</span>
            <span className="text-xs">React</span>
          </button>
          
          {showEmojiPicker && identity && (
            <div className="absolute z-10 bg-gray-800 border border-gray-600 rounded-lg p-2 shadow-lg">
              <div className="flex gap-1">
                {AVAILABLE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReactionClick(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    const topEmojis = Object.values(reactionGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          {topEmojis.map(({ emoji, count, userNames }) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                handleReactionClick(emoji);
              }}
              disabled={!identity}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors disabled:cursor-not-allowed ${
                currentUserReaction?.emoji === emoji
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={`${userNames.join(', ')} reacted with ${emoji}`}
            >
              <span>{emoji}</span>
              <span className="font-medium">{count}</span>
            </button>
          ))}
        </div>
        
        {!currentUserReaction && identity && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full text-sm transition-colors"
            >
              <span>+</span>
            </button>
            
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-10 bg-gray-800 border border-gray-600 rounded-lg p-2 shadow-lg">
                <div className="flex gap-1">
                  {AVAILABLE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactionClick(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          <p className="text-sm">Please log in to react to posts</p>
        </div>
      )}
    </div>
  );
}
