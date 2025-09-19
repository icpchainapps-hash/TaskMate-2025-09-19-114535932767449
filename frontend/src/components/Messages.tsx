import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, Clock, Archive, ArchiveRestore, ArrowLeft, AlertCircle, User, Plus } from 'lucide-react';
import { useGetMessageThreads, useGetTasks, useMarkMessageNotificationsAsRead, useGetUnreadMessageCount, useArchiveMessageThreadOnly, useUnarchiveMessageThreadOnly, useGetUserProfiles, useSendMessage, useGetOrCreateFeedPostMessageThread } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Task, Message } from '../backend';
import { Principal } from '@dfinity/principal';
import ChatInterface from './ChatInterface';

interface MessagesProps {
  selectedTaskId?: string | null;
  selectedAuthor?: { principal: string; name: string } | null;
  onTaskSelected?: (taskId: string | null) => void;
  onAuthorSelected?: (author: { principal: string; name: string } | null) => void;
  onChatModeChange?: (inChatMode: boolean) => void;
}

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

export default function Messages({ 
  selectedTaskId, 
  selectedAuthor,
  onTaskSelected, 
  onAuthorSelected,
  onChatModeChange 
}: MessagesProps) {
  const { identity } = useInternetIdentity();
  const { data: allThreads = [], isLoading } = useGetMessageThreads();
  const { data: allTasks = [] } = useGetTasks();
  const { data: unreadMessageCount = 0 } = useGetUnreadMessageCount();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const markMessageNotificationsAsRead = useMarkMessageNotificationsAsRead();
  const archiveThread = useArchiveMessageThreadOnly();
  const unarchiveThread = useUnarchiveMessageThreadOnly();
  const sendMessage = useSendMessage();
  const getOrCreateFeedPostThread = useGetOrCreateFeedPostMessageThread();

  // Separate regular task threads from feed post threads
  const { taskThreads, feedPostThreads } = useMemo(() => {
    const taskThreads: MessageThread[] = [];
    const feedPostThreads: FeedPostMessageThread[] = [];
    
    allThreads.forEach(thread => {
      if ('task' in thread) {
        taskThreads.push(thread as MessageThread);
      } else {
        feedPostThreads.push(thread as FeedPostMessageThread);
      }
    });
    
    return { taskThreads, feedPostThreads };
  }, [allThreads]);

  const threads = useMemo(() => {
    if (!identity) return [];
    
    const filteredTaskThreads = taskThreads.filter(({ isMessageThreadArchived, task }) => {
      if (showArchived) {
        return isMessageThreadArchived;
      } else {
        return !isMessageThreadArchived && !task.isArchived;
      }
    });

    const filteredFeedPostThreads = feedPostThreads.filter(({ isArchived }) => {
      return showArchived ? isArchived : !isArchived;
    });
    
    return [...filteredTaskThreads, ...filteredFeedPostThreads];
  }, [taskThreads, feedPostThreads, identity, showArchived]);

  const userPrincipals = useMemo(() => {
    const uniquePrincipals = new Set<string>();
    threads.forEach((thread) => {
      if ('task' in thread) {
        const { task, lastMessage } = thread;
        uniquePrincipals.add(task.requester.toString());
        if (task.assignedTasker) {
          uniquePrincipals.add(task.assignedTasker.toString());
        }
        if (lastMessage) {
          uniquePrincipals.add(lastMessage.sender.toString());
          uniquePrincipals.add(lastMessage.recipient.toString());
        }
      } else {
        uniquePrincipals.add(thread.authorPrincipal);
      }
    });
    
    // Add selected author if provided
    if (selectedAuthor) {
      uniquePrincipals.add(selectedAuthor.principal);
    }
    
    return Array.from(uniquePrincipals).map(p => Principal.fromText(p));
  }, [threads, selectedAuthor]);

  const { data: userProfiles = new Map() } = useGetUserProfiles(userPrincipals);

  // Fixed navigation from feed posts to start new message thread with immediate availability
  useEffect(() => {
    if (selectedAuthor && identity) {
      console.log('Creating or retrieving feed post message thread for author:', selectedAuthor);
      
      // Use the fixed get or create function for immediate availability
      getOrCreateFeedPostThread.mutate({
        authorPrincipal: selectedAuthor.principal,
        authorName: selectedAuthor.name
      }, {
        onSuccess: ({ threadId, isNew }) => {
          console.log('Feed post message thread ready:', threadId, 'isNew:', isNew);
          
          // Create a mock task for the conversation with the thread ID
          const mockTask: Task = {
            id: threadId,
            title: `Message with ${selectedAuthor.name}`,
            description: 'Feed post conversation',
            category: 'Communication',
            taskType: 'volunteer' as any,
            budget: BigInt(0),
            dueDate: BigInt(Date.now() * 1000000),
            requiredSkills: [],
            status: 'open' as any,
            requester: Principal.fromText(selectedAuthor.principal),
            assignedTasker: identity.getPrincipal(),
            createdAt: BigInt(Date.now() * 1000000),
            images: [],
            isArchived: false,
            address: '',
            latitude: 0,
            longitude: 0,
            availabilityCalendar: {
              availableDates: [],
              timeSlots: [],
              durationMinutes: BigInt(60),
              intervalMinutes: BigInt(30)
            }
          };
          
          console.log('Setting selected task to mock task for feed post conversation');
          setSelectedTask(mockTask);
          
          // Clear the selected author after setting up the chat
          if (onAuthorSelected) {
            onAuthorSelected(null);
          }
        },
        onError: (error) => {
          console.error('Failed to get or create feed post message thread:', error);
          // Clear the selected author on error
          if (onAuthorSelected) {
            onAuthorSelected(null);
          }
        }
      });
    }
  }, [selectedAuthor, identity, onAuthorSelected, getOrCreateFeedPostThread]);

  useEffect(() => {
    if (selectedTaskId) {
      const task = allTasks.find(t => t.id === selectedTaskId);
      if (task) {
        setSelectedTask(task);
        markMessageNotificationsAsRead.mutate(selectedTaskId);
        
        if (onTaskSelected) {
          onTaskSelected(null);
        }
      } else {
        setSelectedTask(null);
        if (onTaskSelected) {
          onTaskSelected(null);
        }
      }
    }
  }, [selectedTaskId, allTasks, onTaskSelected, markMessageNotificationsAsRead]);

  useEffect(() => {
    if (onChatModeChange) {
      onChatModeChange(!!selectedTask);
    }
  }, [selectedTask, onChatModeChange]);

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

  const truncateMessage = (content: string, maxLength: number = 50) => {
    if (content.includes('|IMG:') || content === '[Image]') {
      return 'Photo';
    }
    
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getOtherParticipantName = (thread: MessageThread | FeedPostMessageThread) => {
    if (!identity) return 'Unknown';
    
    if ('task' in thread) {
      // Regular task thread
      const { task } = thread;
      const currentUserPrincipal = identity.getPrincipal().toString();
      const isRequester = task.requester.toString() === currentUserPrincipal;
      
      if (isRequester) {
        if (task.assignedTasker) {
          const taskerPrincipal = task.assignedTasker.toString();
          const profile = userProfiles.get(taskerPrincipal);
          
          if (profile?.displayName && profile.displayName.trim() !== '') {
            return profile.displayName;
          }
          
          if (profile?.name && profile.name.trim() !== '') {
            return profile.name;
          }
          
          return taskerPrincipal;
        } else {
          return 'Task participants';
        }
      } else {
        const requesterPrincipal = task.requester.toString();
        const profile = userProfiles.get(requesterPrincipal);
        
        if (profile?.displayName && profile.displayName.trim() !== '') {
          return profile.displayName;
        }
        
        if (profile?.name && profile.name.trim() !== '') {
          return profile.name;
        }
        
        return requesterPrincipal;
      }
    } else {
      // Feed post thread
      return thread.authorName;
    }
  };

  const handleBackToThreads = () => {
    setSelectedTask(null);
  };

  const handleThreadClick = (thread: MessageThread | FeedPostMessageThread) => {
    if ('task' in thread) {
      // Regular task thread
      setSelectedTask(thread.task);
      markMessageNotificationsAsRead.mutate(thread.task.id);
    } else {
      // Feed post thread - create mock task with the correct thread ID
      const mockTask: Task = {
        id: thread.id, // Use the actual thread ID
        title: `Message with ${thread.authorName}`,
        description: 'Feed post conversation',
        category: 'Communication',
        taskType: 'volunteer' as any,
        budget: BigInt(0),
        dueDate: BigInt(Date.now() * 1000000),
        requiredSkills: [],
        status: 'open' as any,
        requester: Principal.fromText(thread.authorPrincipal),
        assignedTasker: identity?.getPrincipal(),
        createdAt: BigInt(Date.now() * 1000000),
        images: [],
        isArchived: false,
        address: '',
        latitude: 0,
        longitude: 0,
        availabilityCalendar: {
          availableDates: [],
          timeSlots: [],
          durationMinutes: BigInt(60),
          intervalMinutes: BigInt(30)
        }
      };
      
      console.log('Opening feed post message thread:', thread.id);
      setSelectedTask(mockTask);
    }
  };

  const handleArchiveThread = async (thread: MessageThread | FeedPostMessageThread, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!identity) return;
    
    try {
      const threadId = 'task' in thread ? thread.task.id : thread.id;
      await archiveThread.mutateAsync(threadId);
    } catch (error) {
      console.error('Failed to archive message thread:', error);
    }
  };

  const handleUnarchiveThread = async (thread: MessageThread | FeedPostMessageThread, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!identity) return;
    
    try {
      const threadId = 'task' in thread ? thread.task.id : thread.id;
      await unarchiveThread.mutateAsync(threadId);
    } catch (error) {
      console.error('Failed to unarchive message thread:', error);
    }
  };

  const canArchiveThread = (thread: MessageThread | FeedPostMessageThread) => {
    if (!identity) return false;
    
    if ('task' in thread) {
      const { task } = thread;
      if (task.isArchived) return false;
      
      const currentUserPrincipal = identity.getPrincipal().toString();
      const isTaskOwner = task.requester.toString() === currentUserPrincipal;
      const isAssignedTasker = task.assignedTasker?.toString() === currentUserPrincipal;
      
      return isTaskOwner || isAssignedTasker;
    } else {
      // Feed post threads can always be archived by participants
      return true;
    }
  };

  if (selectedTask) {
    return (
      <ChatInterface 
        task={selectedTask} 
        onBack={handleBackToThreads}
        isFromFeedPost={selectedTask.id.startsWith('feed_message_')}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Messages</h2>
          <p className="text-gray-400">Task conversations</p>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="flex justify-between items-start mb-2">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-700 rounded w-12"></div>
              </div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-white">Messages</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                showArchived
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {showArchived ? (
                <>
                  <ArrowLeft size={16} />
                  <span>Back to Messages</span>
                </>
              ) : (
                <>
                  <Archive size={16} />
                  <span>Archived</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-gray-400">
            {showArchived ? 'Archived conversations' : 'Task conversations'}
          </p>
          {!showArchived && unreadMessageCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              {unreadMessageCount} unread
            </span>
          )}
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 text-lg mb-2">
            {showArchived ? 'No archived conversations' : 'No conversations yet'}
          </p>
          <p className="text-gray-500 text-sm">
            {showArchived 
              ? 'Archived conversations will appear here'
              : 'Messages will appear here when you start communicating about tasks or with feed post authors'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const threadId = 'task' in thread ? thread.task.id : thread.id;
            const isArchived = 'task' in thread ? thread.isMessageThreadArchived : thread.isArchived;
            const lastMessage = thread.lastMessage;
            const title = 'task' in thread ? thread.task.title : `Message with ${thread.authorName}`;
            
            return (
              <div
                key={threadId}
                onClick={() => handleThreadClick(thread)}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
              >
                {isArchived && (
                  <div className="flex items-center gap-2 mb-2">
                    <Archive size={16} className="text-orange-500" />
                    <span className="text-orange-400 text-sm font-medium">Archived Message Thread</span>
                  </div>
                )}

                {/* Show special indicator for feed post conversations */}
                {threadId.startsWith('feed_message_') && (
                  <div className="flex items-center gap-2 mb-2">
                    <User size={16} className="text-blue-500" />
                    <span className="text-blue-400 text-sm font-medium">Feed Post Conversation</span>
                  </div>
                )}

                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-white font-medium truncate flex-1 mr-2">
                    {title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {lastMessage && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Clock size={12} />
                        <span>{formatTimestamp(lastMessage.timestamp)}</span>
                      </div>
                    )}
                    {canArchiveThread(thread) && (
                      <button
                        onClick={showArchived 
                          ? (e) => handleUnarchiveThread(thread, e)
                          : (e) => handleArchiveThread(thread, e)
                        }
                        disabled={archiveThread.isPending || unarchiveThread.isPending}
                        className="p-1 text-gray-400 hover:text-orange-400 transition-colors rounded"
                        title={showArchived ? "Unarchive conversation" : "Archive conversation"}
                      >
                        {archiveThread.isPending || unarchiveThread.isPending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                        ) : showArchived ? (
                          <ArchiveRestore size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-400 text-sm mb-2">
                  {getOtherParticipantName(thread)}
                </p>
                
                {lastMessage && (
                  <div className="flex justify-between items-center">
                    <p className="text-gray-300 text-sm flex-1 mr-2">
                      {truncateMessage(lastMessage.content)}
                    </p>
                  </div>
                )}

                {'task' in thread && thread.task.isArchived && (
                  <div className="pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                      <AlertCircle size={16} />
                      <span>Task is archived - unarchive the task to restore this conversation</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
