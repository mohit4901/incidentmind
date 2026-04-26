import { useState, useEffect } from 'react';
import { EpochProgress } from '../components/EpochProgress';
import { RewardChart } from '../components/RewardChart';
import { StatusBadge } from '../components/StatusBadge';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Training() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
    const poll = setInterval(fetchStatus, 2000);
    return () => clearInterval(poll);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/training/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.status === 'complete' || data.status === 'error') {
          fetchHistory();
        }
      }
    } catch (_) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/training/history`);
      if (res.ok) setHistory(await res.json());
    } catch (_) {}
  };

  const startTraining = async (epochs) => {
    try {
      await fetch(`${API_URL}/api/training/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numEpochs: epochs }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Training start failed:', err);
    }
  };

  const totalRuns = history.length;
  const totalEpochs = history.reduce((acc, curr) => acc + (curr.total_epochs || 0), 0);
  const bestFinalAvg = history.length > 0 ? Math.max(...history.map(r => r.final_avg_reward || -9.99)) : 0;
  const peakImprovement = history.length > 0 ? Math.max(...history.map(r => r.improvement || 0)) : 0;

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in relative z-10 pb-32 font-mono">
      
      {/* 1. CYBER-SURGICAL HERO */}
      <div className="px-8 pt-20 pb-16 grid grid-cols-12 items-center gap-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-violet/5 blur-[120px] rounded-full -z-10 animate-pulse" />
        
        <div className="col-span-8">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-8 h-[1px] bg-accent-violet" />
             <div className="text-[10px] font-bold tracking-[0.6em] text-accent-violet uppercase">NEURAL_EVOLUTION_PROTOCOL</div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-text-primary mb-6 leading-[0.9]">
            Synapse Training<span className="text-accent-violet">_</span>
          </h1>
          <p className="text-text-muted text-base max-w-lg leading-relaxed mb-10 opacity-80">
            Automating diagnostic reasoning via GRPO. 
            Calibrating decision-weights into the obsidian vault with surgical precision.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => startTraining(10)}
              disabled={status?.running}
              className="px-10 py-4 bg-accent-violet text-[#06060a] text-[11px] font-black tracking-[0.4em] uppercase hover:bg-[#8b5cf6] transition-all disabled:opacity-30 shadow-[0_0_30px_rgba(124,58,237,0.3)]"
            >
              Initiate Pulse
            </button>
            <button
              onClick={() => startTraining(50)}
              disabled={status?.running}
              className="px-10 py-4 border border-white/10 text-white text-[11px] font-black tracking-[0.4em] uppercase hover:border-white/40 transition-all disabled:opacity-30 bg-white/5"
            >
              Sequential Evolution
            </button>
          </div>
        </div>
        
        <div className="col-span-4 flex justify-center scale-110">
           <div className="w-56 h-56 rounded-full border border-accent-violet/10 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border border-accent-violet/20 animate-ping opacity-40" />
              <div className="absolute inset-4 rounded-full border border-white/5 animate-reverse-spin" />
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-accent-violet/20 to-[#06060a] flex flex-col items-center justify-center border border-accent-violet/30">
                 <div className="text-[9px] text-accent-violet font-bold tracking-widest">SIGNAL</div>
                 <div className="text-sm font-black text-white">{status?.running ? 'SYNCING' : 'READY'}</div>
              </div>
           </div>
        </div>
      </div>

      {/* 2. STAT MONOLITH BANDS */}
      <div className="px-8 mb-24 grid grid-cols-4 gap-4">
        {[
          { label: 'SESSIONS', value: totalRuns, color: 'bg-accent-violet' },
          { label: 'EVOLUTIONS', value: totalEpochs, color: 'bg-accent-cyan' },
          { label: 'PEAK_AVG', value: bestFinalAvg > -9 ? bestFinalAvg.toFixed(2) : '0.00', color: 'bg-accent-green' },
          { label: 'DELTA_MAX', value: (peakImprovement >= 0 ? '+' : '')+peakImprovement.toFixed(2), color: 'bg-accent-violet' }
        ].map((stat, i) => (
          <div key={i} className="obsidian-pane p-10 group relative overflow-hidden transition-all hover:bg-white/[0.02]">
             <div className={`absolute top-0 left-0 w-1 h-full ${stat.color}`} />
             <div className="text-[10px] tracking-[0.5em] text-text-muted uppercase mb-4 font-bold">{stat.label}</div>
             <div className="text-4xl font-black tracking-tighter text-text-primary">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* 3. EVOLUTION SEQUENCE */}
      <div className="px-8 space-y-12">
        <div className="section-label">System State History</div>
        <div className="space-y-3">
          {history.length > 0 ? (
            history.map((run, idx) => {
              const improvement = run.improvement || 0;
              const accentColor = improvement >= 0 ? 'bg-accent-cyan' : 'bg-accent-red';
              return (
                <div key={run._id} className="obsidian-pane py-6 px-10 group transition-all border-l-2 border-transparent hover:border-accent-violet hover:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-10">
                     <div className={`w-2 h-2 ${accentColor}/40 group-hover:${accentColor} transition-all flex-shrink-0`} />
                     <div className="w-56 text-xs font-black uppercase tracking-tighter">
                        {new Date(run.started_at).toLocaleDateString('en-GB')} — {new Date(run.started_at).toLocaleTimeString('en-GB')}
                     </div>
                     <div className="w-40 border-l border-white/5 pl-10">
                        <div className="text-[8px] text-[#4a5068] mb-1 uppercase tracking-[0.2em] font-bold">EPOCHS</div>
                        <div className="text-xs font-mono font-bold">{run.total_epochs} cycles</div>
                     </div>
                     <div className="w-40 border-l border-white/5 pl-10 text-xs font-mono font-black text-white">
                        {run.final_avg_reward?.toFixed(2) || '0.00'}
                     </div>
                  </div>
                  <div className="flex items-center gap-12">
                     <div className={`text-sm font-black ${improvement > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {improvement > 0 ? '+' : ''}{improvement.toFixed(2)}
                     </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-24 text-center border border-white/5 bg-white/[0.01]">
               <div className="text-[10px] text-accent-violet uppercase tracking-[0.6em] font-bold opacity-60">Awaiting_Protocol_Initialization...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
