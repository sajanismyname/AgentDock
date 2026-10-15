import React, { useState, useEffect, useRef } from 'react';
import { TestRun, TestResult } from '../types';
import { api } from '../services/api';
import { FailureCard } from '../components/FailureCard';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface RunDetailPageProps {
  runId: string;
  onNavigate: (path: string) => void;
}

export const RunDetailPage: React.FC<RunDetailPageProps> = ({ runId, onNavigate }) => {
  const [run, setRun] = useState<(TestRun & { results: TestResult[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'failed' | 'passed'>('all');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRun = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const res = await api.runs.getById(runId);
      setRun(res.run);

      // If run reached terminal state, stop polling
      if (res.run.status === 'completed' || res.run.status === 'failed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to load test run details');
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRun(true);

    // Set up polling interval to check run progress
    pollingRef.current = setInterval(() => {
      fetchRun(false);
    }, 1500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [runId]);

  const handleSaveRegression = async (testCaseId: string) => {
    await api.tests.saveAsRegression(testCaseId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3 text-slate-400 font-mono text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
        <span>Loading test results...</span>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-slate-400">
        Run not found.{' '}
        <button onClick={() => onNavigate('/agents')} className="text-sky-400 underline">
          Back to agents
        </button>
      </div>
    );
  }

  const isPendingOrRunning = run.status === 'pending' || run.status === 'running' || run.status === 'queued';
  const results = run.results || [];
  const filteredResults = results.filter((r) => {
    if (filter === 'failed') return r.status !== 'PASS';
    if (filter === 'passed') return r.status === 'PASS';
    return true;
  });

  const passedCount = run.passedTests;
  const failedCount = run.failedTests;
  const totalCount = run.totalTests;
  const scorePercent = run.score !== null ? run.score : Math.round((passedCount / (totalCount || 1)) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Back Button */}
      <button
        onClick={() => onNavigate(`/agents/${run.agentId}`)}
        className="text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-1.5 mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Agent</span>
      </button>

      {/* Pending / Running Async Progress Indicator */}
      {isPendingOrRunning && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {run.status === 'pending' || run.status === 'queued'
                    ? 'Test Run Queued'
                    : 'Executing Remote Tests...'}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded font-mono uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse">
                  {run.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Valkey background worker is securely dispatching tests to the agent endpoint.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
            Auto-polling status every 1.5s
          </div>
        </div>
      )}

      {/* Run Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">Test Run Results</h1>
              <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                {run.suiteType} suite
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono uppercase border ${
                  run.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : run.status === 'failed'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                }`}
              >
                {run.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Started {new Date(run.createdAt).toLocaleString()}
              {run.completedAt && ` • Completed ${new Date(run.completedAt).toLocaleTimeString()}`}
            </p>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <span className="text-xs uppercase font-mono text-slate-400 block mb-0.5">
                Pass Rate
              </span>
              <span
                className={`text-2xl font-bold font-mono ${
                  run.status !== 'completed'
                    ? 'text-slate-400'
                    : scorePercent >= 80
                    ? 'text-emerald-400'
                    : scorePercent >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {run.status === 'completed' && run.score !== null ? `${run.score}%` : '--'}
              </span>
            </div>

            <div className="h-10 w-px bg-slate-800" />

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{passedCount} passed</span>
              </div>
              <div className="flex items-center space-x-1.5 text-rose-400">
                <XCircle className="w-4 h-4" />
                <span>{failedCount} failed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex border border-slate-800">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${(passedCount / (totalCount || 1)) * 100}%` }}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{ width: `${(failedCount / (totalCount || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Tests ({results.length})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filter === 'failed'
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Failed Only ({failedCount})
          </button>
          <button
            onClick={() => setFilter('passed')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              filter === 'passed'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Passed Only ({passedCount})
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
            {isPendingOrRunning
              ? 'Results will appear once tests complete execution...'
              : 'No test results match this filter.'}
          </div>
        ) : (
          filteredResults.map((result) => (
            <FailureCard
              key={result.id}
              result={result}
              onSaveRegression={handleSaveRegression}
            />
          ))
        )}
      </div>
    </div>
  );
};
