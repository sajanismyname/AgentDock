import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, ShieldAlert, Trash2, AlertTriangle, X } from 'lucide-react';

interface SettingsPageProps {
  onNavigate: (path: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { user, deleteAccount } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'DELETE') return;

    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      onNavigate('/login');
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center space-x-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Account Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage your AgentDock account and data</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">User Profile</h2>
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5 uppercase tracking-wider">Email Address:</span>
              <span className="text-slate-200">{user?.email}</span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5 uppercase tracking-wider">Member Since:</span>
              <span className="text-slate-200">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Data & Deletion Card (Section 55/56) */}
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-rose-400 font-semibold mb-1">
                <ShieldAlert className="w-4 h-4" />
                <span>Delete Account & Data</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                Permanently delete your account and all associated resources, including connected agents, behavioral rules, test cases, and historical test run results. This action cannot be undone.
              </p>
            </div>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-medium px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 text-rose-400 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white">Confirm Data Deletion</h2>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              This will permanently delete your account (<strong className="text-white">{user?.email}</strong>) and all agents, rules, and test results.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  Type <strong className="text-rose-400">DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:border-rose-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmText !== 'DELETE' || deleting}
                  className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Permanently Delete Everything'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
