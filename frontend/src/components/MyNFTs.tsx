import React, { useState } from 'react';
import { Award, Calendar, DollarSign, Star, ExternalLink, Image as ImageIcon, User, Clock, Hash, CheckCircle, ArrowLeft, X } from 'lucide-react';
import { useGetMyNFTs } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

// NFT types based on the specification
interface NFTMetadata {
  task_id: string;
  title: string;
  description_hash: string;
  poster_principal: string;
  worker_principal: string;
  amount: number;
  currency: string;
  completed_at: string; // ISO 8601
  evidence_media: Array<{
    url: string;
    sha256: string;
  }>;
  rating_by_poster?: number;
}

interface NFT {
  tokenId: string;
  metadata: NFTMetadata;
  mintedAt: string;
}

export default function MyNFTs() {
  const { identity } = useInternetIdentity();
  const { data: nfts = [], isLoading, error } = useGetMyNFTs();
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  // Type the nfts array properly
  const typedNFTs = nfts as NFT[];

  // Filter NFTs to only show those where the current user is the worker
  const myNFTs = typedNFTs.filter(nft => 
    identity && nft.metadata.worker_principal === identity.getPrincipal().toString()
  );

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency === 'AUD' ? '$' : currency} ${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}
      />
    ));
  };

  const NFTCard = ({ nft }: { nft: NFT }) => {
    const { metadata } = nft;
    const thumbnailUrl = metadata.evidence_media.length > 0 ? metadata.evidence_media[0].url : null;

    return (
      <div
        onClick={() => setSelectedNFT(nft)}
        className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer overflow-hidden"
      >
        {/* NFT Image/Thumbnail */}
        <div className="aspect-square bg-gray-700 relative">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={metadata.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const nextElement = target.nextElementSibling as HTMLElement;
                if (nextElement) {
                  nextElement.classList.remove('hidden');
                  nextElement.classList.add('flex');
                }
              }}
            />
          ) : null}
          <div className={`${thumbnailUrl ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center`}>
            <div className="text-center">
              <Award size={48} className="mx-auto mb-2 text-orange-500" />
              <p className="text-gray-400 text-sm">Task Completion Certificate</p>
            </div>
          </div>
          
          {/* NFT Badge */}
          <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            NFT
          </div>
        </div>

        {/* NFT Info */}
        <div className="p-4">
          <h3 className="text-white font-semibold mb-2 line-clamp-2">{metadata.title}</h3>
          
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Earned:</span>
              <span className="text-green-400 font-medium">
                {formatCurrency(metadata.amount, metadata.currency)}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Completed:</span>
              <span className="text-gray-300">
                {formatDate(metadata.completed_at)}
              </span>
            </div>

            {/* Only show rating if it exists */}
            {metadata.rating_by_poster && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Rating:</span>
                <div className="flex items-center gap-1">
                  {renderStars(metadata.rating_by_poster)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Hash size={12} />
            <span className="truncate">Token #{nft.tokenId}</span>
          </div>
        </div>
      </div>
    );
  };

  const NFTDetailModal = ({ nft, onClose }: { nft: NFT; onClose: () => void }) => {
    const { metadata } = nft;

    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="sm:hidden">Back</span>
          </button>
          <h2 className="text-lg font-bold text-white">NFT Certificate</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors sm:block hidden"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-8 space-y-6 max-w-4xl mx-auto">
            {/* NFT Image Gallery */}
            {metadata.evidence_media.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Evidence Media</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {metadata.evidence_media.map((media, index) => (
                    <div key={index} className="relative">
                      <img
                        src={media.url}
                        alt={`Evidence ${index + 1}`}
                        className="w-full h-48 sm:h-64 object-cover rounded-lg border border-gray-600"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const nextElement = target.nextElementSibling as HTMLElement;
                          if (nextElement) {
                            nextElement.classList.remove('hidden');
                            nextElement.classList.add('flex');
                          }
                        }}
                      />
                      <div className="hidden absolute inset-0 bg-gray-700 rounded-lg items-center justify-center">
                        <ImageIcon size={32} className="text-gray-500" />
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        {index + 1} / {metadata.evidence_media.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Information */}
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Task Information</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-gray-400 text-sm">Task Title:</span>
                  <p className="text-white font-medium text-base sm:text-lg">{metadata.title}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">Task ID:</span>
                    <p className="text-gray-300 font-mono text-sm break-all">{metadata.task_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Token ID:</span>
                    <p className="text-gray-300 font-mono text-sm">#{nft.tokenId}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">Amount Earned:</span>
                    <p className="text-green-400 font-semibold text-lg">
                      {formatCurrency(metadata.amount, metadata.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Completed:</span>
                    <p className="text-gray-300">{formatDate(metadata.completed_at)}</p>
                  </div>
                </div>

                {/* Only show rating section if rating exists */}
                {metadata.rating_by_poster && (
                  <div>
                    <span className="text-gray-400 text-sm">Client Rating:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        {renderStars(metadata.rating_by_poster)}
                      </div>
                      <span className="text-white font-medium">
                        {metadata.rating_by_poster}/5
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Blockchain Information */}
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Certificate Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">Minted:</span>
                    <p className="text-gray-300">{formatDate(nft.mintedAt)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Standard:</span>
                    <p className="text-gray-300">DIP-721 v2</p>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-sm">Description Hash:</span>
                  <p className="text-gray-300 font-mono text-sm break-all">
                    {metadata.description_hash}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">Client Principal:</span>
                    <p className="text-gray-300 font-mono text-xs break-all">
                      {metadata.poster_principal}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Worker Principal:</span>
                    <p className="text-gray-300 font-mono text-xs break-all">
                      {metadata.worker_principal}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Badge */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-green-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-green-400 font-semibold mb-2">Verified Completion Certificate</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This NFT serves as immutable proof of task completion and payment on the Internet Computer blockchain.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!identity) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <Award size={64} className="mx-auto mb-4 text-gray-500" />
            <h3 className="text-xl font-semibold text-white mb-2">Login Required</h3>
            <p className="text-gray-400">
              Please log in to view your NFT completion certificates
            </p>
          </div>
        </div>
        
        <footer className="p-6 text-center text-sm text-gray-500">
          © 2025. Built with <span className="text-red-500">♥</span> using{' '}
          <a href="https://caffeine.ai" className="text-orange-500 hover:text-orange-400">
            caffeine.ai
          </a>
        </footer>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-1 p-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">My NFTs</h2>
            <p className="text-gray-400">Loading your completion certificates...</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-700"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <footer className="p-6 text-center text-sm text-gray-500">
          © 2025. Built with <span className="text-red-500">♥</span> using{' '}
          <a href="https://caffeine.ai" className="text-orange-500 hover:text-orange-400">
            caffeine.ai
          </a>
        </footer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <Award size={64} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold text-white mb-2">Failed to Load NFTs</h3>
            <p className="text-gray-400 mb-4">
              There was an error loading your completion certificates
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
        
        <footer className="p-6 text-center text-sm text-gray-500">
          © 2025. Built with <span className="text-red-500">♥</span> using{' '}
          <a href="https://caffeine.ai" className="text-orange-500 hover:text-orange-400">
            caffeine.ai
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">My NFTs</h2>
          <p className="text-gray-400">
            {myNFTs.length} completion certificate{myNFTs.length !== 1 ? 's' : ''} earned
          </p>
        </div>

        {myNFTs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <Award size={64} className="mx-auto mb-4 text-gray-500" />
              <h3 className="text-xl font-semibold text-white mb-2">No NFTs Yet</h3>
              <p className="text-gray-400 mb-6">
                Complete tasks to earn NFT completion certificates that prove your work and achievements
              </p>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2">How to Earn NFTs</h4>
                <ul className="text-gray-300 text-sm space-y-1 text-left">
                  <li>• Make offers on tasks</li>
                  <li>• Get your offer accepted</li>
                  <li>• Complete the task successfully</li>
                  <li>• Receive payment and your NFT certificate</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {myNFTs.map((nft: NFT) => (
              <NFTCard key={nft.tokenId} nft={nft} />
            ))}
          </div>
        )}
      </div>

      <footer className="p-6 text-center text-sm text-gray-500">
        © 2025. Built with <span className="text-red-500">♥</span> using{' '}
        <a href="https://caffeine.ai" className="text-orange-500 hover:text-orange-400">
          caffeine.ai
        </a>
      </footer>

      {selectedNFT && (
        <NFTDetailModal
          nft={selectedNFT}
          onClose={() => setSelectedNFT(null)}
        />
      )}
    </div>
  );
}
