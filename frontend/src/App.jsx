import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import Results from './pages/Results';

const NAV_ITEMS = [
  { to: '/', label: 'Live Demo' },
  { to: '/training', label: 'Training' },
  { to: '/results', label: 'Results' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#06060a] text-[#e8eaf0] flex flex-col font-mono text-[13px] relative z-10 selection:bg-accent-violet/30">
        
        <header className="sticky top-0 z-50 h-[52px] bg-[#06060a]/90 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-bold tracking-tight text-white uppercase flex items-center">
                <span className="w-2 h-2 bg-accent-violet mr-3" />
                IncidentMind
              </span>
              <span className="text-[9px] px-2 py-0.5 border border-accent-violet/40 bg-accent-violet/10 text-accent-violet tracking-widest font-black">
                V1.0
              </span>
            </div>

            <nav className="flex items-center gap-8 h-full">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `h-full flex items-center text-[10px] font-black tracking-[0.2em] transition-all relative uppercase ${
                      isActive ? 'text-white' : 'text-[#4a5068] hover:text-[#e8eaf0]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-violet shadow-[0_0_10px_#7c3aed]" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="text-[10px] font-bold tracking-widest text-[#4a5068] uppercase flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse" />
              OpenEnv 2026
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1600px] mx-auto p-8 relative overflow-x-hidden">
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
