import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function RewardChart({ data, height = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-white/[0.04] bg-obsidian">
        <div className="text-[10px] text-text-muted tracking-[0.3em] uppercase">No telemetry data</div>
      </div>
    );
  }

  const chartData = data.map((reward, i) => ({
    epoch: i + 1,
    reward: reward,
    isPeak: reward === Math.max(...data) && i > 0
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-void border border-accent-cyan/20 p-4 shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-accent-cyan shadow-[0_0_10px_#00d4ff]" />
        <div className="text-[9px] text-[#4a5068] tracking-[0.4em] uppercase font-bold mb-3">Epoch {label}</div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 bg-accent-cyan" />
            <span className={`text-sm font-black ${p.value >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              SIGNAL: {p.value >= 0 ? '+' : ''}{p.value.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full relative group">
      <div className="absolute -top-6 left-0 z-10 text-[9px] font-black tracking-[0.5em] text-accent-cyan opacity-40 uppercase">NEURAL_SYNAPSE_SIGNAL stream</div>
      <div className="pt-2">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorReward" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
            <XAxis 
              dataKey="epoch" 
              hide={true}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#4a5068', fontFamily: 'JetBrains Mono' }} 
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,212,255,0.2)', strokeWidth: 2 }} />
            <Area 
              type="monotone" 
              dataKey="reward" 
              stroke="#00d4ff" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorReward)"
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
