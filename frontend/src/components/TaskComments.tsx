import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Send, MessageSquare, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useGetTaskComments, useAddTaskComment, useGetCallerUserProfile, useGetUserProfiles } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Principal } from '@dfinity/principal';
import type { Comment } from '../backend';

interface TaskCommentsProps {
  taskId: string;
  compact?: boolean;
  onToggleExpand?: () => void;
  highlightCommentId?: string;
}

export default function TaskComments({ taskId, compact = false, onToggleExpand, highlightCommentId }: TaskCommentsProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: comments = [], isLoading, error } = useGetTaskComments(taskId);
  const addComment = useAddTaskComment();
  const [newComment, setNewComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const highlightedCommentRef = useRef<HTMLDivElement>(null);

  // Get unique user principals from comments for profile lookup
  const userPrincipals = useMemo(() => {
    const uniquePrincipals = new Set<string>();
    comments.forEach(comment => {
      uniquePrincipals.add(comment.userId.toString());
    });
    return Array.from(uniquePrincipals).map(p => Principal.fromText(p));
  }, [comments]);

  // Fetch user profiles for all comment authors
  const { data: userProfiles = new Map() } = useGetUserProfiles(userPrincipals);

  useEffect(() => {
    if (highlightCommentId && highlightedCommentRef.current && !compact) {
      setTimeout(() => {
        highlightedCommentRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        highlightedCommentRef.current?.classList.add('highlight-comment');
        setTimeout(() => {
          highlightedCommentRef.current?.classList.remove('highlight-comment');
        }, 2000);
      }, 500);
    }
  }, [highlightCommentId, comments, compact]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !identity || !userProfile) return;

    setSubmitError(null);

    try {
      await addComment.mutateAsync({
        taskId,
        text: newComment.trim()
      });
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save comment. Please try again.';
      setSubmitError(errorMessage);
    }
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const getUserDisplayName = (userPrincipal: string) => {
    if (identity && userPrincipal === identity.getPrincipal().toString()) {
      return 'You';
    }
    
    // Get display name from user profile, fallback to principal ID
    const profile = userProfiles.get(userPrincipal);
    
    if (profile?.displayName && profile.displayName.trim() !== '') {
      return profile.displayName;
    }
    
    if (profile?.name && profile.name.trim() !== '') {
      return profile.name;
    }
    
    // Final fallback to principal ID
    return userPrincipal;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse bg-gray-700 rounded-lg p-3 h-12"></div>
        {!compact && <div className="animate-pulse bg-gray-700 rounded-lg p-3 h-12"></div>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-2 text-red-400">
        <AlertCircle size={16} className="mx-auto mb-1" />
        <p className="text-xs">Failed to load comments</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MessageSquare size={14} />
            <span>{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
          </div>
          {comments.length > 0 && onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span>View all</span>
              <ChevronDown size={12} />
            </button>
          )}
        </div>

        {comments.length > 0 && (
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white">
                {getUserDisplayName(comments[comments.length - 1].userId.toString())}
              </span>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={10} />
                <span>{formatTimestamp(comments[comments.length - 1].timestamp)}</span>
              </div>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed break-words line-clamp-2">
              {comments[comments.length - 1].text}
            </p>
          </div>
        )}

        {identity && userProfile && (
          <form onSubmit={handleSubmitComment} className="space-y-2">
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || addComment.isPending}
                className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
              >
                {addComment.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            
            {submitError && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle size={12} />
                <span>{submitError}</span>
              </div>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-gray-400" />
          <h4 className="text-lg font-medium text-white">
            Comments ({comments.length})
          </h4>
        </div>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <span>Collapse</span>
            <ChevronUp size={16} />
          </button>
        )}
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment on this task</p>
          </div>
        ) : (
          comments
            .sort((a, b) => Number(a.timestamp - b.timestamp))
            .map((comment) => (
              <div 
                key={comment.id} 
                ref={comment.id === highlightCommentId ? highlightedCommentRef : null}
                className={`bg-gray-700 rounded-lg p-4 transition-all duration-300 ${
                  comment.id === highlightCommentId ? 'ring-2 ring-orange-500 bg-orange-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {getUserDisplayName(comment.userId.toString())}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{formatTimestamp(comment.timestamp)}</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed break-words">
                  {comment.text}
                </p>
              </div>
            ))
        )}
      </div>

      {identity && userProfile ? (
        <form onSubmit={handleSubmitComment} className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
          
          {submitError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newComment.trim() || addComment.isPending}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {addComment.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send size={16} />
              )}
              <span>
                {addComment.isPending ? 'Saving...' : 'Comment'}
              </span>
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 text-gray-400">
          <p className="text-sm">Please log in to add comments</p>
        </div>
      )}
    </div>
  );
}
