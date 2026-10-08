import React, { useState, useEffect } from 'react';
import { Agent } from '../types';
import { api } from '../services/api';
import {
  Server,
  Plus,
  ArrowRight,
  Globe,
  Key,
  Trash2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface AgentsPageProps {
  onNavigate: (path: string) => void;
}

export const AgentsPage: React.FC<AgentsPageProps> = ({ onNavigate }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [credential, setCredential] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await api.agents.list();
      setAgents(res.agents);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await api.agents.create({
        name,
        description: description || null,
        endpoint,
        credential: credential || null,
      });

      setShowModal(false);
      setName('');
      setDescription('');
      setEndpoint('');
      setCredential('');
      onNavigate(`/agents/${res.agent.id}`);
    } catch (err: unknown) {
      const e = err as Error;
      setFormError(e.message || 'Failed to create agent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAgent = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this agent? All rules, tests, and run history will be removed.')) {
      return;
    }

    try {
      await api.agents.delete(agentId);
      setAgents(agents.filter((a) => a.id !== agentId));
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to delete agent');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connected Agents</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect and configure remote AI agents for automated behavioral testing
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm flex items-center space-x-2 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Agent</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 font-mono text-xs">
          Loading agents...
        </div>
      ) : agents.length === 0 ? (
        /* Empty State */
        <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-8 bg-slate-900/30">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-4">
            <Server className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">No agents connected yet</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Connect an existing HTTP agent endpoint and AgentDock will help you define rules, generate tests, and prevent regressions.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-sm inline-flex items-center space-x-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Your First Agent</span>
          </button>
        </div>
      ) : (
        /* Agents Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => onNavigate(`/agents/${agent.id}`)}
              className="group cursor-pointer bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                        {agent.name}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-mono block">
                        Added {new Date(agent.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteAgent(e, agent.id)}
                    title="Delete agent"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {agent.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {agent.description}
                  </p>
                )}

                <div className="space-y-1.5 pt-3 border-t border-slate-800/60 font-mono text-[11px]">
                  <div className="flex items-center space-x-1.5 text-slate-400 truncate">
                    <Globe className="w-3 h-3 shrink-0 text-slate-500" />
                    <span className="truncate">{agent.endpoint}</span>
                  </div>

                  {agent.hasCredential && (
                    <div className="flex items-center space-x-1.5 text-emerald-400">
                      <Key className="w-3 h-3 shrink-0" />
                      <span>Encrypted credential attached</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between text-xs font-medium text-sky-400 group-hover:text-sky-300 border-t border-slate-800/40">
                <span>Configure & Test</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Connect an AI Agent</h2>
                <p className="text-xs text-slate-400">Add an HTTP endpoint for remote testing</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Customer Support Bot"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Handles billing inquiries and refunds"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  HTTP Endpoint URL *
                </label>
                <input
                  type="url"
                  required
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://agent.yourdomain.com/api/chat"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Bearer Token / API Key (Optional)
                </label>
                <input
                  type="password"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="Will be encrypted with AES-256-GCM"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Connecting...' : 'Connect Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
