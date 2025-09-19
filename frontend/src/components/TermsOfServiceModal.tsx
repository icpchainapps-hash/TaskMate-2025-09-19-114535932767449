import React from 'react';
import { X, ArrowLeft, Scale, AlertTriangle, Shield, Users, Gavel, FileText } from 'lucide-react';

interface TermsOfServiceModalProps {
  onClose: () => void;
}

export default function TermsOfServiceModal({ onClose }: TermsOfServiceModalProps) {
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
        <h2 className="text-lg font-bold text-white">Terms of Service</h2>
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
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Scale size={48} className="text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
            <p className="text-gray-400">Last updated: January 2025</p>
          </div>

          {/* Risk Warning */}
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-400 flex-shrink-0" />
              <h3 className="text-red-400 font-bold text-lg">Important Risk Notice</h3>
            </div>
            <div className="space-y-3 text-gray-300">
              <p className="font-semibold text-red-300">
                BY USING TASKMATE, YOU ACKNOWLEDGE AND AGREE THAT YOU ASSUME ALL RISKS ASSOCIATED WITH YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Personal injury or bodily harm</strong> that may occur while performing or receiving services</li>
                <li><strong>Property damage</strong> to your own property or the property of others</li>
                <li><strong>Financial losses</strong> resulting from incomplete, unsatisfactory, or fraudulent services</li>
                <li><strong>Theft, vandalism, or other criminal acts</strong> by other users</li>
                <li><strong>Disputes with other users</strong> regarding service quality, payment, or other matters</li>
              </ul>
              <p className="font-semibold text-red-300 mt-4">
                TASKMATE IS NOT RESPONSIBLE FOR ANY INJURIES, DAMAGES, OR LOSSES THAT MAY OCCUR. YOU PARTICIPATE AT YOUR OWN RISK.
              </p>
            </div>
          </div>

          {/* Terms Content */}
          <div className="space-y-8">
            {/* Section 1: Acceptance of Terms */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText size={20} className="text-orange-500" />
                <h3 className="text-xl font-semibold text-white">1. Acceptance of Terms</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  By accessing or using Taskmate ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). 
                  If you do not agree to these Terms, you may not use the Platform.
                </p>
                <p>
                  These Terms constitute a legally binding agreement between you and Taskmate. We may update these Terms 
                  from time to time, and your continued use of the Platform constitutes acceptance of any changes.
                </p>
              </div>
            </section>

            {/* Section 2: Platform Description */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users size={20} className="text-blue-500" />
                <h3 className="text-xl font-semibold text-white">2. Platform Description</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  Taskmate is a marketplace platform that connects individuals who need tasks completed ("Task Owners") 
                  with individuals who can perform those tasks ("Taskers"). The Platform facilitates:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Task posting and discovery</li>
                  <li>Communication between users</li>
                  <li>Payment processing and escrow services</li>
                  <li>Rating and review systems</li>
                  <li>NFT completion certificates</li>
                </ul>
                <p>
                  Taskmate acts solely as an intermediary and is not a party to any agreements between users.
                </p>
              </div>
            </section>

            {/* Section 3: User Responsibilities */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-green-500" />
                <h3 className="text-xl font-semibold text-white">3. User Responsibilities</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p><strong>All Users Must:</strong></p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate and truthful information</li>
                  <li>Maintain the security of their account</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Treat other users with respect and professionalism</li>
                  <li>Not engage in fraudulent, illegal, or harmful activities</li>
                </ul>
                
                <p className="mt-6"><strong>Task Owners Must:</strong></p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide clear and accurate task descriptions</li>
                  <li>Ensure their property is safe for Taskers to work on</li>
                  <li>Pay agreed amounts promptly upon task completion</li>
                  <li>Provide necessary access and materials for task completion</li>
                </ul>

                <p className="mt-6"><strong>Taskers Must:</strong></p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Possess the skills and qualifications necessary for offered services</li>
                  <li>Complete tasks safely and to the best of their ability</li>
                  <li>Use appropriate tools and safety equipment</li>
                  <li>Respect the Task Owner's property and privacy</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Risk Assumption and Liability */}
            <section className="bg-gray-800 rounded-lg p-6 border border-red-500/30">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="text-xl font-semibold text-white">4. Risk Assumption and Liability</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p className="font-semibold text-red-300">
                  YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>You assume all risks</strong> associated with using the Platform and engaging with other users
                  </li>
                  <li>
                    <strong>Taskmate is not liable</strong> for any injuries, damages, losses, or disputes that may arise
                  </li>
                  <li>
                    <strong>You are responsible</strong> for your own safety and the safety of others during task performance
                  </li>
                  <li>
                    <strong>You should obtain appropriate insurance</strong> coverage for your activities on the Platform
                  </li>
                  <li>
                    <strong>You will not hold Taskmate responsible</strong> for the actions or omissions of other users
                  </li>
                </ul>
                <p className="font-semibold text-red-300 mt-4">
                  TASKMATE'S LIABILITY IS LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
                </p>
              </div>
            </section>

            {/* Section 5: Payment Terms */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Gavel size={20} className="text-purple-500" />
                <h3 className="text-xl font-semibold text-white">5. Payment Terms</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <ul className="list-disc list-inside space-y-2">
                  <li>Taskmate charges a 5% platform fee on completed transactions</li>
                  <li>Payments are held in escrow until task completion is confirmed</li>
                  <li>Taskers receive 95% of the agreed payment amount</li>
                  <li>Payment disputes must be resolved between users</li>
                  <li>Refunds are subject to our dispute resolution process</li>
                  <li>All payments are processed through secure third-party payment processors</li>
                </ul>
              </div>
            </section>

            {/* Section 6: Prohibited Activities */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <X size={20} className="text-red-500" />
                <h3 className="text-xl font-semibold text-white">6. Prohibited Activities</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>The following activities are strictly prohibited:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Illegal activities or services</li>
                  <li>Harassment, discrimination, or abusive behavior</li>
                  <li>Fraudulent or deceptive practices</li>
                  <li>Circumventing platform fees or payment systems</li>
                  <li>Sharing personal contact information to avoid platform fees</li>
                  <li>Creating fake accounts or reviews</li>
                  <li>Violating intellectual property rights</li>
                  <li>Tasks involving hazardous materials or dangerous activities</li>
                </ul>
              </div>
            </section>

            {/* Section 7: Account Termination */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-yellow-500" />
                <h3 className="text-xl font-semibold text-white">7. Account Termination</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  Taskmate reserves the right to suspend or terminate user accounts for violations of these Terms, 
                  illegal activities, or behavior that harms the Platform or other users.
                </p>
                <p>
                  Users may delete their accounts at any time, but remain responsible for any outstanding obligations.
                </p>
              </div>
            </section>

            {/* Section 8: Governing Law */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Scale size={20} className="text-blue-500" />
                <h3 className="text-xl font-semibold text-white">8. Governing Law</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  These Terms are governed by the laws of the jurisdiction where Taskmate operates. 
                  Any disputes will be resolved through binding arbitration or in the appropriate courts.
                </p>
              </div>
            </section>

            {/* Section 9: Contact Information */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText size={20} className="text-green-500" />
                <h3 className="text-xl font-semibold text-white">9. Contact Information</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  If you have questions about these Terms of Service, please contact us through the Platform's 
                  messaging system or support channels.
                </p>
                <p className="text-sm text-gray-400">
                  This is a sample Terms of Service document. In a production environment, you should consult 
                  with legal professionals to ensure compliance with applicable laws and regulations.
                </p>
              </div>
            </section>
          </div>

          {/* Final Warning */}
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mt-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-400 flex-shrink-0" />
              <h3 className="text-red-400 font-bold text-lg">Final Reminder</h3>
            </div>
            <p className="text-gray-300 font-semibold">
              By using Taskmate, you acknowledge that you have read, understood, and agree to assume all risks 
              associated with your use of the Platform. You agree to hold Taskmate harmless from any claims, 
              damages, or losses that may arise from your use of the Platform or interactions with other users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
