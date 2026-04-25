import { useRef, useEffect } from 'react';

const ACTION_CONFIG = {
  query_logs:       { icon: '🔍', color: 'text-blue-400',    bg: 'bg-blue-950/60',    border: 'border-blue-800/30' },
  fetch_metric:     { icon: '📊', color: 'text-cyan-400',    bg: 'bg-cyan-950/60',    border: 'border-cyan-800/30' },
  run_kubectl:      { icon: '⚙️', color: 'text-yellow-400',  bg: 'bg-yellow-950/60',  border: 'border-yellow-800/30' },
  read_runbook:     { icon: '📖', color: 'text-orange-400',  bg: 'bg-orange-950/60',  border: 'border-orange-800/30' },
  post_hypothesis:  { icon: '💡', color: 'text-violet-400',  bg: 'bg-violet-950/60',  border: 'border-violet-800/30' },
  execute_fix:      { icon: '🔧', color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800/30' },
  check_deploy_diff:{ icon: '🔀', color: 'text-orange-400',  bg: 'bg-orange-950/60',  border: 'border-orange-800/30' },
  query_slack:      { icon: '💬', color: 'text-pink-400',    bg: 'bg-pink-950/60',    border: 'border-pink-800/30' },
  page_human:       { icon: '📟', color: 'text-red-400',     bg: 'bg-red-950/60',     border: 'border-red-800/30' },
  mark_resolved:    { icon: '✅', color: 'text-emerald-300', bg: 'bg-emerald-900/60', border: 'border-emerald-700/30' },
};

export function AgentActionLog({ steps, isRunning }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  if (steps.length === 0 && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-600">
        <div className="text-5xl mb-4">🤖</div>
        <div className="text-sm font-medium">Agent idle</div>
        <div className="text-xs mt-1 text-gray-700">Run an episode to watch the agent diagnose an incident</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Agent Actions</div>
        {isRunning && (
          <div className="flex gap-1 ml-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        <span className="text-xs text-gray-600 ml-auto">{steps.length} steps</span>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const cfg = ACTION_CONFIG[step.action] || { icon: '→', color: 'text-gray-400', bg: 'bg-gray-900/50', border: 'border-gray-800/30' };
          const positive = step.reward > 0;

          return (
            <div key={i} className="flex gap-3 items-start animate-fade-in">
              {/* Step number */}
              <div className="text-[10px] text-gray-600 w-5 pt-2.5 text-right flex-shrink-0 font-mono">
                {step.step}
              </div>

              {/* Action card */}
              <div className={`flex-1 rounded-lg px-4 py-2.5 border ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">{cfg.icon}</span>
                    <span className={`font-mono text-xs font-semibold ${cfg.color}`}>{step.action}</span>
                    {step.kwargs && Object.keys(step.kwargs).length > 0 && (
                      <span className="text-[10px] text-gray-500 truncate">
                        ({Object.entries(step.kwargs).map(([k, v]) => {
                          const val = typeof v === 'string' ? v : JSON.stringify(v);
                          return `${k}=${val.length > 25 ? val.slice(0, 25) + '…' : val}`;
                        }).join(', ')})
                      </span>
                    )}
                  </div>
                  <div className={`text-xs font-mono font-bold flex-shrink-0 ml-3 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{step.reward?.toFixed(2)}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-600">
                  <span>Σ {step.cumulative_reward?.toFixed(2)}</span>
                  <span>t={step.observation_summary?.time_elapsed || 0}m</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
