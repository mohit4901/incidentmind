export function StatusBadge({ status, size = 'sm' }) {
  const config = {
    connected: { border: 'border-accent-green/30', bg: 'bg-accent-green/[0.06]', text: 'text-accent-green', label: 'Connected' },
    disconnected: { border: 'border-accent-red/30', bg: 'bg-accent-red/[0.06]', text: 'text-accent-red', label: 'Disconnected' },
    running: { border: 'border-accent-amber/30', bg: 'bg-accent-amber/[0.06]', text: 'text-accent-amber', label: 'Running' },
    complete: { border: 'border-accent-cyan/30', bg: 'bg-accent-cyan/[0.06]', text: 'text-accent-cyan', label: 'Complete' },
    error: { border: 'border-accent-red/30', bg: 'bg-accent-red/[0.06]', text: 'text-accent-red', label: 'Error' },
    idle: { border: 'border-white/10', bg: 'bg-white/5', text: 'text-text-secondary', label: 'Idle' },
    training: { border: 'border-accent-violet/30', bg: 'bg-accent-violet/[0.06]', text: 'text-accent-violet', label: 'Training' },
    resolved: { border: 'border-accent-green/30', bg: 'bg-accent-green/[0.06]', text: 'text-accent-green', label: 'Resolved' },
    sla_breached: { border: 'border-accent-red/30', bg: 'bg-accent-red/[0.06]', text: 'text-accent-red', label: 'SLA Breached' },
    trained: { border: 'border-accent-cyan/30', bg: 'bg-accent-cyan/[0.06]', text: 'text-accent-cyan', label: 'Trained' },
    untrained: { border: 'border-accent-red/30', bg: 'bg-accent-red/[0.06]', text: 'text-accent-red', label: 'Untrained' },
  };

  const c = config[status] || config.idle;

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 border ${c.border} ${c.bg}`}>
      <span className={`text-[9px] font-bold tracking-[0.2em] uppercase ${c.text}`}>
        {c.label}
      </span>
    </span>
  );
}
