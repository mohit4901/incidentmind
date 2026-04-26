import { useState, useEffect } from 'react';
import { BeforeAfterComparison } from '../components/BeforeAfterComparison';
import { RewardChart } from '../components/RewardChart';

const getBaseURL = () => {
  const { hostname, origin } = window.location;
  const HF_URL = 'https://CottonCloud-incidentmind-grpo-training.hf.space';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return HF_URL;
  return origin;
};
const API_URL = getBaseURL();

export default function Results() {
  const [data, setData] = useState(null);
  const [recentEpisodes, setRecentEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const [resData, resEpisodes] = await Promise.all([
        fetch(`${API_URL}/api/results`),
        fetch(`${API_URL}/api/results/recent-episodes`),
      ]);
      if (resData.ok) setData(await resData.json());
      if (resEpisodes.ok) setRecentEpisodes(await resEpisodes.json());
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#06060a]">
         <div className="text-[12px] font-black text-accent-cyan tracking-[0.5em] uppercase animate-pulse">Synchronizing_Neural_Archives...</div>
      </div>
    );
  }

  const trainedAvg = data?.comparison?.trained?.avgReward || 0;
  const untrainedAvg = data?.comparison?.untrained?.avgReward || 0;
  const diff = trainedAvg - untrainedAvg;

  return (
    <div className="max-w-[1600px] mx-auto pb-48 animate-fade-in relative z-10 font-mono">
      
      {/* 0. SCANLINE & GRID BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
         <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.05)_1px,transparent_1px)] bg-[size:60px_60px]" />
         <div className="absolute top-0 left-0 w-full h-[1px] bg-accent-cyan animate-scanline" />
      </div>

      {/* 1. AGGRESSIVE HERO */}
      <div className="px-8 pt-24 pb-20 relative">
         <div className="flex items-start justify-between relative z-10">
            <div>
               <div className="text-accent-cyan text-[11px] font-black tracking-[0.8em] uppercase mb-8 flex items-center gap-4">
                  <span className="w-12 h-[1px] bg-accent-cyan" />
                  Performance_Shift_Audit
               </div>
               <h1 className="text-8xl font-black tracking-tighter text-white leading-none mb-8 glitch-text">
                  RESULT<span className="text-accent-cyan">.</span>ARK
               </h1>
            </div>
            <div className="flex bg-void p-1 border border-white/10 shrink-0">
               {['all', 'untrained', 'trained'].map((type) => (
                 <button
                   key={type}
                   onClick={() => setFilterType(type)}
                   className={`px-8 py-3 text-[11px] font-black tracking-[0.4em] uppercase transition-all ${
                     filterType === type ? 'bg-accent-cyan text-[#06060a]' : 'text-text-muted hover:text-white'
                   }`}
                 >
                   {type}
                 </button>
               ))}
            </div>
         </div>
      </div>

      {/* 2. THE DUEL */}
      <div className="px-8 mb-20">
        <div className="transform -skew-y-1 bg-white/[0.02] border border-white/5 p-1">
           <div className="h-[550px] transform skew-y-1">
              <BeforeAfterComparison trained={data?.comparison?.trained} untrained={data?.comparison?.untrained} />
           </div>
        </div>
      </div>

      {/* 3. DOSSIER & MAP */}
      <div className="grid grid-cols-12 gap-12 px-8">
         <div className="col-span-12 lg:col-span-7 bg-white/[0.01] border border-white/5 p-12 relative overflow-hidden group">
            <div className="glare-effect" />
            <div className="text-accent-violet text-[10px] font-black tracking-[0.5em] uppercase mb-12">System_Intelligence_Dossier</div>
            <div className="space-y-12">
               {[
                 { title: 'INCIDENT_VOLUME', desc: 'Downtime costs $300K/hr. Human logic is the primary bottleneck.', col: 'text-accent-red' },
                 { title: 'NEURAL_ORCHESTRATION', desc: 'RL-agent authorized for autonomous recovery and state-retention.', col: 'text-accent-cyan' },
                 { title: 'VALIDATED_RECOVERY', desc: `Autonomous verification closed ${data?.comparison?.trained?.resolvedCount || 0} production traces.`, col: 'text-accent-green' }
               ].map((item, i) => (
                 <div key={i} className="flex gap-8 group/item hover:translate-x-2 transition-transform">
                    <span className="text-[11px] font-black opacity-20 uppercase mt-1 tracking-widest">{i + 1}</span>
                    <div>
                       <div className={`text-sm font-black mb-2 ${item.col}`}>{item.title}</div>
                       <p className="text-text-secondary text-sm leading-relaxed opacity-70 group-hover/item:opacity-100">{item.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>
         <div className="col-span-12 lg:col-span-5 bg-[#0f0f1a] border-l-8 border-accent-cyan p-10 h-full flex flex-col justify-between">
            <div className="section-label mb-10 text-accent-cyan">Neural Convergence v.12</div>
            {data?.training ? (
              <div className="flex-1 flex flex-col justify-between">
                 <div className="h-[280px]"><RewardChart data={data.training.reward_curve} height={280} /></div>
                 <div className="grid grid-cols-2 gap-px mt-12 bg-white/5 p-px">
                    <div className="bg-[#06060a] p-6 text-2xl font-black">{data.training.initial_avg_reward?.toFixed(2)}</div>
                    <div className="bg-[#06060a] p-6 text-2xl font-black text-accent-green">+{data.training.final_avg_reward?.toFixed(2)}</div>
                 </div>
              </div>
            ) : <div className="h-48 flex items-center justify-center text-[9px] opacity-20 uppercase tracking-widest">Awaiting_Signal...</div>}
         </div>
      </div>

      {/* 4. TELEMETRY STREAM */}
      <div className="px-8 mt-40">
        <div className="section-label mb-16">Forensic Telemetry Stream</div>
        <div className="space-y-2">
          {recentEpisodes.filter(ep => filterType === 'all' || ep.agent_type === filterType).map((ep, idx) => (
            <div key={ep._id} className="h-14 bg-[#0f0f1a] group hover:bg-white/[0.03] transition-all flex items-center px-10 gap-16 border-l-4 border-white/5 hover:border-accent-cyan">
              <div className="w-8 opacity-20 font-black">{idx + 1}</div>
              <div className="flex-1 text-sm font-black text-white/80 group-hover:text-white uppercase truncate">{ep.alert_title}</div>
              <div className="w-40 border-l border-white/5 pl-10 text-right">
                <div className={`text-xl font-black ${ep.final_reward >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {ep.final_reward >= 0 ? '+' : ''}{ep.final_reward?.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
