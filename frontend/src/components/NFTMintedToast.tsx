import React, { useEffect, useState } from 'react';
import { Award, X, ExternalLink } from 'lucide-react';

interface NFTMintedToastProps {
  taskTitle: string;
  tokenId: string;
  amount: number;
  currency: string;
  onClose: () => void;
  onViewNFT: () => void;
}

export default function NFTMintedToast({ 
  taskTitle, 
  tokenId, 
  amount, 
  currency, 
  onClose, 
  onViewNFT 
}: NFTMintedToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-dismiss after 8 seconds
    const dismissTimer = setTimeout(() => {
      handleClose();
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency === 'AUD' ? '$' : currency} ${(amount / 100).toLocaleString()}`;
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div
        className={`bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-2xl border border-orange-400 transform transition-all duration-300 ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Award size={20} className="text-white" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-white">NFT Minted! 🎉</h4>
                <button
                  onClick={handleClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <p className="text-white text-sm mb-2 line-clamp-2">
                Completion certificate for "{taskTitle}"
              </p>
              
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-100">Token ID:</span>
                  <span className="font-mono text-white">#{tokenId}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-100">Amount:</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(amount, currency)}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  onViewNFT();
                  handleClose();
                }}
                className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>View NFT</span>
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Progress bar for auto-dismiss */}
        <div className="h-1 bg-white bg-opacity-20 rounded-b-lg overflow-hidden">
          <div 
            className="h-full bg-white bg-opacity-40 transition-all duration-[8000ms] ease-linear"
            style={{ width: isVisible ? '0%' : '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
