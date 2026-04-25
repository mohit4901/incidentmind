import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

export function RewardChart({ data, height = 200, showArea = false }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-600 text-xs">
        No reward data yet
      </div>
    );
  }

  const chartData = data.map((reward, i) => ({
    epoch: i + 1,
    reward: reward,
    rolling: i >= 4
      ? data.slice(Math.max(0, i - 4), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, 5)
      : data.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-strong rounded-lg px-3 py-2 shadow-xl text-xs">
        <div className="text-gray-400 mb-1">Epoch {label}</div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}:</span>
            <span className={`font-mono font-bold ${p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {p.value >= 0 ? '+' : ''}{p.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (showArea) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="rewardGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="epoch" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="reward" stroke="#10b981" strokeWidth={1.5} fill="url(#rewardGradient)" name="Reward" />
          <Line type="monotone" dataKey="rolling" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Rolling Avg" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="epoch" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="reward" stroke="#10b981" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#10b981' }} name="Reward" />
        <Line type="monotone" dataKey="rolling" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="Rolling Avg" />
      </LineChart>
    </ResponsiveContainer>
  );
}
