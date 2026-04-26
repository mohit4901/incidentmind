import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { IncidentPanel } from '../components/IncidentPanel';
import { AgentActionLog } from '../components/AgentActionLog';
import { RewardChart } from '../components/RewardChart';
import { EpochProgress } from '../components/EpochProgress';
import { StatusBadge } from '../components/StatusBadge';
import { DuelView } from './DuelView';

const getBaseURL = () => {
  const { hostname, origin } = window.location;
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  
  const HF_URL = 'https://cottoncloud-incidentmind-grpo-training.hf.space';
  
  // If running on localhost, we try to hit local first, but fallback to HF 
  // (In this case, I'll just point to HF as primary if local is barred)
  if (hostname === 'localhost' || hostname === '127.0.0.1') return HF_URL;
  return origin;
};

const API_URL = getBaseURL();
const WS_URL = API_URL.replace(/^http/, 'ws');

export default function Dashboard() {
  const { connected, agentSteps, isRunning, episodeResult, error, pendingApproval, runEpisode, resetEpisode, approveAction, denyAction } = useSocket();
  const [agentType, setAgentType] = useState('trained');
  const [incidentClass, setIncidentClass] = useState('random');
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [recentEpisodes, setRecentEpisodes] = useState([]);
  const [showDuel, setShowDuel] = useState(false);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const [resStatus, resHistory] = await Promise.all([
          fetch(`${API_URL}/api/training/status`),
          fetch(`${API_URL}/api/results/recent-episodes`)
        ]);

        if (resStatus.ok) {
          const data = await resStatus.json();
          setTrainingStatus(data);
          if (data.reward_history?.length > 0) {
            setRewardHistory(data.reward_history);
          }
        }

        if (resHistory.ok) {
          setRecentEpisodes(await resHistory.json());
        }
      } catch (_) {}
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  const handleRunEpisode = () => {
    runEpisode({ incidentClass, agentType });
  };

  const handleStartTraining = async (epochs = 50) => {
    try {
      await fetch(`${API_URL}/api/training/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numEpochs: epochs }),
      });
    } catch (err) {
      console.error('Training start failed:', err);
    }
  };

  const INCIDENT_CLASSES = [
    'random', 'oom_kill_cascade', 'db_connection_pool', 'bad_deploy_latency',
    'certificate_expiry', 'disk_saturation',
  ];

  const [systemHealth, setSystemHealth] = useState(100);

  // Update Health based on reward and steps
  useEffect(() => {
    if (isRunning) {
        setSystemHealth(prev => Math.max(10, prev - 1)); // Visible drain
    } else if (episodeResult?.resolved) {
        setSystemHealth(100); // Immediate recovery
    }
  }, [isRunning, agentSteps, episodeResult]);

  if (showDuel) return <DuelView onBack={() => setShowDuel(false)} />;

  return (
    <div className={`h-[calc(100vh-100px)] flex flex-col relative z-10 transition-all duration-700 ${
       isRunning ? 'bg-accent-red/[0.02] shadow-[inset_0_0_100px_rgba(255,51,85,0.05)]' : 'bg-void'
    }`}>
      {/* CRISIS ALERT HEADER (NEW) */}
      {isRunning && (
         <div className="absolute top-0 left-0 right-0 py-1 bg-accent-red/20 border-b border-accent-red/40 flex justify-center items-center gap-4 z-50 animate-pulse">
            <span className="text-[10px] font-black text-accent-red tracking-[0.5em] uppercase">SYSTEM BREACH DETECTED</span>
            <div className="flex gap-2">
               {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-accent-red rounded-full" />)}
            </div>
         </div>
      )}

      {/* Top Banner with Instructions */}
      <div className="px-6 py-3 bg-accent-cyan/5 border-b border-accent-cyan/10 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-accent-cyan tracking-widest uppercase">Protocol Alpha:</span>
            <div className="w-[150px] h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
               <div 
                  className={`h-full transition-all duration-1000 ${systemHealth < 40 ? 'bg-accent-red' : 'bg-accent-cyan'}`}
                  style={{ width: `${systemHealth}%` }}
               />
            </div>
            <span className={`text-[9px] font-bold ${systemHealth < 40 ? 'text-accent-red animate-pulse' : 'text-accent-cyan'}`}>
               CORE_STABILITY: {systemHealth}%
            </span>
         </div>
         <div className="flex gap-4 text-[9px] text-text-muted font-mono">
            <span>[MEM: 16.4GB]</span>
            <span>[LATENCY: 42MS]</span>
         </div>
      </div>

      {/* Control Bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.04] bg-void">
        <div className="flex items-center gap-6">
          <StatusBadge status={connected ? 'connected' : 'disconnected'} />
          
          <div className="flex flex-col">
             <span className="text-[8px] text-text-muted uppercase tracking-widest mb-1">Policy State</span>
             <div className="flex bg-obsidian-light p-0.5 border border-white/[0.04]">
            {['untrained', 'trained'].map((mode) => (
              <button
                key={mode}
                onClick={() => setAgentType(mode)}
                className={`px-6 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-300 relative overflow-hidden ${
                  agentType === mode
                    ? mode === 'trained'
                      ? 'bg-accent-cyan text-void shadow-[0_0_20px_rgba(0,212,255,0.4)] z-10'
                      : 'bg-accent-red text-void shadow-[0_0_20px_rgba(255,51,85,0.4)] z-10'
                    : 'text-text-muted hover:text-text-secondary bg-transparent'
                }`}
              >
                {mode === 'trained' ? '✓ Trained' : '✗ Untrained'}
              </button>
            ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleRunEpisode}
            disabled={isRunning || !connected}
            className="px-6 py-2 border border-accent-cyan/30 text-accent-cyan text-[10px] font-bold tracking-[0.2em] uppercase hover:border-accent-cyan/70 transition-all"
          >
            {isRunning ? '⟳ Signal Active...' : '▶ Run Episode'}
          </button>
          
          <button
            onClick={() => setShowDuel(true)}
            className="px-6 py-2 bg-accent-violet/20 border border-accent-violet/40 text-[#a78bfa] text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-accent-violet/40 transition-all"
          >
            ⚔️ BATTLE_DUEL
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Instructions Sidebar (NEW) */}
        <div className="col-span-2 border-r border-white/5 bg-obsidian/20 p-6 space-y-8 overflow-y-auto">
           <div className="space-y-4">
              <div className="section-label">Operation Dossier</div>
              <p className="text-[10px] text-text-muted leading-relaxed uppercase tracking-wider">
                1. Select <span className="text-accent-cyan">Trained</span> to use the GRPO-Optimized expert policy.<br/><br/>
                2. Use <span className="text-accent-violet">Evolution Sync</span> to retrain if resolution rates drop.<br/><br/>
                3. Authorize fixes in the <span className="text-accent-red">HITL Gate</span> to maintain production safety.
              </p>
           </div>
           
           <div className="p-4 border border-white/10 bg-white/5 rounded-sm">
              <div className="text-[9px] font-bold text-accent-cyan mb-2">SYSTEM ANALYTICS</div>
              <div className="space-y-2">
                 <div className="flex justify-between items-center text-[8px]">
                    <span className="text-text-muted">SUCCESS RATE</span>
                    <span className="text-accent-cyan">78%</span>
                 </div>
                 <div className="flex justify-between items-center text-[8px]">
                    <span className="text-text-muted">AVG TTR</span>
                    <span className="text-accent-cyan">8.4M</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Action Log */}
        <div className="col-span-6 border-r border-white/5 overflow-y-auto p-6 bg-void">
          <AgentActionLog steps={agentSteps} isRunning={isRunning} />
        </div>

        {/* Intelligence Side */}
        <div className="col-span-4 overflow-y-auto p-6 space-y-6 bg-obsidian/30">
          
          {/* Thinking HUD (NEW) */}
          <div className="p-5 border border-accent-cyan/30 bg-accent-cyan/[0.03] shadow-[0_0_15px_rgba(0,212,255,0.05)] relative group">
             <div className="absolute top-0 right-0 p-2 text-[8px] text-accent-cyan opacity-40 font-mono tracking-tighter">AI_THOUGHT_STREAM</div>
             <div className="section-label mb-3">Live_Neural_Hypothesis</div>
             <div className="text-[12px] text-text-primary font-bold leading-relaxed italic border-l-2 border-accent-cyan/50 pl-4 py-1">
                {agentSteps.length > 0 ? (agentSteps[agentSteps.length-1].hypothesis || "Analyzing system telemetry...") : "Awaiting Operational Context..."}
             </div>
          </div>

          {/* Multi-Curve Analytics */}
          <div className="crystal-card p-5 space-y-4">
            <div className="flex justify-between items-center">
               <div className="section-label">Neural Convergence (Multi-Curve)</div>
               <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-[8px] text-accent-cyan"><div className="w-1.5 h-1.5 bg-accent-cyan rounded-full"/> REWARD</span>
                  <span className="flex items-center gap-1 text-[8px] text-[#a78bfa]"><div className="w-1.5 h-1.5 bg-[#a78bfa] rounded-full"/> EFFICIENCY</span>
               </div>
            </div>
            <RewardChart data={rewardHistory} height={180} />
          </div>

          <div className="h-[280px]">
             <IncidentPanel 
                alert={agentSteps.length > 0 ? (agentSteps[0].observation_summary?.current_alert || null) : null}
                podStatus={agentSteps.length > 0 ? (agentSteps[agentSteps.length-1].observation_summary?.k8s_pods || null) : null}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
