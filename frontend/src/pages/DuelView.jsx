import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { StatusBadge } from '../components/StatusBadge';
import { AgentActionLog } from '../components/AgentActionLog';

const getBaseURL = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (window.location.hostname.endsWith('.hf.space')) return window.location.origin;
  return 'http://localhost:7860';
};

const API_URL = getBaseURL();

export function DuelView({ onBack }) {
    const [isRunning, setIsRunning] = useState(false);
    const [duelData, setDuelData] = useState(null);
    const [incidentClass, setIncidentClass] = useState('random');
    
    // Auto-Duel Logic
    const startDuel = async () => {
        setIsRunning(true);
        setDuelData(null);
        try {
            const res = await fetch(`${API_URL}/api/run-duel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incident_class: incidentClass, max_steps: 25 })
            });
            if (res.ok) {
                setDuelData(await res.json());
            }
        } catch (err) {
            console.error("Duel failed:", err);
        } finally {
            setIsRunning(false);
        }
    };

    const seniorityGap = duelData ? (duelData.trained.final_reward - duelData.untrained.final_reward) : 0;
    const dollarsSaved = duelData ? ((duelData.trained.resolved ? 1 : 0) - (duelData.untrained.resolved ? 1 : 0)) * 500000 : 0;

    return (
        <div className="h-full flex flex-col bg-void relative overflow-hidden transition-all duration-1000">
            {/* DUEL BACKGROUND EFFECTS */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,102,255,0.05),transparent)] pointer-events-none" />
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10 z-0 shadow-[0_0_20px_rgba(255,255,255,0.1)]" />

            {/* Header Control */}
            <div className="px-8 py-6 border-b border-white/5 bg-obsidian-light/30 backdrop-blur-md flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="text-[10px] text-accent-cyan hover:underline tracking-widest uppercase">← RETURN TO CORE</button>
                    <h1 className="text-[18px] font-black tracking-tighter text-text-primary uppercase italic">Neural_Duel: Trained vs Untrained</h1>
                </div>

                <div className="flex items-center gap-6">
                    <select
                        value={incidentClass}
                        onChange={(e) => setIncidentClass(e.target.value)}
                        className="bg-void border border-white/10 px-4 py-2 text-[10px] font-bold text-accent-cyan uppercase outline-none"
                    >
                        {['random', 'bad_deploy_latency', 'db_connection_pool', 'oom_kill_cascade'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button 
                        onClick={startDuel}
                        disabled={isRunning}
                        className="px-8 py-2 bg-accent-cyan text-void font-bold text-[11px] uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_30px_rgba(0,212,255,0.3)]"
                    >
                        {isRunning ? '⚔️ DUELING...' : '⚔️ INITIATE DUEL'}
                    </button>
                </div>
            </div>

            {/* Duel Grid */}
            <div className="flex-1 grid grid-cols-2 gap-0 relative z-10">
                {/* UNTRAINED SIDE */}
                <div className="border-r border-white/5 p-8 space-y-6 bg-accent-red/[0.01]">
                    <div className="flex justify-between items-center bg-accent-red/10 p-4 border-l-4 border-accent-red">
                        <div>
                            <div className="text-[10px] font-bold text-accent-red uppercase tracking-widest mb-1">Subject Alpha (Untrained)</div>
                            <div className="text-[14px] font-black text-text-primary uppercase">Default Llama Model</div>
                        </div>
                        {duelData && (
                            <div className="text-right">
                                <div className={`text-lg font-black ${duelData.untrained.resolved ? 'text-accent-green' : 'text-accent-red'}`}>
                                    {duelData.untrained.resolved ? 'RESOLVED' : 'FAILED'}
                                </div>
                                <div className="text-[10px] text-text-muted">REWARD: {duelData.untrained.final_reward}</div>
                            </div>
                        )}
                    </div>
                    <div className="h-[calc(100vh-350px)]">
                        <AgentActionLog steps={duelData ? duelData.untrained.trajectory : []} isRunning={false} />
                    </div>
                </div>

                {/* TRAINED SIDE */}
                <div className="p-8 space-y-6 bg-accent-cyan/[0.01]">
                    <div className="flex justify-between items-center bg-accent-cyan/10 p-4 border-l-4 border-accent-cyan">
                        <div>
                            <div className="text-[10px] font-bold text-accent-cyan uppercase tracking-widest mb-1">Subject Beta (Evolved)</div>
                            <div className="text-[14px] font-black text-text-primary uppercase">IncidentMind GRPO-Opt</div>
                        </div>
                        {duelData && (
                            <div className="text-right">
                                <div className={`text-lg font-black ${duelData.trained.resolved ? 'text-accent-green' : 'text-accent-red'}`}>
                                    {duelData.trained.resolved ? 'RESOLVED' : 'FAILED'}
                                </div>
                                <div className="text-[10px] text-text-muted">REWARD: {duelData.trained.final_reward}</div>
                            </div>
                        )}
                    </div>
                    <div className="h-[calc(100vh-350px)]">
                        <AgentActionLog steps={duelData ? duelData.trained.trajectory : []} isRunning={false} />
                    </div>
                </div>

                {/* CENTRAL STATS HUD */}
                {duelData && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] bg-void border border-white/10 p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 text-center animate-fade-in">
                        <div className="text-[10px] text-text-muted uppercase tracking-[0.3em] mb-4">Seniority_Gap</div>
                        <div className="text-3xl font-black text-accent-cyan mb-2">+{seniorityGap.toFixed(1)}</div>
                        <div className="w-full h-1 bg-white/5 mb-6">
                            <div className="h-full bg-accent-cyan" style={{ width: '100%' }} />
                        </div>
                        <div className="text-[9px] text-accent-green font-bold tracking-widest uppercase">
                            SIMULATED PROFIT SAVED:
                        </div>
                        <div className="text-xl font-bold text-text-primary mt-1">
                            ${Math.abs(dollarsSaved).toLocaleString()}
                        </div>
                    </div>
                )}
            </div>

            {/* PROCESSING OVERLAY */}
            {isRunning && (
                <div className="absolute inset-x-0 bottom-0 py-8 bg-void/90 backdrop-blur-sm border-t border-accent-cyan/30 flex flex-col items-center justify-center z-[100] animate-slide-up">
                    <div className="text-[12px] font-black text-accent-cyan tracking-[1.5em] uppercase mb-4 animate-pulse">Running Neural Simulation</div>
                    <div className="w-[300px] h-1 bg-white/10 overflow-hidden">
                        <div className="h-full bg-accent-cyan animate-progress-indefinite" />
                    </div>
                </div>
            )}
        </div>
    );
}
