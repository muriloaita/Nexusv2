
import React, { useState, useEffect } from 'react';
import { 
    MapPin, 
    Search, 
    Globe, 
    Loader2, 
    BrainCircuit, 
    Sparkles, 
    Microscope, 
    Briefcase,
    History,
    Trash2,
    Clock,
    X,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';
import { searchMaps, searchWeb } from '../services/geminiService';
import { SearchPurpose } from '../types';
import ReactMarkdown from 'react-markdown';

interface HistoryItem {
    id: string;
    query: string;
    mode: 'web' | 'maps';
    purpose: SearchPurpose;
    isDeep: boolean;
    result: { text: string, grounding: any[] };
    timestamp: number;
}

const KnowledgeBase: React.FC = () => {
  const [mode, setMode] = useState<'web' | 'maps'>('web');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{text: string, grounding: any[]} | null>(null);
  
  // Search Configuration
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [purpose, setPurpose] = useState<SearchPurpose>('curiosity');

  // History State
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('nexus_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar histórico", e);
      }
    }
  }, []);

  // Save history when it changes
  useEffect(() => {
    localStorage.setItem('nexus_search_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  const handleSearch = async () => {
    if(!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
        let res;
        if (mode === 'web') {
            // Fixed: Expected 2 arguments, but got 3. Removed 'purpose'.
            res = await searchWeb(query, isDeepResearch);
        } else {
            const pos: GeolocationPosition = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            // Fixed: Expected 3 arguments, but got 4. Removed 'purpose'.
            res = await searchMaps(query, pos.coords.latitude, pos.coords.longitude);
        }
        
        setResult(res);

        // Add to history
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            query: query,
            mode: mode,
            purpose: purpose,
            isDeep: isDeepResearch,
            result: res,
            timestamp: Date.now()
        };
        setSearchHistory(prev => [newItem, ...prev].slice(0, 50));
    } catch (e) {
        console.error(e);
        alert("Erro na busca. Verifique permissões ou tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
      setQuery(item.query);
      setMode(item.mode);
      setPurpose(item.purpose);
      setIsDeepResearch(item.isDeep);
      setResult(item.result);
      if (window.innerWidth < 1024) setShowHistory(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSearchHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
      if(confirm("Deseja limpar todo o histórico de pesquisas?")) {
          setSearchHistory([]);
      }
  };

  const PurposeButton = ({ p, icon: Icon, label, color }: { p: SearchPurpose, icon: any, label: string, color: string }) => (
      <button
        onClick={() => setPurpose(p)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            purpose === p 
            ? `${color} text-white border-transparent shadow-md scale-105` 
            : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:border-slate-500'
        }`}
      >
          <Icon size={14} /> {label}
      </button>
  );

  return (
    <div className="h-full flex flex-row overflow-hidden relative">
        
        {/* Left Sidebar: History (Collapsible Drawer) */}
        <div 
            className={`absolute lg:relative z-40 h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out shadow-2xl shrink-0 ${
                showHistory ? 'w-80 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 pointer-events-none'
            }`}
        >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 min-w-[320px]">
                <h3 className="font-bold text-slate-300 flex items-center gap-2 text-sm">
                    <History size={16} className="text-indigo-400" /> Histórico
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={clearHistory} className="text-slate-500 hover:text-red-400 p-1" title="Limpar tudo">
                        <Trash2 size={14} />
                    </button>
                    <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white p-1">
                        <PanelLeftClose size={18} />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar min-w-[320px]">
                {searchHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                        <Clock size={32} className="mb-2 opacity-20" />
                        <p className="text-xs">Nenhuma pesquisa recente.</p>
                    </div>
                ) : (
                    searchHistory.map(item => (
                        <button
                            key={item.id}
                            onClick={() => loadFromHistory(item)}
                            className={`w-full text-left p-3 rounded-xl border transition-all group relative ${
                                result?.text === item.result.text 
                                ? 'bg-indigo-600/10 border-indigo-500/30' 
                                : 'bg-slate-800/40 border-transparent hover:bg-slate-800 hover:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {item.mode === 'web' ? <Globe size={12} className="text-indigo-400" /> : <MapPin size={12} className="text-emerald-400" />}
                                <span className="text-[10px] text-slate-500 font-bold uppercase truncate flex-1">{item.purpose}</span>
                            </div>
                            <p className="text-xs text-slate-200 font-medium truncate pr-4">{item.query}</p>
                            <button 
                                onClick={(e) => deleteHistoryItem(item.id, e)}
                                className="absolute right-2 bottom-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </button>
                    ))
                )}
            </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col space-y-4 min-w-0 transition-all duration-300 p-1">
            <div className="flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    {!showHistory && (
                        <button 
                            onClick={() => setShowHistory(true)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 hover:bg-slate-700 hover:text-white transition-all shadow-lg flex items-center gap-2 text-xs font-bold px-4"
                        >
                            <PanelLeftOpen size={18} />
                            Histórico
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            Base de Conhecimento
                            {isDeepResearch && mode === 'web' && (
                                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Deep</span>
                            )}
                        </h2>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 shrink-0">
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setMode('web')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'web' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><Globe size={16} /> Web</button>
                        <button onClick={() => setMode('maps')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'maps' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><MapPin size={16} /> Maps</button>
                    </div>
                    {mode === 'web' && (
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <span className={`text-xs font-bold uppercase transition-colors ${isDeepResearch ? 'text-indigo-400' : 'text-slate-500'}`}>Deep Research</span>
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={isDeepResearch} onChange={(e) => setIsDeepResearch(e.target.checked)} />
                                <div className={`w-10 h-5 rounded-full transition-colors ${isDeepResearch ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isDeepResearch ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </label>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <PurposeButton p="curiosity" icon={Sparkles} label="Curiosidade" color="bg-pink-600" />
                    <PurposeButton p="scientific" icon={Microscope} label="Científico" color="bg-teal-600" />
                    <PurposeButton p="professional" icon={Briefcase} label="Profissional" color="bg-blue-600" />
                </div>
            </div>

            {/* Search Input */}
            <div className="flex gap-2 shrink-0">
                <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={mode === 'web' ? "O que deseja descobrir hoje?" : "Onde deseja ir?"}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button 
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                    {loading ? "Buscando..." : "Pesquisar"}
                </button>
            </div>

            {/* Results */}
            <div className="flex-1 bg-slate-800/50 rounded-2xl p-6 border border-slate-700 overflow-y-auto custom-scrollbar shadow-inner">
                {!result && !loading && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                        <Globe size={48} className="mb-4 text-indigo-400" />
                        <p className="text-sm">Inicie sua busca intelectual no Nexus Knowledge Base.</p>
                    </div>
                )}
                {loading && (
                    <div className="h-full flex flex-col items-center justify-center text-indigo-400 gap-4">
                        <Loader2 size={48} className="animate-spin" />
                        <p className="text-sm font-mono animate-pulse">Processando dados e consultando fontes...</p>
                    </div>
                )}
                {result && (
                    <div className="space-y-6 animate-fade-in pb-10">
                        <div className="prose prose-invert max-w-none">
                            <ReactMarkdown>{result.text}</ReactMarkdown>
                        </div>
                        {result.grounding.length > 0 && (
                            <div className="border-t border-slate-700 pt-6">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Fontes e Referências</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {result.grounding.map((chunk, i) => {
                                        const source = chunk.web || chunk.maps;
                                        if (!source) return null;
                                        return (
                                            <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl hover:bg-slate-700 transition-colors border border-slate-800">
                                                <div className="p-2 bg-slate-800 rounded text-slate-400">{chunk.web ? <Globe size={16}/> : <MapPin size={16}/>}</div>
                                                <div className="overflow-hidden">
                                                    <div className="text-sm font-medium truncate text-blue-300">{source.title || 'Ver Detalhes'}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{source.uri}</div>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default KnowledgeBase;
