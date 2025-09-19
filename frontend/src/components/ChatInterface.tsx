import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Clock, Smile, Image as ImageIcon, X, ArrowLeft, User } from 'lucide-react';
import { Task, Message } from '../backend';
import { useGetMessagesForTask, useSendMessage, useGetCallerUserProfile, useGetUserProfiles } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useFileUpload } from '../blob-storage/FileStorage';
import { Principal } from '@dfinity/principal';

interface ChatInterfaceProps {
  task: Task;
  onBack?: () => void;
  isFromFeedPost?: boolean;
}

const EMOJI_LIST = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉', '🚀', '💯', '🔥', '✨', '👏', '🙌', '💪', '🤝', '✅', '❌', '⭐', '💡'];

interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

interface ExtendedMessage extends Message {
  reactions?: MessageReaction[];
  imageUrl?: string;
}

export default function ChatInterface({ task, onBack, isFromFeedPost = false }: ChatInterfaceProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: messages = [], isLoading } = useGetMessagesForTask(task.id);
  const sendMessage = useSendMessage();
  const { uploadFile, isUploading } = useFileUpload();
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isFirstMessage, setIsFirstMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock message reactions (in a real app, this would come from the backend)
  const [messageReactions, setMessageReactions] = useState<Map<string, MessageReaction[]>>(new Map());

  // Get unique user principals from messages AND always include task owner for immediate profile fetch
  const userPrincipals = useMemo(() => {
    const uniquePrincipals = new Set<string>();
    
    // Always include task owner for immediate display name lookup
    uniquePrincipals.add(task.requester.toString());
    
    // Include assigned tasker if available
    if (task.assignedTasker) {
      uniquePrincipals.add(task.assignedTasker.toString());
    }
    
    // Include all message participants
    messages.forEach(message => {
      uniquePrincipals.add(message.sender.toString());
      uniquePrincipals.add(message.recipient.toString());
    });
    
    return Array.from(uniquePrincipals).map(p => Principal.fromText(p));
  }, [messages, task.requester, task.assignedTasker]);

  // Fetch user profiles for all participants including task owner
  const { data: userProfiles = new Map() } = useGetUserProfiles(userPrincipals);

  // Check if this is the first message in a new thread
  useEffect(() => {
    setIsFirstMessage(messages.length === 0 && isFromFeedPost);
  }, [messages.length, isFromFeedPost]);

  // Set initial message for feed post conversations
  useEffect(() => {
    if (isFirstMessage && isFromFeedPost && !newMessage.trim()) {
      const authorName = getTaskOwnerDisplayName();
      setNewMessage(`Hi ${authorName}, I saw your post and wanted to reach out.`);
    }
  }, [isFirstMessage, isFromFeedPost]);

  // Determine the recipient for new messages
  const getMessageRecipient = () => {
    if (!identity) throw new Error('Not authenticated');
    
    const currentUserPrincipal = identity.getPrincipal().toString();
    const isCurrentUserTaskOwner = task.requester.toString() === currentUserPrincipal;
    
    if (isCurrentUserTaskOwner) {
      // Current user is task owner, send to assigned tasker if available, otherwise to the most recent message sender
      if (task.assignedTasker) {
        return task.assignedTasker;
      } else {
        // Find the most recent message from someone other than the current user
        const otherMessages = messages.filter(m => m.sender.toString() !== currentUserPrincipal);
        if (otherMessages.length > 0) {
          const mostRecentOtherMessage = otherMessages[otherMessages.length - 1];
          return mostRecentOtherMessage.sender;
        } else {
          // Fallback to task requester (shouldn't happen in this case)
          return task.requester;
        }
      }
    } else {
      // Current user is not task owner, send to task owner
      return task.requester;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImagePreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedImage) || !identity) return;

    let messageContent = newMessage.trim();
    let imageUrl = '';

    try {
      // Upload image if selected
      if (selectedImage) {
        const imagePath = `messages/${Date.now()}_${selectedImage.name}`;
        const { url } = await uploadFile(imagePath, selectedImage);
        imageUrl = url;
        
        // If no text message, use a placeholder
        if (!messageContent) {
          messageContent = '[Image]';
        }
      }

      const recipient = getMessageRecipient();

      const message: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId: task.id,
        sender: identity.getPrincipal(),
        recipient: recipient,
        content: imageUrl ? `${messageContent}|IMG:${imageUrl}` : messageContent,
        timestamp: BigInt(Date.now() * 1000000)
      };

      await sendMessage.mutateAsync(message);
      setNewMessage('');
      removeSelectedImage();
      setIsFirstMessage(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleMessageReaction = (messageId: string, emoji: string) => {
    if (!identity) return;

    const currentUserId = identity.getPrincipal().toString();
    const currentReactions = messageReactions.get(messageId) || [];
    
    // Find if this emoji already exists
    const existingReactionIndex = currentReactions.findIndex(r => r.emoji === emoji);
    
    if (existingReactionIndex >= 0) {
      // Toggle user's reaction
      const reaction = currentReactions[existingReactionIndex];
      const userIndex = reaction.users.indexOf(currentUserId);
      
      if (userIndex >= 0) {
        // Remove user's reaction
        reaction.users.splice(userIndex, 1);
        reaction.count = reaction.users.length;
        
        // Remove reaction if no users left
        if (reaction.count === 0) {
          currentReactions.splice(existingReactionIndex, 1);
        }
      } else {
        // Add user's reaction
        reaction.users.push(currentUserId);
        reaction.count = reaction.users.length;
      }
    } else {
      // Add new reaction
      currentReactions.push({
        emoji,
        users: [currentUserId],
        count: 1
      });
    }

    setMessageReactions(new Map(messageReactions.set(messageId, currentReactions)));
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const isMyMessage = (message: Message) => {
    return identity?.getPrincipal().toString() === message.sender.toString();
  };

  const getSenderName = (message: Message) => {
    if (isMyMessage(message)) return 'You';
    
    // Get display name from user profile, fallback to principal ID
    const senderPrincipal = message.sender.toString();
    const profile = userProfiles.get(senderPrincipal);
    
    if (profile?.displayName && profile.displayName.trim() !== '') {
      return profile.displayName;
    }
    
    if (profile?.name && profile.name.trim() !== '') {
      return profile.name;
    }
    
    // Fallback to principal ID
    return senderPrincipal;
  };

  const parseMessageContent = (content: string) => {
    const parts = content.split('|IMG:');
    return {
      text: parts[0] === '[Image]' ? '' : parts[0],
      imageUrl: parts[1] || null
    };
  };

  // Get the task owner's display name immediately when chat opens
  const getTaskOwnerDisplayName = () => {
    if (!identity) return 'Unknown';
    
    const currentUserPrincipal = identity.getPrincipal().toString();
    const taskOwnerPrincipal = task.requester.toString();
    
    // If current user is the task owner, show "You"
    if (taskOwnerPrincipal === currentUserPrincipal) {
      return 'You';
    }
    
    // Get task owner's profile and display name immediately
    const taskOwnerProfile = userProfiles.get(taskOwnerPrincipal);
    
    if (taskOwnerProfile?.displayName && taskOwnerProfile.displayName.trim() !== '') {
      return taskOwnerProfile.displayName;
    }
    
    if (taskOwnerProfile?.name && taskOwnerProfile.name.trim() !== '') {
      return taskOwnerProfile.name;
    }
    
    // Fallback to principal ID only if no display name is available
    return taskOwnerPrincipal;
  };

  const getOtherParticipantName = () => {
    if (!identity) return 'Unknown';
    
    const currentUserPrincipal = identity.getPrincipal().toString();
    const isRequester = task.requester.toString() === currentUserPrincipal;
    
    if (isRequester) {
      // Current user is the requester, show the tasker's display name
      if (task.assignedTasker) {
        const taskerPrincipal = task.assignedTasker.toString();
        const profile = userProfiles.get(taskerPrincipal);
        
        if (profile?.displayName && profile.displayName.trim() !== '') {
          return profile.displayName;
        }
        
        if (profile?.name && profile.name.trim() !== '') {
          return profile.name;
        }
        
        // Fallback to principal ID
        return taskerPrincipal;
      } else {
        // Find the most recent message from someone other than current user
        const otherMessages = messages.filter(m => m.sender.toString() !== currentUserPrincipal);
        if (otherMessages.length > 0) {
          const mostRecentOtherMessage = otherMessages[otherMessages.length - 1];
          const senderPrincipal = mostRecentOtherMessage.sender.toString();
          const profile = userProfiles.get(senderPrincipal);
          
          if (profile?.displayName && profile.displayName.trim() !== '') {
            return profile.displayName;
          }
          
          if (profile?.name && profile.name.trim() !== '') {
            return profile.name;
          }
          
          // Fallback to principal ID
          return senderPrincipal;
        }
        return 'Task participants';
      }
    } else {
      // Current user is not the requester, show the task owner's display name
      return getTaskOwnerDisplayName();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{task.title}</h3>
              <p className="text-gray-400 text-sm truncate">Loading...</p>
            </div>
          </div>
        </div>

        {/* Content with top padding for fixed header */}
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
            <p className="text-gray-400">Loading messages...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium truncate">{task.title}</h3>
              {isFromFeedPost && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-900/20 text-blue-400 border border-blue-500/30 rounded-full text-xs">
                  <User size={10} />
                  <span>Feed Post</span>
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm truncate">
              {getOtherParticipantName()}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area - Scrollable with padding for fixed header and input */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-24 pb-32">
        {/* Show welcome message for new feed post conversations */}
        {isFirstMessage && isFromFeedPost && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <User size={16} />
              <span className="font-medium">New Conversation</span>
            </div>
            <p className="text-gray-300 text-sm">
              You're starting a new conversation with {getTaskOwnerDisplayName()} about their feed post. 
              This message thread will be saved and you can continue the conversation anytime.
            </p>
          </div>
        )}

        {messages.length === 0 && !isFirstMessage ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">No messages yet</p>
            <p className="text-gray-500 text-sm">
              {isFromFeedPost 
                ? 'Start the conversation about this feed post'
                : 'Start the conversation about this task'
              }
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const { text, imageUrl } = parseMessageContent(message.content);
            const reactions = messageReactions.get(message.id) || [];
            
            return (
              <div
                key={message.id}
                className={`flex ${isMyMessage(message) ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-xs lg:max-w-md">
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      isMyMessage(message)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium opacity-75">
                        {getSenderName(message)}
                      </span>
                      <div className="flex items-center gap-1 text-xs opacity-60">
                        <Clock size={10} />
                        <span>{formatTimestamp(message.timestamp)}</span>
                      </div>
                    </div>
                    
                    {imageUrl && (
                      <div className="mb-2">
                        <img
                          src={imageUrl}
                          alt="Shared image"
                          className="max-w-full h-auto rounded-lg border border-gray-600"
                          style={{ maxHeight: '200px' }}
                        />
                      </div>
                    )}
                    
                    {text && (
                      <p className="text-sm leading-relaxed break-words">
                        {text}
                      </p>
                    )}
                  </div>
                  
                  {/* Message Reactions */}
                  {reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 px-2">
                      {reactions.map((reaction, index) => (
                        <button
                          key={index}
                          onClick={() => handleMessageReaction(message.id, reaction.emoji)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                            reaction.users.includes(identity?.getPrincipal().toString() || '')
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Quick Reaction Buttons */}
                  <div className="flex gap-1 mt-1 px-2 opacity-0 hover:opacity-100 transition-opacity">
                    {['👍', '❤️', '😂'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleMessageReaction(message.id, emoji)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-500 text-xs transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Message Input at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-50">
        <div className="max-w-4xl mx-auto">
          {/* Image Preview */}
          {imagePreview && (
            <div className="mb-3 relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-20 w-20 object-cover rounded-lg border border-gray-600"
              />
              <button
                onClick={removeSelectedImage}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={isFromFeedPost ? "Start your conversation..." : "Type your message..."}
                rows={1}
                className="w-full px-4 py-3 pr-20 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none max-h-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                style={{
                  minHeight: '48px',
                  height: 'auto'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              
              {/* Input Actions */}
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-600"
                >
                  <Smile size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-600"
                >
                  <ImageIcon size={16} />
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedImage) || sendMessage.isPending || isUploading}
              className="px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
              style={{ minHeight: '48px' }}
            >
              {sendMessage.isPending || isUploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-700 border border-gray-600 rounded-lg p-3 max-w-4xl mx-auto">
              <div className="grid grid-cols-10 gap-2 max-h-32 overflow-y-auto">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="p-2 hover:bg-gray-600 rounded-lg transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
