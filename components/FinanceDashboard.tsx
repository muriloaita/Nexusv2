
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, DollarSign, AlertCircle, Loader2, Wallet, PieChart, Plus, FileText, Upload, X, ArrowDownCircle, ArrowUpCircle, CheckCircle2, CircleDashed, Tag, LayoutGrid, Pencil, Trash2, Paperclip } from 'lucide-react';
import { db } from '../services/supabaseClient';
import { Task, Attachment } from '../types';

// --- Plano de Contas Otimizado ---
const FINANCIAL_PLAN = {
    'Entradas (Receitas)': [
        'Honorários/Contratos Mensais',
        'Consultorias/Serviços Pontuais',
        'Produtos Digitais',
        'Receita Financeira',
        'Reembolsos',
        'Venda de Ativos'
    ],
    'Saídas - PJ (Operacional)': [
        'Impostos/Taxas',
        'Comissões/Parceiros',
        'Software/SaaS (CRM, Cloud, IA)',
        'Contabilidade/Jurídico',
        'Marketing/Tráfego',
        'Equipe/Freelancers',
        'Pró-labore',
        'Equipamentos/Manutenção'
    ],
    'Saídas - PF (Pessoal)': [
        'Habitação (Aluguel/Luz)',
        'Saúde e Bem-estar',
        'Transporte/Combustível',
        'Estilo de Vida/Lazer',
        'Educação Pessoal'
    ],
    'Movimentação (Neutro)': [
        'Transferências Internas',
        'Investimentos',
        'Pagamento de Fatura'
    ]
};

const getProbability = (status: string): number => {
  switch (status) {
    case 'done': return 1.0;
    case 'in-progress': return 0.60;
    case 'todo': return 0.30;
    default: return 0.1;
  }
};

const FinanceDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [newEntryType, setNewEntryType] = useState<'income' | 'expense'>('income');
  const [newEntryStatus, setNewEntryStatus] = useState<'guaranteed' | 'speculation'>('speculation');
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryCategory, setNewEntryCategory] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
      const data = await db.tasks.fetch();
      // Filter primarily by 'Finanças' niche or items with value, using explicit fields now
      const financialTasks = data.map((t: any) => ({
          ...t,
          dueDate: t.due_date,
          // Fallback logic for legacy data or data without explicit fields
          value: t.value || 0,
          financialType: t.financial_type || (t.value < 0 ? 'expense' : 'income'),
          financialCategory: t.financial_category || 'Geral'
      }));
      setTasks(financialTasks);
      setLoading(false);
  };

  useEffect(() => {
      fetchData();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          const newAtt: Attachment = {
              id: Date.now().toString(),
              name: file.name,
              type: 'file',
              data: content,
              timestamp: Date.now()
          };
          setAttachedFiles(prev => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenNewEntry = () => {
      setEditingId(null);
      setNewEntryTitle('');
      setNewEntryValue('');
      setNewEntryCategory('');
      setNewEntryType('income');
      setNewEntryStatus('speculation');
      setNewEntryDate(new Date().toISOString().split('T')[0]);
      setAttachedFiles([]);
      setIsModalOpen(true);
  };

  const handleEditEntry = (task: Task) => {
      setEditingId(task.id);
      setNewEntryTitle(task.title);
      setNewEntryValue(Math.abs(task.value || 0).toString());
      setNewEntryDate(task.dueDate || new Date().toISOString().split('T')[0]);
      setNewEntryType((task.value || 0) < 0 ? 'expense' : 'income');
      setNewEntryStatus(task.status === 'done' ? 'guaranteed' : 'speculation');
      setNewEntryCategory(task.financialCategory || 'Geral');
      setAttachedFiles(task.attachments || []);
      setIsModalOpen(true);
  };

  const handleDeleteEntry = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm('Tem certeza que deseja excluir este lançamento financeiro?')) {
          await db.tasks.delete(id);
          fetchData();
      }
  };

  const handleSaveEntry = async () => {
      if (!newEntryTitle || !newEntryValue) return;
      
      const numValue = parseFloat(newEntryValue);
      const finalValue = newEntryType === 'expense' ? -Math.abs(numValue) : Math.abs(numValue);
      
      const taskPayload = {
          title: newEntryTitle,
          description: `Lançamento: ${newEntryCategory}`,
          niche: 'Finanças',
          status: newEntryStatus === 'guaranteed' ? 'done' : 'in-progress',
          priority: 'high',
          due_date: newEntryDate,
          // Explicit Financial Fields
          value: finalValue,
          financial_type: newEntryType,
          financial_category: newEntryCategory,
          attachments: attachedFiles
      };

      if (editingId) {
          await db.tasks.update(editingId, taskPayload);
      } else {
          await db.tasks.insert(taskPayload);
      }
      
      setIsModalOpen(false);
      handleOpenNewEntry(); // Reset form
      fetchData();
  };

  const chartData = useMemo(() => {
    if (tasks.length === 0) return [];

    const today = new Date();
    const monthsMap = new Map();

    for(let i=0; i<6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const key = d.toISOString().slice(0, 7); 
        monthsMap.set(key, {
            name: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            date: d,
            Garantido: 0,
            Projetado: 0,
            Gap: 0,
            Despesas: 0
        });
    }

    let acumulado = 0;
    const sortedTasks = [...tasks].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    sortedTasks.forEach(task => {
        if (!task.dueDate) return;
        const key = task.dueDate.slice(0, 7);
        
        if (monthsMap.has(key)) {
            const entry = monthsMap.get(key);
            const prob = getProbability(task.status);
            const val = task.value || 0;
            
            if (val < 0) {
                 if (task.status === 'done') {
                     entry.Garantido += val;
                     entry.Projetado += val;
                 } else {
                     entry.Projetado += (val * prob);
                 }
                 entry.Despesas += Math.abs(val);
            } else {
                if (task.status === 'done') {
                    entry.Garantido += val;
                    entry.Projetado += val;
                } else {
                    entry.Projetado += (val * prob);
                    entry.Gap += (val * prob);
                }
            }
        }
    });

    return Array.from(monthsMap.values()).map((item: any) => {
        acumulado += item.Projetado;
        return { ...item, Acumulado: acumulado };
    });

  }, [tasks]);

  const totalGarantido = chartData.reduce((acc, curr) => acc + curr.Garantido, 0);
  const totalProjetado = chartData.reduce((acc, curr) => acc + curr.Projetado, 0);
  
  // Filter only items that are strictly finance related (niche 'Finanças' or having value)
  const financialRecords = tasks
      .filter(t => t.niche === 'Finanças' || (t.value && t.value !== 0))
      .sort((a, b) => new Date(b.dueDate || '').getTime() - new Date(a.dueDate || '').getTime());

  if (loading) {
      return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>;
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar p-1 relative">
      
      {/* Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-indigo-950/20">
                      <h3 className="font-bold text-white flex items-center gap-2">
                          {editingId ? <Pencil className="text-emerald-400" /> : <Plus className="text-emerald-400" />}
                          {editingId ? "Editar Lançamento" : "Novo Lançamento"}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                  </div>
                  
                  <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                      <div className="flex gap-2 p-1 bg-slate-800 rounded-xl">
                          <button 
                            onClick={() => setNewEntryType('income')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${newEntryType === 'income' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                          >
                              <ArrowUpCircle size={16} /> RECEITA
                          </button>
                          <button 
                            onClick={() => setNewEntryType('expense')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${newEntryType === 'expense' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                          >
                              <ArrowDownCircle size={16} /> DESPESA
                          </button>
                      </div>

                      <div className="space-y-3">
                          <input 
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                            placeholder="Descrição..."
                            value={newEntryTitle}
                            onChange={e => setNewEntryTitle(e.target.value)}
                          />
                          <div className="flex gap-3">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-3 text-slate-500 font-bold">R$</span>
                                <input 
                                    type="number"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-indigo-500 font-mono"
                                    placeholder="0.00"
                                    value={newEntryValue}
                                    onChange={e => setNewEntryValue(e.target.value)}
                                />
                              </div>
                              <input 
                                type="date"
                                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                                value={newEntryDate}
                                onChange={e => setNewEntryDate(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-800">
                          <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><LayoutGrid size={12}/> Categoria</label>
                              <select 
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-sm appearance-none"
                                value={newEntryCategory}
                                onChange={e => setNewEntryCategory(e.target.value)}
                              >
                                  <option value="">Selecione...</option>
                                  {Object.entries(FINANCIAL_PLAN).map(([group, items]) => (
                                      <optgroup key={group} label={group}>
                                          {items.map(item => <option key={item} value={item}>{item}</option>)}
                                      </optgroup>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-slate-500">Status</label>
                              <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700">
                                      <input type="radio" checked={newEntryStatus === 'guaranteed'} onChange={() => setNewEntryStatus('guaranteed')} className="accent-emerald-500" />
                                      <span className="text-xs text-slate-300">Pago / Realizado</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700">
                                      <input type="radio" checked={newEntryStatus === 'speculation'} onChange={() => setNewEntryStatus('speculation')} className="accent-amber-500" />
                                      <span className="text-xs text-slate-300">Aberto / Previsão</span>
                                  </label>
                              </div>
                          </div>
                          
                          <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Comprovante</label>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white flex items-center justify-center gap-2"
                                >
                                    <Paperclip size={14} /> {attachedFiles.length > 0 ? `${attachedFiles.length} Anexos` : 'Anexar'}
                                </button>
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                          </div>
                      </div>

                      <button 
                        onClick={handleSaveEntry}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 active-scale transition-all"
                      >
                          {editingId ? "ATUALIZAR" : "SALVAR"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
             NEXUS<span className="text-emerald-400">FINANCE</span>
          </h2>
          <p className="text-xs text-slate-500 hidden md:block">Gestão Financeira Integrada ao Calendário</p>
        </div>
        <button 
            onClick={handleOpenNewEntry}
            className="bg-white hover:bg-slate-200 text-slate-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 transition-all active-scale"
        >
          <Plus size={18} /> Lançar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="p-6 rounded-[28px] border border-white/5 relative overflow-hidden group bg-gradient-to-br from-emerald-900/50 to-slate-900 shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet size={64} className="text-white" />
          </div>
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <DollarSign size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Caixa Realizado</span>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGarantido)}
          </span>
        </div>

        <div className="p-6 rounded-[28px] border border-white/5 relative overflow-hidden group bg-gradient-to-br from-blue-900/50 to-slate-900 shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={64} className="text-white" />
          </div>
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Fluxo Projetado</span>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProjetado)}
          </span>
        </div>

        <div className="p-6 rounded-[28px] border border-white/5 relative overflow-hidden group bg-gradient-to-br from-amber-900/40 to-slate-900 shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertCircle size={64} className="text-white" />
          </div>
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertCircle size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Gap Financeiro</span>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProjetado - totalGarantido)}
          </span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 flex-1 min-h-[350px] flex flex-col relative backdrop-blur-sm">
         <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            Performance Semestral
         </h3>
         
         <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
                <defs>
                    <linearGradient id="colorProjetado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                     <linearGradient id="colorGarantido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} 
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10}}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        borderColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: '16px',
                        color: 'white',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' 
                    }}
                    itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                    formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                />
                
                <Bar dataKey="Garantido" name="Realizado" stackId="a" fill="url(#colorGarantido)" radius={[0, 0, 4, 4]} barSize={24} />
                <Bar dataKey="Gap" name="Previsão" stackId="a" fill="url(#colorProjetado)" radius={[8, 8, 0, 0]} barSize={24} />
                <Line type="monotone" dataKey="Acumulado" name="Caixa Acumulado" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: "#0f172a", strokeWidth: 2, stroke: "#8b5cf6" }} />
            </ComposedChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Lista de Registros */}
      <div className="bg-slate-900/30 p-5 rounded-[32px] border border-white/5 flex flex-col gap-4 mb-20 md:mb-0">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Fluxo Recente</h4>
          <div className="space-y-2">
              {financialRecords.map(rec => (
                  <div key={rec.id} className="flex items-center gap-4 p-4 bg-slate-800/40 rounded-2xl border border-white/5 hover:bg-slate-800/80 transition-all group">
                      <div className={`p-3 rounded-full ${
                          (rec.value || 0) < 0 ? 'bg-red-500/10 text-red-400' :
                          rec.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                          {(rec.value || 0) < 0 ? <ArrowDownCircle size={20} /> : rec.status === 'done' ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-bold text-white truncate mb-1">{rec.title}</h5>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                              <span>{rec.dueDate ? new Date(rec.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                              {rec.financialCategory && <span className={`px-2 py-0.5 rounded bg-slate-800 text-slate-300`}>{rec.financialCategory}</span>}
                              {rec.attachments && rec.attachments.length > 0 && <Paperclip size={12} className="text-indigo-400" />}
                          </div>
                      </div>
                      <div className={`text-base font-black font-mono tracking-tight ${(rec.value || 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rec.value || 0)}
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditEntry(rec)} className="p-2 text-slate-500 hover:text-white hover:bg-indigo-600 rounded-lg transition-all"><Pencil size={16} /></button>
                          <button onClick={(e) => handleDeleteEntry(e, rec.id)} className="p-2 text-slate-500 hover:text-white hover:bg-red-600 rounded-lg transition-all"><Trash2 size={16} /></button>
                      </div>
                  </div>
              ))}
              {financialRecords.length === 0 && (
                  <div className="text-center text-slate-600 py-10">
                      Nenhum lançamento financeiro encontrado.
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
