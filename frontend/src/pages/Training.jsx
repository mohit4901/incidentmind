import { useState, useEffect } from 'react';
import { EpochProgress } from '../components/EpochProgress';
import { RewardChart } from '../components/RewardChart';

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

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Training</h1>
          <p className="text-gray-400 mt-2">
            Train the Reinforcement Learning agent via GRPO. 
            The system saves the best performing weights automatically.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => startTraining(10)}
            disabled={status?.running}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all border border-gray-700"
          >
            Quick Run (10)
          </button>
          <button
            onClick={() => startTraining(50)}
            disabled={status?.running}
            className="px-6 py-2.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-violet-900/40 border border-violet-600"
          >
            {status?.running ? 'Training Active...' : 'Start Full Training (50)'}
          </button>
        </div>
      </div>

      {status?.running && (
        <div className="grid grid-cols-2 gap-6">
          <EpochProgress
            current={status.current_epoch}
            total={status.total_epochs}
            status={status.status}
            rewardHistory={status.reward_history}
          />
          <div className="glass rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Live Reward Curve</h3>
            <RewardChart data={status.reward_history} height={160} showArea />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Training History</h2>
        <div className="bg-[#0f172a] rounded-xl border border-gray-800/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1e293b]/50 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Epochs</th>
                <th className="px-6 py-4 font-medium">Initial Avg</th>
                <th className="px-6 py-4 font-medium">Final Avg</th>
                <th className="px-6 py-4 font-medium text-right">Improvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {history.map((run) => (
                <tr key={run._id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4 text-gray-300">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      run.status === 'complete' ? 'bg-emerald-900/40 text-emerald-400' :
                      run.status === 'error' ? 'bg-red-900/40 text-red-400' :
                      'bg-amber-900/40 text-amber-400'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-400">
                    {run.current_epoch} / {run.total_epochs}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-400">
                    {run.initial_avg_reward?.toFixed(2) || '—'}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-gray-200">
                    {run.final_avg_reward?.toFixed(2) || '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {run.improvement != null ? (
                      <span className={`font-mono font-bold ${run.improvement > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {run.improvement > 0 ? '+' : ''}{run.improvement.toFixed(2)}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No training runs found. Click "Start Full Training" to begin.
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
