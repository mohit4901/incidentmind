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

  // Extract incident info from first step's observation
  const currentAlert = agentSteps.length > 0 ? null : null; // Will be populated from episode

  // Poll training status
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/training/status`);
        if (res.ok) {
          const data = await res.json();
          setTrainingStatus(data);
          if (data.reward_history?.length > 0) {
            setRewardHistory(data.reward_history);
          }
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
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Control Bar */}
      <div className="border-b border-gray-800/50 px-6 py-3 flex items-center justify-between glass-strong">
        <div className="flex items-center gap-3">
          <StatusBadge status={connected ? 'connected' : 'disconnected'} />

          {/* Agent type selector */}
          <div className="flex bg-gray-900 rounded-lg p-0.5 gap-0.5">
            {['untrained', 'trained'].map((mode) => (
              <button
                key={mode}
                onClick={() => setAgentType(mode)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  agentType === mode
                    ? mode === 'trained'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-red-700 text-white shadow-lg shadow-red-900/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {mode === 'trained' ? '✓ Trained' : '✗ Untrained'}
              </button>
            ))}
          </div>

          {/* Incident class selector */}
          <select
            value={incidentClass}
            onChange={(e) => setIncidentClass(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {INCIDENT_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls === 'random' ? '🎲 Random Incident' : cls.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunEpisode}
            disabled={isRunning || !connected}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-800/30"
          >
            {isRunning ? '⟳ Agent Running...' : '▶ Run Episode'}
          </button>
          <button
            onClick={() => handleStartTraining(50)}
            disabled={trainingStatus?.running}
            className="px-5 py-2 bg-violet-700 hover:bg-violet-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all shadow-lg shadow-violet-900/20"
          >
            {trainingStatus?.running
              ? `Training ${trainingStatus.current_epoch}/${trainingStatus.total_epochs}`
              : '🧠 Train 50 Epochs'}
          </button>
        </div>
      </div>

      {/* Training progress */}
      {trainingStatus?.running && (
        <div className="h-1 bg-gray-900">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700"
            style={{ width: `${trainingStatus.progress_percent || 0}%` }}
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2.5 bg-red-950/60 border border-red-800/40 rounded-lg text-xs text-red-400 flex items-center gap-2">
          <span>⚠</span> {error}
        </div>
      )}

      {/* Human In The Loop Approval Modal/Banner */}
      {pendingApproval && (
        <div className="mx-6 mt-3 px-6 py-4 bg-red-950/40 border border-red-500/50 rounded-xl flex items-center justify-between animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]" style={{ animationDuration: '3s' }}>
          <div className="flex items-center gap-4">
            <span className="text-3xl inline-block -mt-1 shadow-red-500">🚨</span>
            <div>
              <div className="text-red-400 font-bold uppercase tracking-widest text-xs mb-1">Human Operator Authorization Required</div>
              <div className="text-white text-sm font-mono tracking-tight">
                Agent requested execution via <span className="text-red-300 font-semibold">{pendingApproval.tool}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={denyAction} className="px-5 py-2.5 border border-red-500 text-red-400 rounded-md hover:bg-red-500/20 transition-all text-xs font-bold uppercase tracking-wider">Deny</button>
             <button onClick={approveAction} className="px-5 py-2.5 bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] rounded-md hover:bg-red-500 transition-all text-xs font-bold uppercase tracking-wider">Authorize Fix</button>
          </div>
        </div>
      )}

      {/* Episode result banner */}
      {episodeResult && (
        <div className={`mx-6 mt-3 px-5 py-3 rounded-lg flex items-center gap-4 animate-fade-in ${
          episodeResult.resolved
            ? 'bg-emerald-950/40 border border-emerald-700/40 glow-green'
            : 'bg-red-950/40 border border-red-800/40 glow-red'
        }`}>
          <span className="text-2xl">{episodeResult.resolved ? '✅' : '❌'}</span>
          <div>
            <div className="font-semibold text-sm">
              {episodeResult.resolved ? 'Incident Resolved' : 'Resolution Failed'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Reward: <span className={`font-mono font-bold ${episodeResult.finalReward >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {episodeResult.finalReward >= 0 ? '+' : ''}{episodeResult.finalReward?.toFixed(2)}
              </span>
              {' · '}Steps: {episodeResult.stepsTaken}
              {' · '}{episodeResult.doneReason?.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-5 gap-0 overflow-hidden">
        {/* Left panel — Agent Action Log */}
        <div className="col-span-3 border-r border-gray-800/30 overflow-y-auto p-6">
          <AgentActionLog steps={agentSteps} isRunning={isRunning} />
        </div>

        {/* Right panel — Info + Rewards */}
        <div className="col-span-2 overflow-y-auto p-6 space-y-5">
          {/* Training progress widget */}
          {(trainingStatus?.running || trainingStatus?.status === 'complete') && (
            <EpochProgress
              current={trainingStatus.current_epoch}
              total={trainingStatus.total_epochs}
              status={trainingStatus.status}
              rewardHistory={rewardHistory}
            />
          )}

          {/* Reward curve */}
          {rewardHistory.length > 0 && (
            <div className="glass rounded-xl p-5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Learning Curve — {rewardHistory.length} epochs
              </div>
              <RewardChart data={rewardHistory} height={180} showArea />
            </div>
          )}

          {/* Training logs */}
          {trainingStatus?.latest_logs?.length > 0 && (
            <div className="glass rounded-xl p-5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Training Log
              </div>
              <div className="font-mono text-[11px] space-y-0.5 max-h-60 overflow-y-auto">
                {trainingStatus.latest_logs.map((log, i) => {
                  const rewardMatch = log.match(/reward=(-?[\d.]+)/);
                  const reward = rewardMatch ? parseFloat(rewardMatch[1]) : 0;
                  return (
                    <div
                      key={i}
                      className={`py-1 px-2 rounded ${
                        reward > 2
                          ? 'bg-emerald-950/40 text-emerald-400'
                          : reward < 0
                          ? 'bg-red-950/30 text-red-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
