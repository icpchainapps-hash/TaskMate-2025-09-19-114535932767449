import React, { useState } from 'react';
import { X, CheckCircle, Star, ArrowLeft } from 'lucide-react';
import { useMarkTaskCompleted, useGetPlatformFeePercentage } from '../hooks/useQueries';

interface TaskCompletionModalProps {
  taskId: string;
  taskTitle: string;
  workerName: string;
  onClose: () => void;
  onCompleted: () => void;
}

export default function TaskCompletionModal({ 
  taskId, 
  taskTitle, 
  workerName, 
  onClose, 
  onCompleted 
}: TaskCompletionModalProps) {
  const markCompleted = useMarkTaskCompleted();
  const { data: platformFeePercentage = 5 } = useGetPlatformFeePercentage();
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const handleComplete = async () => {
    try {
      // For now, we'll just mark the task as completed
      // The rating will be stored when the backend supports it
      await markCompleted.mutateAsync(taskId);
      onCompleted();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => {
      const starValue = i + 1;
      const isActive = (hoveredRating || rating || 0) >= starValue;
      
      return (
        <button
          key={i}
          type="button"
          onClick={() => setRating(starValue)}
          onMouseEnter={() => setHoveredRating(starValue)}
          onMouseLeave={() => setHoveredRating(null)}
          className="p-1 transition-colors"
        >
          <Star
            size={32}
            className={`transition-colors ${
              isActive 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-600 hover:text-gray-500'
            }`}
          />
        </button>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="sm:hidden">Back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Complete Task</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors sm:block hidden"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8 space-y-6 max-w-2xl mx-auto">
          {/* Task Info */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-center mb-6">
              <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-bold text-white mb-2">Mark Task as Completed</h3>
              <p className="text-gray-300">
                You're about to mark "{taskTitle}" as completed and release payment to {workerName}.
              </p>
            </div>
          </div>

          {/* Rating Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Rate the Work (Optional)</h4>
            <p className="text-gray-400 text-sm mb-6">
              Help other users by rating the quality of work. This rating will appear on the worker's NFT certificate.
            </p>
            
            <div className="text-center mb-6">
              <div className="flex justify-center items-center gap-1 mb-3">
                {renderStars()}
              </div>
              {rating && (
                <p className="text-orange-400 font-medium">
                  {rating} out of 5 stars
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Additional Feedback (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                placeholder="Share your experience working with this tasker..."
              />
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
            <h4 className="text-green-400 font-semibold mb-3">Payment Release</h4>
            <div className="space-y-2 text-sm">
              <p className="text-gray-300">
                • Payment will be automatically released to {workerName}
              </p>
              <p className="text-gray-300">
                • Platform fee ({platformFeePercentage}%) will be deducted
              </p>
              <p className="text-gray-300">
                • An NFT completion certificate will be minted for the worker
              </p>
              <p className="text-gray-300">
                • This action cannot be undone
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleComplete}
              disabled={markCompleted.isPending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
            >
              {markCompleted.isPending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <CheckCircle size={20} />
              )}
              <span>
                {markCompleted.isPending ? 'Completing Task...' : 'Complete Task & Release Payment'}
              </span>
            </button>
            
            <button
              onClick={onClose}
              disabled={markCompleted.isPending}
              className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
            >
              <X size={20} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
