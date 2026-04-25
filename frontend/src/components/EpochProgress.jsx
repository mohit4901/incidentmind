export function EpochProgress({ current, total, status, rewardHistory }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const latestReward = rewardHistory?.length > 0 ? rewardHistory[rewardHistory.length - 1] : null;

  const statusColors = {
    training: 'from-violet-600 to-violet-400',
    complete: 'from-emerald-600 to-emerald-400',
    error: 'from-red-600 to-red-400',
    idle: 'from-gray-600 to-gray-400',
  };

  const barColor = statusColors[status] || statusColors.idle;

  return (
    <div className="glass rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Training Progress</span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'training' && (
            <span className="text-xs text-violet-400 font-mono font-bold">
              {current}/{total}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            status === 'training' ? 'bg-violet-900/50 text-violet-400' :
            status === 'complete' ? 'bg-emerald-900/50 text-emerald-400' :
            status === 'error' ? 'bg-red-900/50 text-red-400' :
            'bg-gray-800 text-gray-400'
          }`}>
            {status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Epoch" value={`${current}/${total}`} />
        <Stat
          label="Latest Reward"
          value={latestReward != null ? (latestReward >= 0 ? '+' : '') + latestReward.toFixed(2) : '—'}
          color={latestReward != null ? (latestReward >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-500'}
        />
        <Stat label="Progress" value={`${percent}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'text-white' }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
