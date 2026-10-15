import React, { useState } from 'react';
import { TestResult } from '../types';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  Check,
} from 'lucide-react';

interface FailureCardProps {
  result: TestResult;
  onSaveRegression?: (testCaseId: string) => Promise<void>;
}

export const FailureCard: React.FC<FailureCardProps> = ({ result, onSaveRegression }) => {
  const [showTechnical, setShowTechnical] = useState(false);
  const [savingRegression, setSavingRegression] = useState(false);
  const [savedRegression, setSavedRegression] = useState(
    result.testCase?.isRegression || false
  );

  const isPass = result.status === 'PASS';
  const isWarning = result.status === 'WARNING';
  const isFail = result.status === 'CRITICAL_FAILURE';

  const handleSaveRegression = async () => {
    if (!onSaveRegression || savedRegression || savingRegression) return;
    setSavingRegression(true);
    try {
      await onSaveRegression(result.testCaseId);
      setSavedRegression(true);
    } finally {
      setSavingRegression(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isPass
          ? 'bg-slate-900/50 border-emerald-900/40 hover:border-emerald-800/60'
          : isWarning
          ? 'bg-slate-900/60 border-amber-900/40 hover:border-amber-800/60'
          : 'bg-slate-900/70 border-rose-900/50 hover:border-rose-800/70'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-3">
          {isPass && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
          {isFail && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}

          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider font-mono ${
              isPass
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : isWarning
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            {result.status.replace('_', ' ')}
          </span>

          <span className="text-xs font-mono text-slate-500">
            {result.technicalDetails?.durationMs || 0}ms
          </span>
        </div>

        {/* Save Regression Action */}
        {!isPass && (
          <button
            onClick={handleSaveRegression}
            disabled={savedRegression || savingRegression}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center space-x-1.5 transition-colors self-start sm:self-auto ${
              savedRegression
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            {savedRegression ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved as regression test</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3.5 h-3.5 text-sky-400" />
                <span>{savingRegression ? 'Saving...' : 'Save as regression test'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 4 Core Questions: Progressive Explanation */}
      <div className="mt-4 space-y-3.5 text-sm">
        <div>
          <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block mb-1">
            What did we test?
          </span>
          <p className="text-slate-200 font-medium bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs">
            {result.explanation.whatTested}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block mb-1">
              What should have happened?
            </span>
            <p className="text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-xs leading-relaxed">
              {result.explanation.whatShouldHaveHappened}
            </p>
          </div>

          <div>
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block mb-1">
              What happened?
            </span>
            <p
              className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                isPass
                  ? 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                  : 'bg-rose-950/20 border-rose-900/30 text-rose-200'
              }`}
            >
              {result.explanation.whatHappened}
            </p>
          </div>
        </div>

        {!isPass && (
          <div>
            <span className="text-xs uppercase font-mono tracking-wider text-rose-400 block mb-1">
              Why is it a failure?
            </span>
            <p className="text-rose-300 font-medium bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30 text-xs leading-relaxed">
              {result.explanation.whyFailed}
            </p>
          </div>
        )}
      </div>

      {/* Expandable Technical Details (Progressive Disclosure) */}
      <div className="mt-4 pt-3 border-t border-slate-800/60">
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors focus:outline-none"
        >
          <span>▸ Technical details</span>
          {showTechnical ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showTechnical && (
          <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3 font-mono text-xs text-slate-300 overflow-x-auto">
            <div>
              <span className="text-slate-500 block mb-0.5">HTTP Status:</span>
              <span className="text-sky-400">{result.technicalDetails.httpStatus || 200}</span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Request Payload:</span>
              <pre className="bg-slate-900 p-2 rounded text-slate-200 overflow-x-auto text-[11px]">
                {JSON.stringify(result.requestPayload, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Raw Agent Response:</span>
              <pre className="bg-slate-900 p-2 rounded text-slate-200 overflow-x-auto text-[11px]">
                {JSON.stringify(result.responsePayload, null, 2)}
              </pre>
            </div>

            {Boolean(result.toolCalls) && (
              <div>
                <span className="text-slate-500 block mb-0.5">Tool Calls Detected:</span>
                <pre className="bg-slate-900 p-2 rounded text-amber-300 overflow-x-auto text-[11px]">
                  {JSON.stringify(result.toolCalls, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <span className="text-slate-500 block mb-0.5">Evaluator Trace:</span>
              <p className="text-slate-400 text-[11px]">{String(result.technicalDetails.evaluatorOutput || '')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
