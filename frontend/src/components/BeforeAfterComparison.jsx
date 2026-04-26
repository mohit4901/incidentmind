export function BeforeAfterComparison({ trained, untrained }) {
  if (!trained && !untrained) {
    return (
      <div className="obsidian-pane p-24 text-center border border-white/5">
        <div className="text-[12px] font-black text-text-muted tracking-[0.5em] uppercase opacity-30 animate-pulse">Awaiting_Neural_Parity_Data</div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'AVERAGE_REWARD',
      trained: trained?.avgReward,
      untrained: untrained?.avgReward,
      format: (v) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) : '0.00',
    },
    {
      label: 'RESOLUTION_RATE',
      trained: trained?.total > 0 ? (trained.resolvedCount / trained.total * 100) : null,
      untrained: untrained?.total > 0 ? (untrained.resolvedCount / untrained.total * 100) : null,
      format: (v) => v != null ? v.toFixed(0) + '%' : '0%',
    },
    {
      label: 'ITERATION_DEPTH',
      trained: trained?.avgSteps,
      untrained: untrained?.avgSteps,
      format: (v) => v != null ? v.toFixed(1) : '—',
    },
    {
      label: 'TOTAL_TELEMETRY',
      trained: trained?.total,
      untrained: untrained?.total,
      format: (v) => v != null ? v.toString() : '0',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 h-full bg-white/5 p-[1px]">
      {/* UNTRAINED PANEL */}
      <div className="bg-void p-12 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-[2px] h-full bg-accent-red opacity-40" />
        <div className="relative z-10">
          <div className="text-[10px] font-black text-accent-red tracking-[0.4em] uppercase mb-1">UNTRAINED_MODEL</div>
          <div className="text-[11px] text-[#4a5068] font-bold mb-12">v0.1_base_uncalibrated</div>
          
          <div className="space-y-12">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="text-[9px] text-[#4a5068] font-black tracking-widest mb-3 uppercase">{m.label}</div>
                <div className="text-4xl font-black text-text-primary opacity-30 group-hover:opacity-60 transition-opacity font-mono">
                  {m.format(m.untrained)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRAINED PANEL */}
      <div className="bg-void p-12 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-[3px] h-full bg-accent-cyan shadow-[0_0_20px_#00d4ff]" />
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-accent-cyan/5 blur-[100px] rounded-full group-hover:bg-accent-cyan/10 transition-all" />
        
        <div className="relative z-10">
          <div className="text-[10px] font-black text-accent-cyan tracking-[0.4em] uppercase mb-1">EVOLVED_AGENT</div>
          <div className="text-[11px] text-[#4a5068] font-bold mb-12">grpo_optimized_vault_main</div>
          
          <div className="space-y-12">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="text-[9px] text-accent-cyan font-black tracking-widest mb-3 uppercase">{m.label}</div>
                <div className="text-4xl font-black text-white shadow-text shadow-accent-cyan/20 group-hover:scale-105 transition-transform origin-left">
                  {m.format(m.trained)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
