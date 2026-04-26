import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { IncidentPanel } from '../components/IncidentPanel';
import { AgentActionLog } from '../components/AgentActionLog';
import { RewardChart } from '../components/RewardChart';
import { EpochProgress } from '../components/EpochProgress';
import { StatusBadge } from '../components/StatusBadge';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Dashboard() {
  const { connected, agentSteps, isRunning, episodeResult, error, pendingApproval, runEpisode, resetEpisode, approveAction, denyAction } = useSocket();
  const [agentType, setAgentType] = useState('trained');
  const [incidentClass, setIncidentClass] = useState('random');
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [recentEpisodes, setRecentEpisodes] = useState([]);

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

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col relative z-10">
      {/* Control Bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.04] bg-void">
        <div className="flex items-center gap-6">
          <StatusBadge status={connected ? 'connected' : 'disconnected'} />

          {/* Agent type selector */}
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
                {agentType === mode && (
                  <span className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
                )}
              </button>
            ))}
          </div>

          {/* Incident class selector */}
          <div className="relative">
            <select
              value={incidentClass}
              onChange={(e) => setIncidentClass(e.target.value)}
              className="appearance-none bg-obsidian border border-white/[0.04] px-4 py-1.5 text-[10px] font-bold tracking-[0.2em] text-text-secondary uppercase focus:outline-none focus:border-accent-violet transition-colors pr-10"
            >
              {INCIDENT_CLASSES.map((cls) => (
                <option key={cls} value={cls} className="bg-obsidian">
                  {cls === 'random' ? '🎲 Random Signal' : cls.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-[8px]">▼</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleRunEpisode}
            disabled={isRunning || !connected}
            className="px-6 py-2 border border-accent-cyan/30 text-accent-cyan text-[10px] font-bold tracking-[0.2em] uppercase hover:border-accent-cyan/70 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)] disabled:opacity-30 transition-all flex items-center gap-2"
          >
            {isRunning ? '⟳ Signal Active...' : '▶ Run Episode'}
          </button>
          <button
            onClick={() => handleStartTraining(50)}
            disabled={trainingStatus?.running}
            className="px-6 py-2 border border-accent-violet/40 bg-gradient-to-br from-accent-violet/15 to-accent-violet/5 text-[#a78bfa] text-[10px] font-bold tracking-[0.2em] uppercase hover:border-accent-violet/80 hover:shadow-[0_0_16px_rgba(124,58,237,0.2)] disabled:opacity-30 transition-all flex items-center gap-2"
          >
            {trainingStatus?.running
              ? `Evolution ${trainingStatus.current_epoch}/${trainingStatus.total_epochs}`
              : '◈ Evolution Sync (50)'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-accent-red/10 border border-accent-red/30 text-[11px] text-accent-red tracking-widest uppercase flex items-center gap-3">
          <span className="text-sm">⚠</span> TELEMETRY INTERRUPTED: {error}
        </div>
      )}

      {/* HITL Modal */}
      {pendingApproval && (
        <div className="mx-6 mt-4 p-6 bg-accent-red/10 border border-accent-red/40 relative group overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,51,85,0.1),transparent)] animate-pulse" />
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-6">
              <div className="text-4xl animate-bounce">🚨</div>
              <div>
                <div className="section-label text-accent-red mb-1">Human Operator Authorization Required</div>
                <div className="text-text-primary text-[14px] font-bold tracking-tight">
                  Agent requested intervention via <span className="text-accent-red underline decoration-accent-red/30 underline-offset-4">{pendingApproval.tool}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
               <button onClick={denyAction} className="px-6 py-3 border border-accent-red/40 text-accent-red text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-accent-red/10 transition-all">Deny Request</button>
               <button onClick={approveAction} className="px-6 py-3 bg-accent-red text-void text-[10px] font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,51,85,0.4)] hover:bg-[#ff4d6d] transition-all">Authorize Fix</button>
            </div>
          </div>
        </div>
      )}

      {/* Episode Result */}
      {episodeResult && (
        <div className={`mx-6 mt-4 p-4 border animate-fade-in flex items-center justify-between ${
          episodeResult.resolved
            ? 'border-accent-green/30 bg-accent-green/[0.06]'
            : 'border-accent-red/30 bg-accent-red/[0.06]'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`text-xl ${episodeResult.resolved ? 'text-accent-green' : 'text-accent-red'}`}>
              {episodeResult.resolved ? '◈ RESOLVED' : '◈ BREACHED'}
            </div>
            <div className="w-[1px] h-4 bg-white/10" />
            <div className="text-[11px] text-text-secondary tracking-widest uppercase">
              Final Telemetry: <span className={episodeResult.finalReward >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                {episodeResult.finalReward >= 0 ? '+' : ''}{episodeResult.finalReward?.toFixed(2)} reward
              </span>
              <span className="mx-3 opacity-30">|</span>
              Steps: {episodeResult.stepsTaken}
              <span className="mx-3 opacity-30">|</span>
              Terminated: {episodeResult.doneReason?.replace(/_/g, ' ')}
            </div>
          </div>
          <button onClick={resetEpisode} className="text-[10px] text-text-muted hover:text-text-primary tracking-widest uppercase underline underline-offset-4">Acknowledge</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Action Log (Layer 1) */}
        <div className="col-span-7 border-r border-white/5 overflow-y-auto p-6 bg-void">
          <AgentActionLog steps={agentSteps} isRunning={isRunning} />
        </div>

        {/* Intelligence Side (Layer 2) */}
        <div className="col-span-5 overflow-y-auto p-6 space-y-6 bg-obsidian/30">
          {/* Incident Context */}
          <div className="h-[320px]">
             <IncidentPanel 
                alert={agentSteps.length > 0 ? (agentSteps[0].observation_summary?.current_alert || null) : null}
                podStatus={agentSteps.length > 0 ? (agentSteps[agentSteps.length-1].observation_summary?.k8s_pods || null) : null}
                recentDeploys={agentSteps.length > 0 ? (agentSteps[agentSteps.length-1].observation_summary?.github_deploys || null) : null}
                slackThread={agentSteps.length > 0 ? (agentSteps[agentSteps.length-1].observation_summary?.slack_messages || null) : null}
             />
          </div>

          {/* Evolution Stats */}
          {(trainingStatus?.running || trainingStatus?.status === 'complete') && (
            <div className="h-[240px]">
              <EpochProgress
                current={trainingStatus.current_epoch}
                total={trainingStatus.total_epochs}
                status={trainingStatus.status}
                rewardHistory={rewardHistory}
              />
            </div>
          )}

          {/* Learning Curve */}
          {rewardHistory.length > 0 && (
            <div className="crystal-card p-5">
              <RewardChart data={rewardHistory} height={160} />
            </div>
          )}

          {/* Recent History (Filtered) */}
          <div className="crystal-card p-5 space-y-4">
             <div className="section-label">Filtered Signal History</div>
             <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {recentEpisodes
                  .filter(ep => ep.agent_type === agentType)
                  .map((ep, i) => (
                    <div key={ep._id} className="p-3 border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors relative group">
                        <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all ${ep.resolved ? 'bg-accent-green' : 'bg-accent-red'}`} />
                        <div className="flex justify-between items-start mb-1">
                           <span className="text-[10px] font-bold text-text-primary truncate max-w-[150px]">{ep.alert_title}</span>
                           <span className={`text-[9px] font-bold ${ep.resolved ? 'text-accent-green' : 'text-accent-red'}`}>
                              {ep.resolved ? 'RESOLVED' : 'FAILED'}
                           </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-text-muted font-mono tracking-widest uppercase">
                           <span>{new Date(ep.created_at).toLocaleTimeString()}</span>
                           <span>Reward: {ep.final_reward?.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
                {recentEpisodes.filter(ep => ep.agent_type === agentType).length === 0 && (
                   <div className="py-8 text-center text-[10px] text-text-muted uppercase tracking-widest opacity-40">
                      No matching cycles recorded
                   </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
