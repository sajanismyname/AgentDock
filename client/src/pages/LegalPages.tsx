import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPage: React.FC<LegalPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => onNavigate('/agents')}
        className="text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-1.5 mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Application</span>
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 prose prose-invert max-w-none text-xs text-slate-300 space-y-4">
        <div className="flex items-center space-x-2 text-sky-400 mb-2">
          <ShieldCheck className="w-5 h-5" />
          <h1 className="text-xl font-bold text-white m-0">Privacy Policy</h1>
        </div>

        <p className="text-slate-400">Last updated: October 2026</p>

        <h2 className="text-sm font-semibold text-white mt-4">1. Information We Process</h2>
        <p>
          AgentDock collects account information (email address and securely hashed credentials), agent endpoint configuration, and test results generated during automated test runs.
        </p>

        <h2 className="text-sm font-semibold text-white mt-4">2. Credential Security</h2>
        <p>
          Authentication tokens and credentials provided for agent communication are encrypted at rest using industry-standard AES-256-GCM. Secret values are redacted before evaluation.
        </p>

        <h2 className="text-sm font-semibold text-white mt-4">3. Data Deletion (Right to be Forgotten)</h2>
        <p>
          Users may delete their account and all associated agents, rules, test cases, and historical test run results at any time via Account Settings. All data is purged permanently upon request.
        </p>
      </div>
    </div>
  );
};

export const TermsPage: React.FC<LegalPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => onNavigate('/agents')}
        className="text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-1.5 mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Application</span>
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-xs text-slate-300 space-y-4">
        <h1 className="text-xl font-bold text-white">Terms of Service</h1>
        <p className="text-slate-400">Last updated: October 2026</p>
        <h2 className="text-sm font-semibold text-white mt-4">Acceptable Use</h2>
        <p>
          AgentDock is designed for testing and verifying the behavior of AI agents owned or authorized by the account holder. Users must not use the platform to target third-party systems without authorization or execute Denial of Service attacks.
        </p>
      </div>
    </div>
  );
};
