import { useRef, useEffect } from 'react';

const ACTION_CONFIG = {
  query_logs:       { icon: '🔍', color: 'text-accent-cyan',   bg: 'bg-[#002b36]', border: 'border-accent-cyan/20' },
  fetch_metric:     { icon: '📊', color: 'text-accent-cyan',   bg: 'bg-[#002b36]', border: 'border-accent-cyan/20' },
  run_kubectl:      { icon: '⚙️', color: 'text-accent-amber',  bg: 'bg-[#3b2a00]', border: 'border-accent-amber/20' },
  read_runbook:     { icon: '📖', color: 'text-accent-amber',  bg: 'bg-[#3b2a00]', border: 'border-accent-amber/20' },
  post_hypothesis:  { icon: '💡', color: 'text-accent-violet', bg: 'bg-[#2d0057]', border: 'border-accent-violet/20' },
  execute_fix:      { icon: '🔧', color: 'text-accent-green',  bg: 'bg-[#003d24]', border: 'border-accent-green/20' },
  check_deploy_diff:{ icon: '🔀', color: 'text-accent-amber',  bg: 'bg-[#3b2a00]', border: 'border-accent-amber/20' },
  query_slack:      { icon: '💬', color: 'text-accent-violet', bg: 'bg-[#2d0057]', border: 'border-accent-violet/20' },
  page_human:       { icon: '📟', color: 'text-accent-red',    bg: 'bg-[#4a001a]', border: 'border-accent-red/20' },
  mark_resolved:    { icon: '✅', color: 'text-accent-green',  bg: 'bg-[#003d24]', border: 'border-accent-green/30' },
};

export function AgentActionLog({ steps, isRunning }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  return (
    <div className="obsidian-pane p-6 h-full flex flex-col max-h-[600px] border border-white/5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 font-black text-[40px] text-white/[0.02] select-none pointer-events-none">LOG_STREAM</div>
      
      <div className="flex items-center gap-2 mb-8 relative z-10">
        <div className="section-label">Neural_Telemetry</div>
        {isRunning && (
          <div className="flex gap-1 ml-2">
            <span className="w-1.5 h-1.5 bg-accent-cyan animate-ping" />
          </div>
        )}
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-2 relative z-10">
        {steps.length === 0 && !isRunning ? (
          <div className="h-48 flex flex-col items-center justify-center text-[10px] text-[#4a5068] uppercase tracking-[0.4em] font-bold opacity-40 italic">
             Awaiting System Signal...
          </div>
        ) : (
          steps.map((step, i) => {
            const cfg = ACTION_CONFIG[step.action] || { icon: '→', color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' };
            const positive = step.reward > 0;
            return (
              <div key={i} className={`p-4 border shadow-2xl relative overflow-hidden transition-all ${step.pending_approval ? 'border-accent-amber bg-[#3b2a00]' : cfg.bg + ' ' + cfg.border}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{cfg.icon}</span>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${cfg.color}`}>{step.action}</span>
                  </div>
                  <div className={`text-[11px] font-black ${positive ? 'text-accent-green' : 'text-accent-red'}`}>
                    {positive ? '+' : ''}{step.reward?.toFixed(2)}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-[#4a5068] font-bold uppercase tracking-widest flex justify-between">
                   <span>Σ {step.cumulative_reward?.toFixed(2)}</span>
                   <span>t={step.observation_summary?.time_elapsed || 0}m</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
