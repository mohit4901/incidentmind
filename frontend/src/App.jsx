import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import Results from './pages/Results';

const NAV_ITEMS = [
  { to: '/', label: 'Live Demo', icon: '⚡' },
  { to: '/training', label: 'Training', icon: '🧠' },
  { to: '/results', label: 'Results', icon: '📊' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Top Navigation */}
        <header className="glass-strong sticky top-0 z-50 border-b border-gray-800/50">
          <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔥</span>
              <span className="text-lg font-bold tracking-tight gradient-text">IncidentMind</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 uppercase tracking-widest">
                v1.0
              </span>
            </div>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-gray-800 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 live-pulse" />
              OpenEnv 2026
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/training" element={<Training />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
