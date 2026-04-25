import { useState, useEffect } from 'react';
import { BeforeAfterComparison } from '../components/BeforeAfterComparison';
import { RewardChart } from '../components/RewardChart';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function Results() {
  const [data, setData] = useState(null);
  const [recentEpisodes, setRecentEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

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
    return <div className="p-8 text-gray-500">Loading results...</div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Results</h1>
        <p className="text-gray-400 mt-2">
          Aggregated performance data from all episodes and training runs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          <BeforeAfterComparison 
            trained={data?.comparison?.trained} 
            untrained={data?.comparison?.untrained} 
          />
          
          <div className="glass-strong rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <span className="text-8xl">🏆</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 relative z-10">Hackathon Pitch Summary</h3>
            <div className="space-y-3 mt-4 text-sm text-gray-300 relative z-10">
              <p>
                <strong className="text-emerald-400">The Problem:</strong> Senior SREs spend 40% of their time on repetitive incident diagnosis. Production downtime costs $300K/hour.
              </p>
              <p>
                <strong className="text-emerald-400">The Solution:</strong> An RL-trained autonomous agent that reasons through the diagnosis loop under a strict 30-minute SLA.
              </p>
              <p>
                <strong className="text-emerald-400">The Result:</strong> The agent learned to resolve 
                <span className="font-bold text-white"> {data?.comparison?.trained?.resolvedCount || 0} </span> 
                out of <span className="font-bold text-white">{data?.comparison?.trained?.total || 0}</span> incidents it faced, 
                achieving an average reward of <span className="font-bold text-white">+{data?.comparison?.trained?.avgReward?.toFixed(2) || '0.00'}</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {data?.training ? (
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Latest Training Curve</h3>
              <RewardChart data={data.training.reward_curve} height={250} showArea />
              
              <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-800/50">
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase">Initial Reward</div>
                  <div className="text-lg font-bold font-mono text-gray-300 mt-1">
                    {data.training.initial_avg_reward?.toFixed(2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase">Final Reward</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                    +{data.training.final_avg_reward?.toFixed(2)}
                  </div>
                </div>
                <div className="text-center border-l border-gray-800/50">
                  <div className="text-xs text-violet-400 uppercase font-semibold">Improvement</div>
                  <div className="text-lg font-bold font-mono text-violet-400 mt-1">
                    +{data.training.improvement?.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass rounded-xl p-6 text-center text-gray-500">
              No training data available. Go to the Training tab to start a run.
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Episodes</h2>
        <div className="bg-[#0f172a] rounded-xl border border-gray-800/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1e293b]/50 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Incident</th>
                <th className="px-6 py-4 font-medium">Agent</th>
                <th className="px-6 py-4 font-medium">Result</th>
                <th className="px-6 py-4 font-medium text-right">Steps</th>
                <th className="px-6 py-4 font-medium text-right">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {recentEpisodes.map((ep) => (
                <tr key={ep._id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-300">{ep.alert_title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{new Date(ep.created_at).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      ep.agent_type === 'trained' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                    }`}>
                      {ep.agent_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {ep.resolved ? (
                      <span className="text-emerald-400 font-medium">✅ Resolved</span>
                    ) : (
                      <span className="text-red-400 font-medium whitespace-nowrap">❌ {ep.done_reason.replace(/_/g, ' ')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-gray-400">
                    {ep.steps_taken}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono font-bold ${ep.final_reward >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {ep.final_reward >= 0 ? '+' : ''}{ep.final_reward?.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {recentEpisodes.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No episodes run yet. Go to Live Demo to run an episode.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
