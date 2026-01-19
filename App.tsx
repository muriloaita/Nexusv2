
import React, { useState, useEffect, Suspense } from 'react';
import { CheckSquare, Bot, Lightbulb, PieChart, Globe, BarChart3, LogOut, Loader2, Menu, X, CloudOff, Bell, LayoutDashboard } from 'lucide-react';
import { AppMode } from './types';
import { supabase, signOut, db, setGuestMode, checkConnection } from './services/supabaseClient';
import { NexusLogo } from './components/NexusLogo';

const LiveAssistant = React.lazy(() => import('./components/LiveAssistant'));
const SmartBoard = React.lazy(() => import('./components/SmartBoard'));
const Organizer = React.lazy(() => import('./components/Organizer'));
const IdeaLab = React.lazy(() => import('./components/IdeaLab'));
const FinanceDashboard = React.lazy(() => import('./components/FinanceDashboard'));
const KnowledgeBase = React.lazy(() => import('./components/KnowledgeBase'));
const Reports = React.lazy(() => import('./components/Reports'));
const LoginScreen = React.lazy(() => import('./components/LoginScreen'));
const NexusChatWidget = React.lazy(() => import('./components/NexusChatWidget'));

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.ORGANIZER);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
        const connected = await checkConnection();
        setIsOnline(connected);
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (!session || !connected) setGuestMode(true);
        setIsLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const nav = [
    { mode: AppMode.ORGANIZER, icon: LayoutDashboard, label: "Organizador" },
    { mode: AppMode.TASKS, icon: CheckSquare, label: "Smart Board" },
    { mode: AppMode.LIVE_ASSISTANT, icon: Bot, label: "Nexus Jarvis" },
    { mode: AppMode.IDEAS, icon: Lightbulb, label: "Idea Lab" },
    { mode: AppMode.FINANCE, icon: PieChart, label: "Finanças" },
    { mode: AppMode.KNOWLEDGE, icon: Globe, label: "Conhecimento" },
    { mode: AppMode.REPORTS, icon: BarChart3, label: "Relatórios" },
  ];

  if (isLoading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>;
  if (!session && localStorage.getItem('nexus_guest_mode') !== 'true') return <Suspense fallback={null}><LoginScreen onGuestLogin={() => { setGuestMode(true); window.location.reload(); }} /></Suspense>;

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden">
      <Suspense fallback={null}><NexusChatWidget /></Suspense>
      <aside className="hidden lg:flex flex-col w-72 h-full ios-glass border-r border-white/5">
        <div className="p-8">
            <div className="flex items-center gap-3 mb-10">
                 <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg"><NexusLogo className="w-7 h-7 text-white" /></div>
                 <div className="flex flex-col"><span className="font-black text-xl italic uppercase">NEXUS<span className="text-indigo-500">APP</span></span></div>
            </div>
            <nav className="space-y-1">
                {nav.map((item) => (
                    <button key={item.mode} onClick={() => setActiveMode(item.mode)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${activeMode === item.mode ? 'bg-white text-black' : 'text-slate-500 hover:text-slate-200'}`}>
                        <item.icon size={18} /><span className="text-sm font-bold">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
        <div className="mt-auto p-4 border-t border-white/5" onClick={() => signOut()}>
            <div className="flex items-center gap-3 p-4 rounded-3xl hover:bg-white/5 cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white ring-1 ring-white/10">N</div>
                <div className="flex-1"><p className="text-xs font-black text-white">Sair do Sistema</p></div>
                <LogOut size={16} className="text-slate-600" />
            </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="lg:hidden h-16 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md border-b border-white/5">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/5 rounded-full text-white"><Menu size={22} /></button>
             <h2 className="text-xs font-black text-white uppercase tracking-widest">{nav.find(i => i.mode === activeMode)?.label}</h2>
             <button className="w-9 h-9 rounded-full bg-white/5 text-slate-500 flex items-center justify-center"><Bell size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-10">
            {!isOnline && <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-500"><CloudOff size={18} /><p className="text-xs font-bold uppercase">Operando em Modo Local (Offline)</p></div>}
            <Suspense fallback={<Loader2 className="animate-spin text-indigo-500 mx-auto" />}>
                {activeMode === AppMode.ORGANIZER && <Organizer />}
                {activeMode === AppMode.TASKS && <SmartBoard />}
                {activeMode === AppMode.LIVE_ASSISTANT && <LiveAssistant />}
                {activeMode === AppMode.IDEAS && <IdeaLab />}
                {activeMode === AppMode.FINANCE && <FinanceDashboard />}
                {activeMode === AppMode.KNOWLEDGE && <KnowledgeBase />}
                {activeMode === AppMode.REPORTS && <Reports />}
            </Suspense>
        </div>
      </main>
      {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-72 h-full bg-slate-950 p-6 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center"><h2 className="font-black text-white italic uppercase">NEXUS</h2><button onClick={() => setIsSidebarOpen(false)}><X size={24} className="text-slate-500" /></button></div>
                  <nav className="space-y-1">{nav.map((item) => (<button key={item.mode} onClick={() => { setActiveMode(item.mode); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all ${activeMode === item.mode ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><item.icon size={20} /> <span className="text-sm font-bold">{item.label}</span></button>))}</nav>
              </div>
          </div>
      )}
    </div>
  );
};
export default App;
