import React from 'react';
import { X, ArrowLeft, FileText, Shield, Eye, Database, Lock, Users, Globe, Clock } from 'lucide-react';

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export default function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
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
        <h2 className="text-lg font-bold text-white">Privacy Policy</h2>
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
              <FileText size={48} className="text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
            <p className="text-gray-400">Last updated: January 2025</p>
          </div>

          {/* Privacy Commitment */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield size={24} className="text-blue-400 flex-shrink-0" />
              <h3 className="text-blue-400 font-bold text-lg">Our Privacy Commitment</h3>
            </div>
            <p className="text-gray-300 leading-relaxed">
              At Taskmate, we are committed to protecting your privacy and personal information. This Privacy Policy 
              explains how we collect, use, store, and protect your data when you use our platform. We believe in 
              transparency and want you to understand exactly how your information is handled.
            </p>
          </div>

          {/* Privacy Content */}
          <div className="space-y-8">
            {/* Section 1: Information We Collect */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database size={20} className="text-orange-500" />
                <h3 className="text-xl font-semibold text-white">1. Information We Collect</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-white mb-2">Personal Information:</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Name and display name</li>
                    <li>Email address</li>
                    <li>Phone number</li>
                    <li>Profile picture</li>
                    <li>Bio and skills information</li>
                    <li>Internet Identity principal (blockchain identifier)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-2">Task and Service Information:</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Task descriptions, categories, and requirements</li>
                    <li>Location information (address, suburb, state, postcode)</li>
                    <li>Task images and documentation</li>
                    <li>Offers, messages, and communications</li>
                    <li>Ratings and reviews</li>
                    <li>Payment and transaction history</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-2">Technical Information:</h4>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Device information and browser type</li>
                    <li>IP address and location data</li>
                    <li>Usage patterns and platform interactions</li>
                    <li>Cookies and similar tracking technologies</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2: How We Use Your Information */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Eye size={20} className="text-green-500" />
                <h3 className="text-xl font-semibold text-white">2. How We Use Your Information</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>We use your information to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Provide Platform Services:</strong> Enable task posting, matching, communication, and payment processing</li>
                  <li><strong>Facilitate Connections:</strong> Help users find suitable tasks and taskers based on location, skills, and preferences</li>
                  <li><strong>Process Payments:</strong> Handle secure transactions, escrow services, and fee collection</li>
                  <li><strong>Ensure Safety:</strong> Verify user identities, conduct background checks (when requested), and maintain platform security</li>
                  <li><strong>Improve Services:</strong> Analyze usage patterns to enhance platform functionality and user experience</li>
                  <li><strong>Communicate:</strong> Send notifications, updates, and important platform information</li>
                  <li><strong>Legal Compliance:</strong> Meet regulatory requirements and respond to legal requests</li>
                </ul>
              </div>
            </section>

            {/* Section 3: Information Sharing and Privacy */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users size={20} className="text-purple-500" />
                <h3 className="text-xl font-semibold text-white">3. Information Sharing and Privacy</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-white mb-2">Privacy Protection Measures:</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Masked Contact Information:</strong> Email addresses and phone numbers are hidden from other users for safety</li>
                    <li><strong>Location Privacy:</strong> Full addresses are only shared with assigned taskers; others see approximate locations</li>
                    <li><strong>Controlled Communication:</strong> All communication happens through our secure messaging system</li>
                    <li><strong>Profile Control:</strong> You control what information is displayed on your public profile</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-2">When We Share Information:</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>With Other Users:</strong> Only necessary information for task completion (name, ratings, skills, approximate location)</li>
                    <li><strong>Service Providers:</strong> Payment processors (Stripe), background check services (Checkr), and cloud storage providers</li>
                    <li><strong>Legal Requirements:</strong> When required by law, court orders, or to protect platform safety</li>
                    <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets (with user notification)</li>
                  </ul>
                </div>

                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mt-4">
                  <p className="text-green-300 font-semibold">
                    We NEVER sell your personal information to third parties for marketing purposes.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Data Security */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock size={20} className="text-red-500" />
                <h3 className="text-xl font-semibold text-white">4. Data Security</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>We implement comprehensive security measures to protect your information:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Blockchain Security:</strong> Core data stored on the Internet Computer blockchain for immutability and security</li>
                  <li><strong>Encryption:</strong> All data transmitted and stored is encrypted using industry-standard protocols</li>
                  <li><strong>Access Controls:</strong> Strict access controls limit who can view and modify your information</li>
                  <li><strong>Regular Audits:</strong> Security assessments and monitoring to identify and address vulnerabilities</li>
                  <li><strong>Secure Payments:</strong> PCI-compliant payment processing through trusted providers</li>
                  <li><strong>Identity Verification:</strong> Internet Identity provides secure, privacy-preserving authentication</li>
                </ul>
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mt-4">
                  <p className="text-yellow-300 text-sm">
                    <strong>Note:</strong> While we implement strong security measures, no system is 100% secure. 
                    We encourage users to practice good security habits and report any suspicious activity.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5: Your Privacy Rights */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-blue-500" />
                <h3 className="text-xl font-semibold text-white">5. Your Privacy Rights</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>You have the following rights regarding your personal information:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Access:</strong> View and download your personal information</li>
                  <li><strong>Update:</strong> Modify your profile information, contact details, and preferences</li>
                  <li><strong>Delete:</strong> Request deletion of your account and associated data</li>
                  <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                  <li><strong>Restrict Processing:</strong> Limit how we use your information in certain circumstances</li>
                  <li><strong>Object:</strong> Opt out of certain data processing activities</li>
                  <li><strong>Withdraw Consent:</strong> Remove consent for data processing where applicable</li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, contact us through the platform's support system or messaging interface.
                </p>
              </div>
            </section>

            {/* Section 6: Data Retention */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock size={20} className="text-yellow-500" />
                <h3 className="text-xl font-semibold text-white">6. Data Retention</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>We retain your information for different periods based on the type of data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Profile Information:</strong> Until you delete your account</li>
                  <li><strong>Task and Transaction Data:</strong> 7 years for legal and tax compliance</li>
                  <li><strong>Messages and Communications:</strong> Until account deletion or as required by law</li>
                  <li><strong>Payment Information:</strong> As required by financial regulations (typically 7 years)</li>
                  <li><strong>Technical Logs:</strong> 2 years for security and platform improvement</li>
                  <li><strong>NFT Certificates:</strong> Permanently stored on blockchain (cannot be deleted)</li>
                </ul>
                <p className="mt-4">
                  When you delete your account, we remove or anonymize your personal information, except where 
                  retention is required by law or for legitimate business purposes.
                </p>
              </div>
            </section>

            {/* Section 7: International Data Transfers */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe size={20} className="text-green-500" />
                <h3 className="text-xl font-semibold text-white">7. International Data Transfers</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  Taskmate operates on the Internet Computer blockchain, which is a decentralized global network. 
                  Your data may be processed and stored in various locations worldwide.
                </p>
                <p>
                  We ensure appropriate safeguards are in place for international data transfers, including:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Encryption and security measures</li>
                  <li>Compliance with applicable data protection laws</li>
                  <li>Contractual protections with service providers</li>
                  <li>Regular security assessments</li>
                </ul>
              </div>
            </section>

            {/* Section 8: Children's Privacy */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users size={20} className="text-purple-500" />
                <h3 className="text-xl font-semibold text-white">8. Children's Privacy</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  Taskmate is not intended for use by individuals under the age of 18. We do not knowingly collect 
                  personal information from children under 18 years of age.
                </p>
                <p>
                  If we become aware that we have collected personal information from a child under 18, we will 
                  take steps to delete such information promptly.
                </p>
              </div>
            </section>

            {/* Section 9: Changes to Privacy Policy */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText size={20} className="text-orange-500" />
                <h3 className="text-xl font-semibold text-white">9. Changes to This Privacy Policy</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  We may update this Privacy Policy from time to time to reflect changes in our practices, 
                  technology, legal requirements, or other factors.
                </p>
                <p>
                  When we make significant changes, we will notify users through the platform and update the 
                  "Last updated" date at the top of this policy.
                </p>
                <p>
                  Your continued use of Taskmate after any changes constitutes acceptance of the updated Privacy Policy.
                </p>
              </div>
            </section>

            {/* Section 10: Contact Information */}
            <section className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-blue-500" />
                <h3 className="text-xl font-semibold text-white">10. Contact Us</h3>
              </div>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  If you have questions, concerns, or requests regarding this Privacy Policy or how we handle 
                  your personal information, please contact us through:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>The platform's messaging system</li>
                  <li>Support channels within the application</li>
                  <li>Profile settings and privacy controls</li>
                </ul>
                <p>
                  We are committed to addressing your privacy concerns and will respond to your inquiries promptly.
                </p>
                <p className="text-sm text-gray-400 mt-4">
                  This is a sample Privacy Policy document. In a production environment, you should consult 
                  with legal professionals to ensure compliance with applicable privacy laws and regulations 
                  such as GDPR, CCPA, and other relevant data protection requirements.
                </p>
              </div>
            </section>
          </div>

          {/* Privacy Summary */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mt-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield size={24} className="text-blue-400 flex-shrink-0" />
              <h3 className="text-blue-400 font-bold text-lg">Privacy Summary</h3>
            </div>
            <div className="space-y-2 text-gray-300">
              <p><strong>We collect</strong> information necessary to provide our services safely and effectively.</p>
              <p><strong>We protect</strong> your information with strong security measures and privacy controls.</p>
              <p><strong>We respect</strong> your rights to access, update, and delete your personal information.</p>
              <p><strong>We never sell</strong> your personal information to third parties for marketing purposes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
