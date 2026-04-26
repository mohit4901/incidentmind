export function EpochProgress({ current, total, status, rewardHistory }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const latestReward = rewardHistory?.length > 0 ? rewardHistory[rewardHistory.length - 1] : null;

  return (
    <div className="crystal-card p-5 animate-fade-in relative z-10 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">Training Progress</span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted font-bold">
              <span className="text-text-primary text-sm mr-1">{current}</span>/ {total}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 border uppercase tracking-[0.2em] ${
              status === 'training' ? 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet' :
              status === 'complete' ? 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan' :
              status === 'error' ? 'border-accent-red/30 bg-accent-red/10 text-accent-red' :
              'border-white/10 bg-white/5 text-text-secondary'
            }`}>
              {status}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-white/[0.04] w-full mb-6 relative">
          <div
            className="absolute top-0 left-0 h-full bg-shimmer-gradient bg-[length:200%_100%] animate-shimmer-fast"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatNode
          label="Epoch"
          value={`${current}/${total}`}
          accentColor="#7c3aed"
          accentClass="border-accent-violet"
          shadowClass="shadow-[inset_0_0_30px_rgba(124,58,237,0.03)]"
        />
        <StatNode
          label="Latest Reward"
          value={latestReward != null ? (latestReward >= 0 ? '+' : '') + latestReward.toFixed(2) : '0.00'}
          color={latestReward != null ? (latestReward >= 0 ? 'text-accent-green' : 'text-accent-red') : 'text-text-primary'}
          accentColor={latestReward != null ? (latestReward >= 0 ? '#00ff88' : '#ff3355') : '#4a5068'}
          accentClass={latestReward != null ? (latestReward >= 0 ? 'border-accent-green' : 'border-accent-red') : 'border-text-muted'}
          shadowClass={latestReward != null ? (latestReward >= 0 ? 'shadow-[inset_0_0_30px_rgba(0,255,136,0.03)]' : 'shadow-[inset_0_0_30px_rgba(255,51,85,0.03)]') : ''}
          delta={latestReward != null ? (latestReward >= 0 ? '▲ improving' : '▼ declining') : null}
        />
        <StatNode
          label="Progress"
          value={`${percent}%`}
          accentColor="#00d4ff"
          accentClass="border-accent-cyan"
          shadowClass="shadow-[inset_0_0_30px_rgba(0,212,255,0.03)]"
        />
      </div>
    </div>
  );
}

function StatNode({ label, value, color = 'text-text-primary', accentClass, shadowClass, delta }) {
  return (
    <div className={`bg-obsidian border-l-2 ${accentClass} ${shadowClass} relative`}>
      <div className="px-3 py-2">
        <div className="text-[10px] text-text-muted uppercase tracking-[0.2em] mb-1">{label}</div>
        <div className="h-[1px] w-full bg-white/[0.04] mb-2" />
        <div className={`text-xl font-bold tracking-tight ${color}`}>{value}</div>
        {delta && (
          <div className={`text-[9px] mt-1 uppercase tracking-widest ${delta.includes('▲') ? 'text-accent-green' : 'text-accent-red'}`}>
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}
