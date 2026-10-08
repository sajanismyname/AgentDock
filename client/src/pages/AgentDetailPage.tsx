import React, { useState, useEffect } from 'react';
import { Agent, Rule, RuleType, TestCase, TestRun } from '../types';
import { api } from '../services/api';
import {
  Server,
  Play,
  Sparkles,
  ShieldAlert,
  FileCheck,
  History,
  Plus,
  Trash2,
  AlertCircle,
  X,
  ExternalLink,
  Lock,
  BookmarkPlus,
} from 'lucide-react';

interface AgentDetailPageProps {
  agentId: string;
  onNavigate: (path: string) => void;
}

export const AgentDetailPage: React.FC<AgentDetailPageProps> = ({ agentId, onNavigate }) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'tests' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Action States
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleType, setRuleType] = useState<RuleType>('forbidden_action');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleConfigTool, setRuleConfigTool] = useState('');
  const [submittingRule, setSubmittingRule] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [agentRes, rulesRes, testsRes, runsRes] = await Promise.all([
        api.agents.getById(agentId),
        api.rules.list(agentId),
        api.tests.list(agentId),
        api.runs.list(agentId),
      ]);

      setAgent(agentRes.agent);
      setRules(rulesRes.rules);
      setTests(testsRes.tests);
      setRuns(runsRes.runs);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to load agent details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [agentId]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRule(true);
    try {
      const config: Record<string, unknown> = {};
      if (ruleType === 'tool_restriction' && ruleConfigTool) {
        config.toolName = ruleConfigTool.trim();
      }

      await api.rules.create(agentId, {
        type: ruleType,
        description: ruleDescription,
        config,
      });

      setShowRuleModal(false);
      setRuleDescription('');
      setRuleConfigTool('');
      const updated = await api.rules.list(agentId);
      setRules(updated.rules);
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to create rule');
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await api.rules.delete(agentId, ruleId);
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to delete rule');
    }
  };

  const handleGenerateTests = async () => {
    setGeneratingTests(true);
    try {
      const res = await api.tests.generate(agentId);
      setTests(res.tests);
      setActiveTab('tests');
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to generate tests');
    } finally {
      setGeneratingTests(false);
    }
  };

  const handleTriggerRun = async (suite: 'all' | 'regression' = 'all') => {
    setTriggeringRun(true);
    try {
      const res = await api.runs.trigger(agentId, suite);
      onNavigate(`/runs/${res.run.id}`);
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to start test run');
    } finally {
      setTriggeringRun(false);
    }
  };

  const handleSaveRegression = async (testId: string) => {
    try {
      const res = await api.tests.saveAsRegression(testId);
      setTests(tests.map((t) => (t.id === testId ? res.test : t)));
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to save regression test');
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;
    try {
      await api.tests.delete(agentId, testId);
      setTests(tests.filter((t) => t.id !== testId));
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to delete test');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-mono text-xs">
        Loading agent workspace...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-slate-400">
        Agent not found.{' '}
        <button onClick={() => onNavigate('/agents')} className="text-sky-400 underline">
          Back to agents
        </button>
      </div>
    );
  }

  const regressionCount = tests.filter((t) => t.isRegression).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">{agent.name}</h1>
                {agent.hasCredential && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Auth</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">{agent.endpoint}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            {regressionCount > 0 && (
              <button
                onClick={() => handleTriggerRun('regression')}
                disabled={triggeringRun}
                className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 font-medium px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run Regression Suite ({regressionCount})</span>
              </button>
            )}

            <button
              onClick={() => handleTriggerRun('all')}
              disabled={triggeringRun || tests.length === 0}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{triggeringRun ? 'Starting Run...' : 'Run All Tests'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === 'rules'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Rules</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono">
              {rules.length}/5
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === 'tests'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Test Cases</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono">
              {tests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Run History</span>
            <span className="ml-1 px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono">
              {runs.length}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <span className="text-xs uppercase font-mono text-slate-400 block mb-1">
                Active Rules
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-white">{rules.length}</span>
                <span className="text-xs text-slate-500 font-mono">of 5 max</span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <span className="text-xs uppercase font-mono text-slate-400 block mb-1">
                Generated Tests
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-white">{tests.length}</span>
                <span className="text-xs text-slate-500 font-mono">
                  ({regressionCount} regression)
                </span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <span className="text-xs uppercase font-mono text-slate-400 block mb-1">
                Latest Score
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-white">
                  {runs.length > 0 && runs[0].score !== null ? `${runs[0].score}%` : 'N/A'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {runs.length > 0 ? `${runs[0].passedTests}/${runs[0].totalTests} passed` : 'No runs yet'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Steps Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-4">Testing Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center space-x-2 text-sky-400 font-semibold mb-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-mono">
                    1
                  </span>
                  <span>Define Behavioral Rules</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Specify what the agent is forbidden to do, when it requires approval, and data boundaries.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center space-x-2 text-sky-400 font-semibold mb-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-mono">
                    2
                  </span>
                  <span>Generate Test Cases</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  AgentDock expands your rules into attack archetypes (direct requests, overrides, false authority).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center space-x-2 text-sky-400 font-semibold mb-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-mono">
                    3
                  </span>
                  <span>Execute & Prevent Regressions</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Inspect why tests failed with 4 clear questions and save failures to your regression suite.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Defined Behavioral Rules</h2>
            <button
              onClick={() => setShowRuleModal(true)}
              disabled={rules.length >= 5}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rule</span>
            </button>
          </div>

          {rules.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
              No rules defined yet. Click "Add Rule" to configure up to 5 behavioral boundaries for this agent.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] px-2 py-0.5 rounded font-mono uppercase bg-sky-500/10 border border-sky-500/30 text-sky-400">
                        {rule.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 font-medium">{rule.description}</p>
                    {rule.config && Object.keys(rule.config).length > 0 && (
                      <p className="text-xs text-slate-500 font-mono">
                        Config: {JSON.stringify(rule.config)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tests */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Generated Test Cases</h2>
            <button
              onClick={handleGenerateTests}
              disabled={generatingTests || rules.length === 0}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generatingTests ? 'Generating...' : 'Generate Tests from Rules'}</span>
            </button>
          </div>

          {tests.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
              No test cases generated. Add rules and click "Generate Tests from Rules" to create variations.
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {test.archetype.replace('_', ' ')}
                      </span>
                      {test.isRegression && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          Regression
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] font-mono text-slate-500 block mb-0.5">Prompt:</span>
                      <p className="text-xs text-slate-200 font-mono bg-slate-950 p-2 rounded border border-slate-800/80">
                        {test.prompt}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-mono text-slate-500 block mb-0.5">Expected:</span>
                      <p className="text-xs text-slate-400">{test.expectedBehavior}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end md:self-auto">
                    {!test.isRegression && (
                      <button
                        onClick={() => handleSaveRegression(test.id)}
                        className="p-1.5 text-xs text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 border border-slate-800 rounded-lg flex items-center space-x-1"
                        title="Mark as regression test"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTest(test.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white">Run History</h2>
          {runs.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
              No test runs yet. Click "Run All Tests" above to execute your test suite.
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => onNavigate(`/runs/${run.id}`)}
                  className="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-xs font-bold">
                      {run.score !== null ? `${run.score}%` : '--'}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-white uppercase font-mono">
                          {run.suiteType} Suite
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          ({run.passedTests}/{run.totalTests} passed)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-sky-400 text-xs">
                    <span>View Results</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowRuleModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-4">Add Behavioral Rule</h2>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Rule Type
                </label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as RuleType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="forbidden_action">Forbidden Action (Strict refusal)</option>
                  <option value="requires_approval">Requires Approval (Must verify with supervisor)</option>
                  <option value="data_restriction">Data Restriction (Privacy / Sensitive info)</option>
                  <option value="tool_restriction">Tool Restriction (Must not invoke tool)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="e.g. Never issue a refund over $100 without manager approval"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {ruleType === 'tool_restriction' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 font-mono uppercase tracking-wider">
                    Restricted Tool Name
                  </label>
                  <input
                    type="text"
                    value={ruleConfigTool}
                    onChange={(e) => setRuleConfigTool(e.target.value)}
                    placeholder="e.g. delete_customer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRule}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {submittingRule ? 'Saving...' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
