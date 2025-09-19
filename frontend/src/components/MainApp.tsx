import React, { useState, Suspense, lazy } from 'react';
import { Search, Plus, MessageCircle, Home, Bell, Users } from 'lucide-react';
import LoginButton from './LoginButton';
import UserIcon from './UserIcon';
import { useGetNotifications, useGetTasks, useGetUnreadMessageCount } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

// Lazy load major screens and heavy components
const BrowseTasks = lazy(() => import('./BrowseTasks'));
const MyBoard = lazy(() => import('./MyBoard'));
const Messages = lazy(() => import('./Messages'));
const MyNFTs = lazy(() => import('./MyNFTs'));
const Feed = lazy(() => import('./Feed'));
const Profile = lazy(() => import('./Profile'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const NotificationsPanel = lazy(() => import('./NotificationsPanel'));
const TaskDetailModal = lazy(() => import('./TaskDetailModal'));

type Tab = 'feed' | 'browse' | 'myboard' | 'messages' | 'profile' | 'admin' | 'nfts';

// Loading component for lazy-loaded screens
const ScreenLoader = () => (
  <div className="p-4 flex items-center justify-center min-h-[50vh]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  </div>
);

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('feed'); // Changed default to feed
  const [selectedTaskForChat, setSelectedTaskForChat] = useState<string | null>(null);
  const [selectedAuthorForChat, setSelectedAuthorForChat] = useState<{
    principal: string;
    name: string;
  } | null>(null);
  const [isInChatMode, setIsInChatMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [taskDetailModal, setTaskDetailModal] = useState<{
    taskId: string;
    commentId?: string;
  } | null>(null);

  const { identity } = useInternetIdentity();
  const { data: notifications = [] } = useGetNotifications();
  const { data: tasks = [] } = useGetTasks();
  const { data: unreadMessageCount = 0 } = useGetUnreadMessageCount();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMessageOwnerClick = (taskId: string) => {
    setSelectedTaskForChat(taskId);
    setSelectedAuthorForChat(null);
    setActiveTab('messages');
  };

  // New handler for feed post messaging
  const handleFeedPostMessageAuthor = (authorPrincipal: string, authorName: string) => {
    setSelectedAuthorForChat({
      principal: authorPrincipal,
      name: authorName
    });
    setSelectedTaskForChat(null);
    setActiveTab('messages');
  };

  const handleTaskSelected = (taskId: string | null) => {
    setSelectedTaskForChat(taskId);
  };

  const handleAuthorSelected = (author: { principal: string; name: string } | null) => {
    setSelectedAuthorForChat(author);
  };

  const handleChatModeChange = (inChatMode: boolean) => {
    setIsInChatMode(inChatMode);
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleProfileClick = () => {
    setActiveTab('profile');
    setShowNotifications(false);
  };

  const handleAdminClick = () => {
    setActiveTab('admin');
    setShowNotifications(false);
  };

  const handleNFTsClick = () => {
    // Navigate to NFTs screen instead of setting tab
    setActiveTab('nfts');
    setShowNotifications(false);
  };

  const handleNavigateToTask = (taskId: string, commentId?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setTaskDetailModal({ taskId, commentId });
      setShowNotifications(false);
    }
  };

  const handleNavigateToChat = (taskId: string) => {
    setSelectedTaskForChat(taskId);
    setSelectedAuthorForChat(null);
    setActiveTab('messages');
    setShowNotifications(false);
  };

  const renderContent = () => {
    if (showNotifications) {
      return (
        <Suspense fallback={<ScreenLoader />}>
          <NotificationsPanel 
            onClose={() => setShowNotifications(false)} 
            onNavigateToTask={handleNavigateToTask}
            onNavigateToChat={handleNavigateToChat}
          />
        </Suspense>
      );
    }

    switch (activeTab) {
      case 'feed':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <Feed onNavigateToMessages={handleFeedPostMessageAuthor} />
          </Suspense>
        );
      case 'browse':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <BrowseTasks onMessageOwnerClick={handleMessageOwnerClick} />
          </Suspense>
        );
      case 'myboard':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <MyBoard />
          </Suspense>
        );
      case 'messages':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <Messages 
              selectedTaskId={selectedTaskForChat} 
              selectedAuthor={selectedAuthorForChat}
              onTaskSelected={handleTaskSelected}
              onAuthorSelected={handleAuthorSelected}
              onChatModeChange={handleChatModeChange}
            />
          </Suspense>
        );
      case 'nfts':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <MyNFTs />
          </Suspense>
        );
      case 'profile':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <Profile />
          </Suspense>
        );
      case 'admin':
        return (
          <Suspense fallback={<ScreenLoader />}>
            <AdminPanel />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<ScreenLoader />}>
            <Feed onNavigateToMessages={handleFeedPostMessageAuthor} />
          </Suspense>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col pb-20">
      {/* Header - Always visible with user icon */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="taskmate-logo-small">
              <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="12" fill="#f97316"/>
                <path d="M16 32h32M32 16v32M24 24l16 16M40 24L24 40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Taskmate</h1>
          </div>
          
          {/* Header Icons */}
          <div className="flex items-center gap-2">
            {/* Notification Icon */}
            <button
              onClick={handleNotificationClick}
              className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Icon - Only show when authenticated */}
            {identity ? (
              <UserIcon 
                onProfileClick={handleProfileClick}
                onAdminClick={handleAdminClick}
                onNFTsClick={handleNFTsClick}
              />
            ) : (
              <LoginButton />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>

      {/* Task Detail Modal */}
      {taskDetailModal && (
        <Suspense fallback={<ScreenLoader />}>
          <TaskDetailModal
            task={tasks.find(t => t.id === taskDetailModal.taskId)!}
            onClose={() => setTaskDetailModal(null)}
            highlightCommentId={taskDetailModal.commentId}
          />
        </Suspense>
      )}

      {/* Fixed Bottom Navigation - Hidden during chat or notifications */}
      {!isInChatMode && !showNotifications && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-2 z-40">
          <div className="flex justify-around">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                activeTab === 'feed'
                  ? 'text-orange-500 bg-gray-700'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Users size={20} />
              <span className="text-xs mt-1">Feed</span>
            </button>

            <button
              onClick={() => setActiveTab('browse')}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                activeTab === 'browse'
                  ? 'text-orange-500 bg-gray-700'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Search size={20} />
              <span className="text-xs mt-1">Tasks</span>
            </button>

            <button
              onClick={() => setActiveTab('myboard')}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                activeTab === 'myboard'
                  ? 'text-orange-500 bg-gray-700'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Home size={20} />
              <span className="text-xs mt-1">MyBoard</span>
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors relative ${
                activeTab === 'messages'
                  ? 'text-orange-500 bg-gray-700'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="relative">
                <MessageCircle size={20} />
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1">Messages</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
