
import React, { useEffect, useState } from 'react';
import { 
    ClipboardList, 
    CalendarDays, 
    Clock, 
    CheckCircle2, 
    Circle, 
    BarChart3, 
    Loader2, 
    ChevronRight, 
    TrendingUp, 
    AlertCircle,
    FileText,
    Sparkles,
    X,
    Printer,
    Download,
    Minimize2,
    Maximize2,
    Calendar,
    Filter,
    LayoutGrid,
    Table as TableIcon,
    ArrowRight
} from 'lucide-react';
import { supabase, DatabaseTask } from '../services/supabaseClient';
import { Task } from '../types';
import { generateExecutiveReport, summarizeReport } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

const NICHE_COLORS: Record<string, string> = {
    'Trabalho': 'bg-blue-500',
    'Pessoal': 'bg-pink-500',
    'Saúde': 'bg-emerald-500',
    'Finanças': 'bg-yellow-500',
    'Ideias': 'bg-purple-500',
    'Geral': 'bg-slate-500'
};

const PriorityBadge: React.FC<{ priority?: string }> = ({ priority }) => {
    switch(priority) {
        case 'high': 
            return <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 font-bold border border-red-500/20 uppercase tracking-wide">Alta</span>;
        case 'medium': 
            return <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/10 text-yellow-400 font-bold border border-yellow-500/20 uppercase tracking-wide">Média</span>;
        default: 
            return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-400 font-bold border border-slate-500/20 uppercase tracking-wide">Baixa</span>;
    }
};

const PriorityMap: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    // Helper to determine urgency (Days until due)
    const getUrgency = (dueDate?: string) => {
        if (!dueDate) return 3; // Low urgency
        const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        if (days < 0) return 0; // Overdue
        if (days <= 2) return 0; // High urgency
        if (days <= 7) return 1; // Med urgency
        return 2; // Low urgency
    };

    const getPriorityVal = (p?: string) => p === 'high' ? 0 : p === 'medium' ? 1 : 2;

    const matrix = [[[],[],[]], [[],[],[]], [[],[],[]]]; // 3x3 grid: [Priority][Urgency]

    tasks.forEach(t => {
        if(t.status === 'done') return;
        const p = getPriorityVal(t.priority);
        const u = getUrgency(t.dueDate);
        if(matrix[p] && matrix[p][u]) matrix[p][u].push(t);
    });

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 print:border-slate-300 print:bg-white h-full">
             <h3 className="font-bold text-white mb-4 flex items-center gap-2 print:text-black">
                <TrendingUp size={18} className="text-indigo-400 print:text-black"/> Mapa de Prioridade & Urgência
             </h3>
             <div className="grid grid-cols-3 gap-2 h-80">
                 {/* Labels */}
                 <div className="col-span-3 grid grid-cols-3 text-center text-[10px] uppercase font-bold text-slate-500 print:text-black mb-1">
                     <div>Urgente (0-2 dias)</div>
                     <div>Planejar (1 semana)</div>
                     <div>Delegar/Agendar</div>
                 </div>
                 
                 {/* Grid */}
                 {matrix.map((row, pIndex) => (
                     <React.Fragment key={pIndex}>
                         {row.map((cell, uIndex) => (
                             <div key={`${pIndex}-${uIndex}`} className={`rounded-xl border p-2 relative overflow-hidden transition-all hover:scale-[1.02] ${
                                 pIndex === 0 && uIndex === 0 ? 'bg-red-500/10 border-red-500/30' :
                                 pIndex === 0 ? 'bg-orange-500/10 border-orange-500/30' :
                                 uIndex === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                                 'bg-slate-800/30 border-slate-700 print:bg-slate-100 print:border-slate-300'
                             }`}>
                                 <div className="absolute top-1 right-1 text-[9px] font-black opacity-30 uppercase print:text-black">
                                     {pIndex === 0 ? 'Alta' : pIndex === 1 ? 'Média' : 'Baixa'} Prio
                                 </div>
                                 <div className="flex flex-wrap content-start gap-1 mt-3 max-h-full overflow-y-auto custom-scrollbar">
                                     {cell.map(t => (
                                         <div key={t.id} className={`w-2 h-2 rounded-full ${NICHE_COLORS[t.niche]}`} title={t.title} />
                                     ))}
                                     {cell.length > 0 && <span className="text-[10px] text-slate-400 ml-1 print:text-black">{cell.length}</span>}
                                 </div>
                             </div>
                         ))}
                     </React.Fragment>
                 ))}
             </div>
        </div>
    );
};

const Reports: React.FC = () => {
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // View Mode
    const [viewType, setViewType] = useState<'table' | 'grid'>('table');

    // Date Filters
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        return d.toISOString().split('T')[0];
    });

    // AI Report State
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [showAiModal, setShowAiModal] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [viewingSummary, setViewingSummary] = useState(false);

    useEffect(() => {
        fetchReportData();
    }, []);

    useEffect(() => {
        filterTasks();
    }, [allTasks, startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('tasks')
                .select('*')
                .order('due_date', { ascending: true });

            if (sbError) throw sbError;

            if (data) {
                const mapped: Task[] = data.map((t: DatabaseTask) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description || '',
                    niche: t.niche,
                    status: t.status,
                    dueDate: t.due_date || undefined,
                    priority: t.priority
                }));
                setAllTasks(mapped);
            }
        } catch (e: any) {
            console.error("Error fetching reports:", e);
            setError(e.message || "Erro ao carregar relatórios.");
        } finally {
            setLoading(false);
        }
    };

    const filterTasks = () => {
        const filtered = allTasks.filter(t => {
            if(!t.dueDate) return false;
            return t.dueDate >= startDate && t.dueDate <= endDate;
        });
        setFilteredTasks(filtered);
    };

    const handleQuickFilter = (type: 'today' | 'week' | 'month' | 'next-7' | 'next-30' | 'next-125') => {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        switch (type) {
            case 'today':
                break;
            case 'week':
                const day = now.getDay();
                start.setDate(now.getDate() - day);
                end.setDate(start.getDate() + 6);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'next-7':
                end.setDate(now.getDate() + 7);
                break;
            case 'next-30':
                end.setDate(now.getDate() + 30);
                break;
            case 'next-125':
                end.setDate(now.getDate() + 125);
                break;
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const handleGenerateAiReport = async () => {
        if (filteredTasks.length === 0) {
            alert("Não há tarefas no período selecionado.");
            return;
        }
        setIsGeneratingReport(true);
        try {
            const report = await generateExecutiveReport(filteredTasks);
            setAiReport(report);
            setAiSummary(null);
            setViewingSummary(false);
            setShowAiModal(true);
        } catch (e) {
            alert("Falha ao gerar o relatório AI.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleSummarizeReport = async () => {
        if (!aiReport || isSummarizing) return;
        if (aiSummary) {
            setViewingSummary(!viewingSummary);
            return;
        }

        setIsSummarizing(true);
        try {
            const summary = await summarizeReport(aiReport);
            setAiSummary(summary);
            setViewingSummary(true);
        } catch (e) {
            alert("Falha ao resumir o relatório.");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handlePrintPDF = () => {
        window.print();
    };

    // Render Components for Table and Grid
    const renderTable = () => (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-[10px] uppercase font-bold text-slate-500 border-b border-white/5 bg-slate-900/40">
                        <th className="p-4 rounded-tl-xl">Tarefa</th>
                        <th className="p-4">Nicho</th>
                        <th className="p-4">Prioridade</th>
                        <th className="p-4">Prazo</th>
                        <th className="p-4 rounded-tr-xl text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {filteredTasks.map((task) => (
                        <tr key={task.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${NICHE_COLORS[task.niche] || 'bg-slate-500'}`} />
                                    <span className={`font-medium ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                        {task.title}
                                    </span>
                                </div>
                            </td>
                            <td className="p-4">
                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700`}>
                                    {task.niche}
                                </span>
                            </td>
                            <td className="p-4">
                                <PriorityBadge priority={task.priority} />
                            </td>
                            <td className="p-4 text-slate-400 font-mono text-xs">
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="p-4 text-right">
                                {task.status === 'done' ? (
                                    <div className="inline-flex items-center gap-1 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full">
                                        <CheckCircle2 size={12} /> Feito
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1 text-slate-500 text-xs font-bold">
                                        <Circle size={12} /> Pendente
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {filteredTasks.map((task) => (
                <div key={task.id} className="flex flex-col gap-3 p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-all group relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${NICHE_COLORS[task.niche]}`} />
                    <div className="flex justify-between items-start pl-2">
                         <div className="flex-1 min-w-0 pr-2">
                             <div className="flex items-center gap-2 mb-1">
                                 <span className="text-[9px] uppercase font-bold text-slate-500">{task.niche}</span>
                                 <PriorityBadge priority={task.priority} />
                             </div>
                             <h4 className={`text-sm font-bold truncate ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
                                {task.title}
                            </h4>
                         </div>
                         <div className="shrink-0">
                            {task.status === 'done' ? (
                                <CheckCircle2 size={20} className="text-emerald-500" />
                            ) : (
                                <Circle size={20} className="text-slate-600 group-hover:text-indigo-400" />
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between pl-2 pt-2 border-t border-white/5">
                        <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                            <Clock size={12} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                        </span>
                        {task.status !== 'done' && (
                             <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                Detalhes <ArrowRight size={10} />
                             </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-indigo-400 gap-4">
                <Loader2 size={40} className="animate-spin" />
                <p className="text-sm font-medium animate-pulse">Compilando relatórios corporativos...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
            
            {/* Print Styles */}
            <style>{`
                @media print {
                    body { background: white; color: black; }
                    .print\\:hidden { display: none !important; }
                    .glass { background: white !important; border: 1px solid #ccc !important; }
                    h1, h2, h3, h4, p, span { color: black !important; }
                    .prose { color: black !important; }
                    ::-webkit-scrollbar { display: none; }
                    table { width: 100%; border: 1px solid #ccc; }
                    th, td { border-bottom: 1px solid #ddd; padding: 8px; color: black !important; }
                }
            `}</style>

            {/* AI Report Modal */}
            {showAiModal && aiReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in print:hidden">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-indigo-950/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500 rounded-lg">
                                    <Sparkles size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">
                                        {viewingSummary ? "Diretrizes Executivas Nexus" : "Relatório de Performance AI"}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                                        {viewingSummary ? "Resumo de Ação Imediata" : "Combate à Procrastinação & Organização"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleSummarizeReport}
                                    disabled={isSummarizing}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        viewingSummary 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : viewingSummary ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                    {viewingSummary ? "Ver Relatório Completo" : "Resumir Ações"}
                                </button>
                                <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors ml-2">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-900/50">
                            <div className="prose prose-invert prose-indigo max-w-none prose-p:leading-relaxed prose-headings:text-indigo-300">
                                <ReactMarkdown>{viewingSummary ? (aiSummary || "") : aiReport}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 shrink-0 print:hidden">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <BarChart3 className="text-indigo-400" /> Central de Relatórios
                        </h2>
                        <p className="text-slate-400 text-sm">Visão executiva das suas responsabilidades.</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleGenerateAiReport}
                            disabled={isGeneratingReport}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isGeneratingReport ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                            Análise AI
                        </button>
                        <button 
                            onClick={handlePrintPDF}
                            className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all"
                        >
                            <Download size={18} /> Exportar PDF
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Custom Range */}
                    <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 w-full md:w-auto">
                        <div className="flex items-center gap-2 px-2 border-r border-slate-700/50 pr-3">
                            <Calendar size={16} className="text-indigo-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Intervalo</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 md:flex-none">
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors flex-1"
                            />
                            <span className="text-slate-600 font-bold">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors flex-1"
                            />
                        </div>
                    </div>

                    <div className="h-6 w-px bg-slate-700 hidden md:block"></div>

                    {/* Presets */}
                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto custom-scrollbar">
                        <button onClick={() => handleQuickFilter('today')} className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-xs font-bold rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-slate-700/50">Hoje</button>
                        <button onClick={() => handleQuickFilter('week')} className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-xs font-bold rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-slate-700/50">Esta Semana</button>
                        <button onClick={() => handleQuickFilter('month')} className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-xs font-bold rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-slate-700/50">Este Mês</button>
                        <div className="w-px bg-slate-700 mx-1"></div>
                        <button onClick={() => handleQuickFilter('next-7')} className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-xs font-bold rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-slate-700/50">+7 Dias</button>
                        <button onClick={() => handleQuickFilter('next-30')} className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-xs font-bold rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-slate-700/50">+30 Dias</button>
                        <button onClick={() => handleQuickFilter('next-125')} className="px-3 py-1.5 bg-slate-800 hover:bg-pink-600 text-xs font-bold rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-pink-500/30">+125 Dias</button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar pb-10">
                {/* Visual Map */}
                <div className="col-span-1 lg:col-span-2">
                     <PriorityMap tasks={filteredTasks} />
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col overflow-hidden print:border-slate-300 print:bg-white col-span-1 lg:col-span-2 min-h-[400px]">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between print:bg-white print:border-slate-300">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-white flex items-center gap-2 print:text-black">
                                <ClipboardList className="text-indigo-400 print:text-black" size={18} /> Detalhamento de Tarefas
                            </h3>
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">{filteredTasks.length} itens</span>
                        </div>
                        
                        {/* View Toggles */}
                        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 print:hidden">
                            <button 
                                onClick={() => setViewType('table')} 
                                className={`p-1.5 rounded-md transition-all ${viewType === 'table' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                title="Visualização em Tabela"
                            >
                                <TableIcon size={14} />
                            </button>
                            <button 
                                onClick={() => setViewType('grid')} 
                                className={`p-1.5 rounded-md transition-all ${viewType === 'grid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                title="Visualização em Grade"
                            >
                                <LayoutGrid size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 bg-slate-900/20 overflow-y-auto custom-scrollbar">
                        {filteredTasks.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-10">
                                <CheckCircle2 size={32} className="mb-2 opacity-30" />
                                <p className="text-sm">Nenhuma tarefa encontrada neste período.</p>
                            </div>
                        ) : (
                            viewType === 'table' ? renderTable() : renderGrid()
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
