import React, { useState } from 'react';
import { Settings, Shield, CreditCard, Check, X, AlertCircle, Eye, EyeOff, Users, LogIn, Briefcase, HandHeart, CheckCircle, DollarSign, TrendingUp, Percent } from 'lucide-react';
import { useGetCallerUserProfile, useIsStripeConfigured, useSetStripeConfiguration, useIsCallerAdmin, useGetTasks, useGetOffers, useGetPayments, useGetPlatformFeePercentage, useSetPlatformFeePercentage } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { StripeConfiguration, OfferStatus, PaymentStatus } from '../backend';

const SUPPORTED_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'NZ', name: 'New Zealand' }
];

export default function AdminPanel() {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: isStripeConfigured = false, isLoading: configLoading } = useIsStripeConfigured();
  const { data: isAdmin = false, isLoading: adminLoading } = useIsCallerAdmin();
  const { data: platformFeePercentage = 5, isLoading: feeLoading } = useGetPlatformFeePercentage();
  const { data: tasks = [] } = useGetTasks();
  const { data: offers = [] } = useGetOffers();
  const { data: payments = [] } = useGetPayments();
  const setStripeConfig = useSetStripeConfiguration();
  const setPlatformFee = useSetPlatformFeePercentage();

  const [showStripeSetup, setShowStripeSetup] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showFeeSetup, setShowFeeSetup] = useState(false);
  
  const [stripeFormData, setStripeFormData] = useState({
    secretKey: '',
    allowedCountries: ['US', 'CA', 'GB'] as string[]
  });

  const [feeFormData, setFeeFormData] = useState({
    percentage: platformFeePercentage.toString()
  });
  
  const [stripeValidationError, setStripeValidationError] = useState('');
  const [feeValidationError, setFeeValidationError] = useState('');

  const totalTasks = tasks.length;
  const totalOffers = offers.length;
  const successfulOffers = offers.filter(offer => offer.status === OfferStatus.approved).length;
  const completedPayments = payments.filter(payment => payment.status === PaymentStatus.completed);
  const totalEarned = completedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalAppFees = completedPayments.reduce((sum, payment) => sum + Number(payment.fee), 0);

  const uniqueUsers = new Set<string>();
  tasks.forEach(task => uniqueUsers.add(task.requester.toString()));
  offers.forEach(offer => uniqueUsers.add(offer.tasker.toString()));
  const totalUsers = uniqueUsers.size;
  const totalLogins = totalUsers;

  // Update fee form data when platform fee percentage changes
  React.useEffect(() => {
    setFeeFormData({ percentage: platformFeePercentage.toString() });
  }, [platformFeePercentage]);

  const handleCountryToggle = (countryCode: string) => {
    setStripeFormData(prev => ({
      ...prev,
      allowedCountries: prev.allowedCountries.includes(countryCode)
        ? prev.allowedCountries.filter(c => c !== countryCode)
        : [...prev.allowedCountries, countryCode]
    }));
  };

  const validateStripeKey = (key: string): boolean => {
    const stripeKeyPattern = /^sk_(test|live)_[a-zA-Z0-9]{24,}$/;
    return stripeKeyPattern.test(key);
  };

  const validateFeePercentage = (percentage: string): boolean => {
    const num = parseFloat(percentage);
    return !isNaN(num) && num >= 0 && num <= 50;
  };

  const handleStripeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setStripeValidationError('');

    if (!stripeFormData.secretKey.trim()) {
      setStripeValidationError('Stripe secret key is required');
      return;
    }

    if (!validateStripeKey(stripeFormData.secretKey.trim())) {
      setStripeValidationError('Invalid Stripe secret key format. Key should start with sk_test_ or sk_live_');
      return;
    }

    if (stripeFormData.allowedCountries.length === 0) {
      setStripeValidationError('At least one country must be selected');
      return;
    }

    const config: StripeConfiguration = {
      secretKey: stripeFormData.secretKey.trim(),
      allowedCountries: stripeFormData.allowedCountries
    };

    try {
      await setStripeConfig.mutateAsync(config);
      setShowStripeSetup(false);
      setStripeFormData({ secretKey: '', allowedCountries: ['US', 'CA', 'GB'] });
    } catch (error) {
      console.error('Failed to configure Stripe:', error);
      setStripeValidationError('Failed to save Stripe configuration. Please try again.');
    }
  };

  const handleFeeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFeeValidationError('');

    if (!feeFormData.percentage.trim()) {
      setFeeValidationError('Platform fee percentage is required');
      return;
    }

    if (!validateFeePercentage(feeFormData.percentage.trim())) {
      setFeeValidationError('Platform fee must be between 0% and 50%');
      return;
    }

    const percentage = parseFloat(feeFormData.percentage.trim());

    try {
      await setPlatformFee.mutateAsync(percentage);
      setShowFeeSetup(false);
    } catch (error) {
      console.error('Failed to set platform fee:', error);
      setFeeValidationError('Failed to save platform fee percentage. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString()}`;
  };

  if (adminLoading || configLoading || feeLoading) {
    return (
      <div className="p-4">
        <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="p-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center py-12">
            <Shield size={48} className="mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold text-white mb-2">Authentication Required</h3>
            <p className="text-gray-400 mb-6">
              Please log in to access the admin panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center py-12">
            <Shield size={48} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-gray-400 mb-6">
              You do not have administrator privileges. Only the original app creator can access this panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield size={24} className="text-orange-500" />
          <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
        </div>
        <p className="text-gray-400">Platform management and configuration</p>
        {userProfile && (
          <p className="text-sm text-gray-500 mt-1">
            Logged in as: {userProfile.name}
          </p>
        )}
        <p className="text-sm text-green-400 mt-1">
          Admin access confirmed - Original app creator
        </p>
      </div>

      {/* App Statistics */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">App Statistics</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="text-blue-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-blue-400 mb-1">{totalUsers}</div>
            <div className="text-sm text-gray-400">Users</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <LogIn className="text-green-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-green-400 mb-1">{totalLogins}</div>
            <div className="text-sm text-gray-400">Logins</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Briefcase className="text-purple-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-purple-400 mb-1">{totalTasks}</div>
            <div className="text-sm text-gray-400">Total Tasks</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <HandHeart className="text-yellow-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-yellow-400 mb-1">{totalOffers}</div>
            <div className="text-sm text-gray-400">Total Offers</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="text-green-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-green-400 mb-1">{successfulOffers}</div>
            <div className="text-sm text-gray-400">Successful Offers</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="text-emerald-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">{formatCurrency(totalEarned)}</div>
            <div className="text-sm text-gray-400">Total Earned</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="text-orange-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-orange-400 mb-1">{formatCurrency(totalAppFees)}</div>
            <div className="text-sm text-gray-400">App Fees</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Percent className="text-purple-500" size={20} />
            </div>
            <div className="text-2xl font-bold text-purple-400 mb-1">{platformFeePercentage}%</div>
            <div className="text-sm text-gray-400">Platform Fee</div>
          </div>
        </div>
      </div>

      {/* Platform Fee Configuration */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Percent size={20} className="text-purple-500" />
            <h3 className="text-lg font-semibold text-white">Platform Fee Configuration</h3>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-purple-900/20 text-purple-400 border border-purple-500/30">
            <Percent size={14} />
            <span>{platformFeePercentage}% Current Fee</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">Platform Fee Settings</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-400 text-sm">
                <Percent size={16} />
                <span>Current platform fee: {platformFeePercentage}% of completed task payments</span>
              </div>
              <div className="text-gray-300 text-sm">
                This fee is automatically deducted from completed paid tasks and transferred to the app owner.
              </div>
              <button
                onClick={() => setShowFeeSetup(true)}
                className="mt-3 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Update Platform Fee
              </button>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">Fee Calculation Information</h4>
            <div className="text-gray-300 text-sm space-y-1">
              <p>• Platform fee: {platformFeePercentage}% of each completed paid task payment</p>
              <p>• Fees automatically deducted and transferred to app owner</p>
              <p>• Taskers receive {100 - platformFeePercentage}% of agreed payment amount</p>
              <p>• All transactions processed securely through Stripe</p>
              <p>• Volunteer tasks are not subject to platform fees</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stripe Configuration */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-orange-500" />
            <h3 className="text-lg font-semibold text-white">Payment Configuration</h3>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            isStripeConfigured 
              ? 'bg-green-900/20 text-green-400 border border-green-500/30'
              : 'bg-red-900/20 text-red-400 border border-red-500/30'
          }`}>
            {isStripeConfigured ? (
              <>
                <Check size={14} />
                <span>Configured</span>
              </>
            ) : (
              <>
                <X size={14} />
                <span>Not Configured</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">Stripe Integration Status</h4>
            {isStripeConfigured ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <Check size={16} />
                  <span>Stripe payment processing is active</span>
                </div>
                <div className="text-gray-300 text-sm">
                  Payment processing enabled with {platformFeePercentage}% platform fee collection.
                </div>
                <button
                  onClick={() => setShowStripeSetup(true)}
                  className="mt-3 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  Update Configuration
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  <span>Stripe payment processing not configured</span>
                </div>
                <div className="text-gray-300 text-sm">
                  Users cannot complete payments until Stripe is configured.
                </div>
                <button
                  onClick={() => setShowStripeSetup(true)}
                  className="mt-3 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  Configure Stripe
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-white">Platform Overview</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-500 mb-1">Active</div>
            <div className="text-sm text-gray-400">Platform Status</div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400 mb-1">{platformFeePercentage}%</div>
            <div className="text-sm text-gray-400">Platform Fee</div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
            <CheckCircle size={16} />
            <span className="font-medium">Original App Creator Access</span>
          </div>
          <p className="text-gray-300 text-sm">
            You are the original creator of this Taskmate platform and have full administrative privileges. 
            This access is permanently tied to your Internet Identity principal.
          </p>
        </div>
      </div>

      {/* Platform Fee Setup Modal */}
      {showFeeSetup && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
            <h2 className="text-xl font-bold text-white">Configure Platform Fee</h2>
            <button
              onClick={() => {
                setShowFeeSetup(false);
                setFeeValidationError('');
                setFeeFormData({ percentage: platformFeePercentage.toString() });
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 pb-8">
              <form onSubmit={handleFeeSetup} className="space-y-6 max-w-2xl mx-auto">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                    <AlertCircle size={16} />
                    <span className="font-medium">Platform Fee Information</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    The platform fee is automatically deducted from completed paid task payments. 
                    This fee is transferred to the app owner, while taskers receive the remaining amount.
                    Volunteer tasks are not subject to platform fees.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Platform Fee Percentage *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      max="50"
                      step="0.1"
                      value={feeFormData.percentage}
                      onChange={(e) => {
                        setFeeFormData({ percentage: e.target.value });
                        if (feeValidationError) setFeeValidationError('');
                      }}
                      className="w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                      placeholder="5.0"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <Percent size={20} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Enter a percentage between 0% and 50%. Current fee: {platformFeePercentage}%
                  </p>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                    <AlertCircle size={16} />
                    <span className="font-medium">Fee Calculation Examples</span>
                  </div>
                  <div className="text-gray-300 text-sm space-y-1">
                    {feeFormData.percentage && validateFeePercentage(feeFormData.percentage) && (
                      <>
                        <p>• For a $100 task: App fee ${(100 * parseFloat(feeFormData.percentage) / 100).toFixed(2)}, Tasker receives ${(100 * (100 - parseFloat(feeFormData.percentage)) / 100).toFixed(2)}</p>
                        <p>• For a $500 task: App fee ${(500 * parseFloat(feeFormData.percentage) / 100).toFixed(2)}, Tasker receives ${(500 * (100 - parseFloat(feeFormData.percentage)) / 100).toFixed(2)}</p>
                      </>
                    )}
                  </div>
                </div>

                {feeValidationError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <AlertCircle size={16} />
                    <span>{feeValidationError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={setPlatformFee.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
                  >
                    {setPlatformFee.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={20} />
                        <span>Update Platform Fee</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFeeSetup(false);
                      setFeeValidationError('');
                      setFeeFormData({ percentage: platformFeePercentage.toString() });
                    }}
                    disabled={setPlatformFee.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
                  >
                    <X size={20} />
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Setup Modal */}
      {showStripeSetup && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
            <h2 className="text-xl font-bold text-white">
              {isStripeConfigured ? 'Update Stripe Configuration' : 'Configure Stripe Payment'}
            </h2>
            <button
              onClick={() => {
                setShowStripeSetup(false);
                setStripeValidationError('');
                setStripeFormData({ secretKey: '', allowedCountries: ['US', 'CA', 'GB'] });
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 pb-8">
              <form onSubmit={handleStripeSetup} className="space-y-6 max-w-2xl mx-auto">
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                    <AlertCircle size={16} />
                    <span className="font-medium">Security Notice</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Your Stripe secret key will be stored securely. Never share this key. 
                    Use test keys for development and live keys only for production.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Stripe Secret Key *
                  </label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      required
                      value={stripeFormData.secretKey}
                      onChange={(e) => {
                        setStripeFormData({ ...stripeFormData, secretKey: e.target.value });
                        if (stripeValidationError) setStripeValidationError('');
                      }}
                      className="w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                      placeholder="sk_test_... or sk_live_..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showSecretKey ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Get your secret key from Stripe Dashboard → Developers → API keys
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Allowed Countries * ({stripeFormData.allowedCountries.length} selected)
                  </label>
                  <div className="bg-gray-700 rounded-lg p-4 max-h-80 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUPPORTED_COUNTRIES.map((country) => (
                        <label
                          key={country.code}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={stripeFormData.allowedCountries.includes(country.code)}
                            onChange={() => handleCountryToggle(country.code)}
                            className="w-5 h-5 text-orange-500 bg-gray-600 border-gray-500 rounded focus:ring-orange-500 focus:ring-2"
                          />
                          <span className="text-gray-300 text-sm">
                            {country.name} ({country.code})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Select countries where you want to accept payments. This affects available payment methods.
                  </p>
                </div>

                {stripeValidationError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <AlertCircle size={16} />
                    <span>{stripeValidationError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={setStripeConfig.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
                  >
                    {setStripeConfig.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={20} />
                        <span>{isStripeConfigured ? 'Update Configuration' : 'Save Configuration'}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStripeSetup(false);
                      setStripeValidationError('');
                      setStripeFormData({ secretKey: '', allowedCountries: ['US', 'CA', 'GB'] });
                    }}
                    disabled={setStripeConfig.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-4 rounded-lg transition-colors disabled:cursor-not-allowed font-medium text-base"
                  >
                    <X size={20} />
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
