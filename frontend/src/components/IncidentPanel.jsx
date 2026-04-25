export function IncidentPanel({ alert, podStatus, recentDeploys, slackThread }) {
  if (!alert) {
    return (
      <div className="glass rounded-xl p-6 flex flex-col items-center justify-center h-full text-gray-500">
        <span className="text-5xl mb-4">🔥</span>
        <p className="text-sm font-medium">No active incident</p>
        <p className="text-xs mt-1 text-gray-600">Run an episode to see incident details</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden animate-fade-in">
      {/* Alert Header */}
      <div className={`px-5 py-3 border-b border-gray-800/50 ${
        alert.severity === 'P0' ? 'bg-red-950/40' : 'bg-amber-950/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              alert.severity === 'P0' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              {alert.severity}
            </span>
            <span className="text-xs text-gray-400">{alert.source}</span>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : '—'}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-white mt-2 leading-snug">{alert.title}</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Alert Meta */}
        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Service" value={alert.service} />
          <InfoBlock label="Error Rate" value={alert.error_rate} color="text-red-400" />
        </div>

        {/* Pod Status */}
        {podStatus && (
          <div>
            <SectionLabel>Pod Status</SectionLabel>
            <div className="space-y-1.5">
              {Object.entries(podStatus).map(([pod, status]) => (
                <div key={pod} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-400 truncate max-w-[55%]">{pod}</span>
                  <span className={`font-medium ${
                    status.includes('Running') && !status.includes('high') ? 'text-emerald-400' :
                    status.includes('OOMKilled') || status.includes('CrashLoop') ? 'text-red-400' :
                    'text-amber-400'
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
            <div className="space-y-1.5">
              {recentDeploys.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-violet-400">{d.sha?.slice(0, 7)}</span>
                    <span className="text-gray-400">{d.service}</span>
                  </div>
                  <span className="text-gray-500">{d.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slack Thread */}
        {slackThread && slackThread.length > 0 && (
          <div>
            <SectionLabel>Slack Thread</SectionLabel>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {slackThread.map((msg, i) => {
                const [user, ...rest] = msg.split(':');
                return (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-blue-400">{user}:</span>
                    <span className="text-gray-400">{rest.join(':')}</span>
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
    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{children}</div>
  );
}

function InfoBlock({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-gray-900/50 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${color}`}>{value || '—'}</div>
    </div>
  );
}
