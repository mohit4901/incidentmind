export function BeforeAfterComparison({ trained, untrained }) {
  if (!trained && !untrained) {
    return (
      <div className="glass rounded-xl p-6 text-center text-gray-600 text-sm">
        Run episodes with both agent types to see comparison
      </div>
    );
  }

  const metrics = [
    {
      label: 'Avg Reward',
      trained: trained?.avgReward,
      untrained: untrained?.avgReward,
      format: (v) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) : '—',
      goodWhen: 'higher',
    },
    {
      label: 'Resolution Rate',
      trained: trained?.totalCount > 0 ? (trained.resolvedCount / trained.totalCount * 100) : null,
      untrained: untrained?.totalCount > 0 ? (untrained.resolvedCount / untrained.totalCount * 100) : null,
      format: (v) => v != null ? v.toFixed(0) + '%' : '—',
      goodWhen: 'higher',
    },
    {
      label: 'Avg Steps',
      trained: trained?.avgSteps,
      untrained: untrained?.avgSteps,
      format: (v) => v != null ? v.toFixed(1) : '—',
      goodWhen: 'lower',
    },
    {
      label: 'Episodes Run',
      trained: trained?.totalCount,
      untrained: untrained?.totalCount,
      format: (v) => v != null ? v.toString() : '0',
      goodWhen: null,
    },
  ];

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800/50 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Before vs After</span>
      </div>

      {/* Table */}
      <div className="divide-y divide-gray-800/30">
        {/* Column headers */}
        <div className="grid grid-cols-3 px-5 py-2.5 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
          <span>Metric</span>
          <span className="text-center">Untrained</span>
          <span className="text-center">Trained</span>
        </div>

        {metrics.map((m) => {
          const trainedBetter = m.goodWhen === 'higher'
            ? (m.trained || 0) > (m.untrained || 0)
            : m.goodWhen === 'lower'
            ? (m.trained || Infinity) < (m.untrained || Infinity)
            : false;

          return (
            <div key={m.label} className="grid grid-cols-3 px-5 py-3 items-center hover:bg-gray-800/20 transition-colors">
              <span className="text-xs text-gray-400 font-medium">{m.label}</span>
              <span className="text-center text-sm font-mono font-bold text-red-400/80">
                {m.format(m.untrained)}
              </span>
              <span className={`text-center text-sm font-mono font-bold ${trainedBetter ? 'text-emerald-400' : 'text-gray-300'}`}>
                {m.format(m.trained)}
                {trainedBetter && m.trained != null && m.untrained != null && (
                  <span className="ml-1.5 text-[10px] text-emerald-500">▲</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
