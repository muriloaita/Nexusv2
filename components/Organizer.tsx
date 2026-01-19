
import React, { useState, useRef, useEffect } from 'react';
// Added Loader2 to imports
import { Bold, Italic, Underline, Plus, Search, Tag, Calendar, ListChecks, CheckCircle2, Circle, Clock, Trash2, Bot, Sparkles, Loader2 } from 'lucide-react';
import { db } from '../services/supabaseClient';
import { Task } from '../types';

const NICHE_CONFIG: Record<string, { color: string, icon: any }> = {
    'Trabalho': { color: 'bg-blue-500', icon: Tag },
    'Pessoal': { color: 'bg-pink-500', icon: Tag },
    'Clientes': { color: 'bg-indigo-500', icon: Tag },
    'Finanças': { color: 'bg-emerald-500', icon: Tag },
    'Saúde': { color: 'bg-red-500', icon: Tag },
    'Geral': { color: 'bg-slate-500', icon: Tag }
};

const Organizer: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filterNiche, setFilterNiche] = useState<string>('Todos');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    
    const [title, setTitle] = useState('');
    const [selectedNiche, setSelectedNiche] = useState('Geral');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        const data = await db.tasks.fetch();
        setTasks(data);
        setLoading(false);
    };

    const handleFormat = (command: string) => {
        document.execCommand(command, false, undefined);
        editorRef.current?.focus();
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        
        const description = editorRef.current?.innerHTML || '';
        const newTask = {
            title,
            description,
            niche: selectedNiche,
            due_date: dueDate,
            status: 'todo',
            priority: 'medium',
            created_at: new Date().toISOString()
        };

        await db.tasks.insert(newTask);
        setTitle('');
        if (editorRef.current) editorRef.current.innerHTML = '';
        fetchTasks();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir este item?")) {
            await db.tasks.delete(id);
            fetchTasks();
        }
    };

    const filteredTasks = tasks.filter(t => {
        const matchesNiche = filterNiche === 'Todos' || t.niche === filterNiche;
        const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
        return matchesNiche && matchesSearch;
    });

    return (
        <div className="h-full flex flex-col gap-6 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">ORGANIZADOR <span className="text-indigo-500">CRM</span></h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Seu Assistente Pessoal de Nichos</p>
                </div>
                
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                    <button onClick={() => setFilterNiche('Todos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterNiche === 'Todos' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Todos</button>
                    {Object.keys(NICHE_CONFIG).map(n => (
                        <button key={n} onClick={() => setFilterNiche(n)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterNiche === n ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{n}</button>
                    ))}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
                {/* Editor Section */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="ios-glass rounded-[32px] p-6 flex flex-col gap-4 border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={14} /> Novo Registro
                             </h3>
                             <div className="flex gap-1">
                                <button onClick={() => handleFormat('bold')} className="p-2 bg-white/5 rounded-lg hover:text-indigo-400" title="Negrito"><Bold size={16}/></button>
                                <button onClick={() => handleFormat('italic')} className="p-2 bg-white/5 rounded-lg hover:text-indigo-400" title="Itálico"><Italic size={16}/></button>
                                <button onClick={() => handleFormat('underline')} className="p-2 bg-white/5 rounded-lg hover:text-indigo-400" title="Sublinhado"><Underline size={16}/></button>
                             </div>
                        </div>

                        <input 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="bg-transparent border-none text-xl font-bold text-white placeholder-slate-700 outline-none w-full"
                            placeholder="Título da Tarefa ou Nota..."
                        />

                        <div className="h-px bg-white/5 w-full my-1"></div>

                        <div 
                            ref={editorRef}
                            contentEditable
                            className="flex-1 min-h-[150px] text-sm text-slate-300 outline-none placeholder:text-slate-700 leading-relaxed"
                            placeholder="Descreva detalhes ou anotações ricas aqui..."
                        />

                        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                                <Tag size={12} className="text-indigo-400" />
                                <select 
                                    className="bg-transparent text-[10px] font-bold text-slate-300 outline-none uppercase"
                                    value={selectedNiche}
                                    onChange={e => setSelectedNiche(e.target.value)}
                                >
                                    {Object.keys(NICHE_CONFIG).map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                                <Calendar size={12} className="text-indigo-400" />
                                <input 
                                    type="date" 
                                    className="bg-transparent text-[10px] font-bold text-slate-300 outline-none uppercase"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={handleSave}
                                className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active-scale shadow-lg shadow-indigo-500/20"
                            >
                                SALVAR
                            </button>
                        </div>
                    </div>

                    <div className="ios-glass p-6 rounded-[32px] border border-white/10 flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                            <Bot size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-black text-white uppercase italic">Nexus Jarvis</h4>
                            <p className="text-[10px] text-slate-500">Diga "Jarvis, organize meu dia" ou use o Brain Dump.</p>
                        </div>
                        <button className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all"><Sparkles size={18}/></button>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
                    <div className="relative shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                        <input 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:border-indigo-500 transition-all outline-none"
                            placeholder="Buscar no histórico do CRM..."
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>
                        ) : filteredTasks.map(task => (
                            <div key={task.id} className="ios-glass p-5 rounded-[28px] border border-white/5 hover:border-white/20 transition-all group animate-slide-up">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${NICHE_CONFIG[task.niche]?.color || 'bg-slate-500'}`} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{task.niche}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleDelete(task.id)} className="p-1.5 text-slate-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {task.status === 'done' ? 'Finalizado' : 'Aberto'}
                                        </span>
                                    </div>
                                </div>
                                <h4 className="text-base font-bold text-white mb-2 leading-tight">{task.title}</h4>
                                <div 
                                    className="text-xs text-slate-400 mb-4 line-clamp-3 prose prose-invert max-w-none prose-sm"
                                    dangerouslySetInnerHTML={{ __html: task.description || '' }}
                                />
                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                        <Clock size={12} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                                    </div>
                                    <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-all">Ver Detalhes</button>
                                </div>
                            </div>
                        ))}

                        {!loading && filteredTasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                <ListChecks size={48} className="mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">Nada encontrado.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Organizer;
