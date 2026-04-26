export function IncidentPanel({ alert, podStatus, recentDeploys, slackThread }) {
  if (!alert) {
    return (
      <div className="crystal-card p-6 flex flex-col items-center justify-center h-full text-text-muted min-h-[300px]">
        <div className="text-[20px] font-bold tracking-[0.2em] mb-2 opacity-50">NO SIGNAL</div>
        <p className="text-[11px] uppercase tracking-widest text-text-muted/60">Awaiting telemetry breach...</p>
      </div>
    );
  }

  return (
    <div className={`crystal-card flex flex-col h-full animate-fade-in transition-all duration-500 ${
      alert.severity === 'P0' ? 'shadow-[0_0_30px_rgba(255,51,85,0.1)] border-accent-red/20' : 'border-white/[0.04]'
    }`}>
      {/* Alert Header */}
      <div className={`px-5 py-4 border-b border-white/[0.04] bg-gradient-to-r relative overflow-hidden ${
        alert.severity === 'P0' ? 'from-accent-red/25 to-transparent' : 'from-accent-amber/20 to-transparent'
      }`}>
        {alert.severity === 'P0' && (
           <div className="absolute inset-0 bg-accent-red/5 animate-pulse" />
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold px-2 py-0.5 border tracking-widest ${
              alert.severity === 'P0' ? 'bg-accent-red/10 border-accent-red/40 text-accent-red' : 'bg-accent-amber/10 border-accent-amber/40 text-accent-amber'
            }`}>
              {alert.severity}
            </span>
            <span className="text-[10px] text-text-secondary tracking-[0.2em] uppercase">{alert.source}</span>
          </div>
          <span className="text-[10px] text-text-muted tracking-widest">
            {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : '—'}
          </span>
        </div>
        <h3 className="text-[14px] font-bold text-text-primary tracking-tight">{alert.title}</h3>
      </div>

      <div className="p-5 space-y-6 flex-1 overflow-y-auto">
        {/* Alert Meta */}
        <div className="grid grid-cols-2 gap-4">
          <InfoBlock label="Service" value={alert.service} />
          <InfoBlock label="Error Rate" value={alert.error_rate} color="text-accent-red" />
        </div>

        {/* Pod Status */}
        {podStatus && (
          <div>
            <SectionLabel>Pod Status</SectionLabel>
            <div className="space-y-1 mt-2">
              {Object.entries(podStatus).map(([pod, status]) => (
                <div key={pod} className="flex items-center justify-between text-[11px] p-2 hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.02]">
                  <span className="text-text-secondary truncate max-w-[55%]">{pod}</span>
                  <span className={`font-bold tracking-widest uppercase ${
                    status.includes('Running') && !status.includes('high') ? 'text-accent-green' :
                    status.includes('OOMKilled') || status.includes('CrashLoop') ? 'text-accent-red' :
                    'text-accent-amber'
                  }`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Deploys */}
        {recentDeploys && recentDeploys.length > 0 && recentDeploys[0].sha !== 'no_recent_deploy' && (
          <div>
            <SectionLabel>Recent Deploys</SectionLabel>
            <div className="space-y-1 mt-2">
              {recentDeploys.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] p-2 hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-accent-violet font-bold">{d.sha?.slice(0, 7)}</span>
                    <span className="text-text-secondary">{d.service}</span>
                  </div>
                  <span className="text-text-muted tracking-widest uppercase">{d.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slack Thread */}
        {slackThread && slackThread.length > 0 && (
          <div>
            <SectionLabel>Slack Thread</SectionLabel>
            <div className="space-y-2 mt-2 max-h-[150px] overflow-y-auto pr-2">
              {slackThread.map((msg, i) => {
                const [user, ...rest] = msg.split(':');
                return (
                  <div key={i} className="text-[11px] bg-obsidian-light/50 border-l border-white/[0.04] pl-3 py-1.5 min-h-0">
                    <span className="font-bold text-accent-cyan mr-2">{user}:</span>
                    <span className="text-text-secondary leading-relaxed">{rest.join(':')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="section-label mb-3 border-b border-white/[0.04] pb-2">{children}</div>
  );
}

function InfoBlock({ label, value, color = 'text-text-primary' }) {
  return (
    <div className="bg-obsidian border border-white/[0.04] p-3 relative group overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/[0.04]" />
      <div className="text-[9px] text-text-muted uppercase tracking-[0.2em]">{label}</div>
      <div className={`text-sm font-bold mt-1 tracking-tight ${color}`}>{value || '—'}</div>
    </div>
  );
}
