import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import useSocket from '../hooks/useSocket';

const Dashboard = () => {
    const { results, isRunning, runEpisode, error } = useSocket();
    const [history, setHistory] = useState([]);
    const [incidentClass, setIncidentClass] = useState('oom_kill_cascade');

    // Aggregate metrics for graphs
    useEffect(() => {
        if (results?.trained?.trajectory) {
            const newHistory = results.trained.trajectory.map(step => ({
                name: `Step ${step.step}`,
                reward: step.reward,
                cumulative: step.cumulative_reward
            }));
            setHistory(newHistory);
        }
    }, [results]);

    const stats = useMemo(() => {
        const trained = results?.trained || {};
        const untrained = results?.untrained || {};
        return {
            betaReward: trained.final_reward || 0,
            alphaReward: untrained.final_reward || 0,
            efficiency: trained.steps ? Math.round((1 - trained.steps/20) * 100) : 0,
            status: isRunning ? 'EVOLVING' : 'STABLE'
        };
    }, [results, isRunning]);

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans p-6 md:p-12">
            {/* Header */}
            <header className="max-w-7xl mx-auto mb-12 flex justify-between items-end border-b border-gray-200 pb-8">
                <div>
                    <div className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-2">Neural Ops Center v1.2</div>
                    <h1 className="text-4xl font-extrabold tracking-tight">IncidentMind Dashboard</h1>
                </div>
                <div className="flex gap-4">
                    <select 
                        value={incidentClass} 
                        onChange={(e) => setIncidentClass(e.target.value)}
                        className="bg-white border border-gray-200 px-4 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="oom_kill_cascade">OOM Kill Cascade</option>
                        <option value="db_connection_pool">DB Pool Leak</option>
                        <option value="bad_deploy_latency">Deployment Latency</option>
                    </select>
                    <button 
                        onClick={() => runEpisode(incidentClass)}
                        disabled={isRunning}
                        className={`px-8 py-2 rounded-md font-semibold text-sm transition-all ${
                            isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'
                        }`}
                    >
                        {isRunning ? 'EVALUATING...' : 'RUN NEURAL DUEL'}
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Stats Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white border border-gray-100 p-8 rounded-xl">
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-4">Core Performance (Beta)</div>
                        <div className="text-5xl font-black text-indigo-600 mb-2">{stats.betaReward.toFixed(2)}</div>
                        <div className="text-sm text-gray-500">Cumulative Neural Reward</div>
                    </div>

                    <div className="bg-white border border-gray-100 p-8 rounded-xl grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Efficiency</div>
                            <div className="text-2xl font-bold">{stats.efficiency}%</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Status</div>
                            <div className={`text-sm font-bold ${isRunning ? 'text-green-500 animate-pulse' : 'text-gray-400'}`}>
                                {stats.status}
                            </div>
                        </div>
                    </div>

                    <div className="bg-black text-white p-8 rounded-xl shadow-2xl">
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-4">Neural Comparison</div>
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-sm">Beta (Evolved)</span>
                            <span className="text-xl font-bold text-green-400">+{((stats.betaReward / (stats.alphaReward || 0.1)) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-green-400 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (stats.betaReward/10)*100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Graph Section */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white border border-gray-100 p-8 rounded-xl h-[400px]">
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-6">Reward Trajectory Convergence</div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorReward" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="reward" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorReward)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Trace Log Beta */}
                        <div className="bg-white border border-gray-100 p-8 rounded-xl h-[300px] overflow-hidden flex flex-col">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-4 font-mono">Trace Bridge: Subject Beta</div>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {results?.trained?.trajectory?.map((step, idx) => (
                                    <div key={idx} className="border-l-2 border-indigo-500 pl-4 py-1">
                                        <div className="text-[10px] font-bold text-indigo-400 uppercase">Step {step.step} • {step.action}</div>
                                        <div className="text-sm font-medium text-gray-700 leading-snug">{step.hypothesis}</div>
                                    </div>
                                ))}
                                {!results?.trained && <div className="text-sm text-gray-300 italic text-center mt-12">Waiting for neural rollout...</div>}
                            </div>
                        </div>

                        {/* Trace Log Alpha */}
                        <div className="bg-gray-50 border border-gray-100 p-8 rounded-xl h-[300px] overflow-hidden flex flex-col opacity-60">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-4 font-mono">Trace Bridge: Subject Alpha</div>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {results?.untrained?.trajectory?.map((step, idx) => (
                                    <div key={idx} className="border-l-2 border-gray-300 pl-4 py-1">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Step {step.step} • {step.action}</div>
                                        <div className="text-sm text-gray-400 italic">{step.finding}</div>
                                    </div>
                                ))}
                                {!results?.untrained && <div className="text-sm text-gray-300 italic text-center mt-12">Baseline idle.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
