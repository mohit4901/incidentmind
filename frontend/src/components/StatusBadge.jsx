export function StatusBadge({ status, size = 'sm' }) {
  const config = {
    connected: { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Connected', ring: 'ring-emerald-500/20' },
    disconnected: { color: 'bg-red-500', text: 'text-red-400', label: 'Disconnected', ring: 'ring-red-500/20' },
    running: { color: 'bg-amber-500', text: 'text-amber-400', label: 'Running', ring: 'ring-amber-500/20', pulse: true },
    complete: { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Complete', ring: 'ring-emerald-500/20' },
    error: { color: 'bg-red-500', text: 'text-red-400', label: 'Error', ring: 'ring-red-500/20' },
    idle: { color: 'bg-gray-500', text: 'text-gray-400', label: 'Idle', ring: 'ring-gray-500/20' },
    training: { color: 'bg-violet-500', text: 'text-violet-400', label: 'Training', ring: 'ring-violet-500/20', pulse: true },
    resolved: { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Resolved', ring: 'ring-emerald-500/20' },
    sla_breached: { color: 'bg-red-500', text: 'text-red-400', label: 'SLA Breached', ring: 'ring-red-500/20' },
  };

  const c = config[status] || config.idle;
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ${c.ring} bg-gray-900/50`}>
      <span className={`${dotSize} rounded-full ${c.color} ${c.pulse ? 'live-pulse' : ''}`} />
      <span className={`${textSize} font-medium ${c.text}`}>{c.label}</span>
    </span>
  );
}
