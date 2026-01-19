
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    BrainCircuit, 
    CheckCircle2, 
    Circle, 
    Loader2, 
    Plus, 
    Mic, 
    Trash2, 
    Calendar as CalendarIcon,
    List as ListIcon,
    Trello,
    Clock,
    X,
    Target,
    Square,
    CheckSquare,
    Search,
    SlidersHorizontal,
    CalendarDays,
    Infinity,
    CalendarClock,
    AlertTriangle,
    Siren,
    RefreshCw,
    PlusCircle,
    Bot,
    ArrowLeft,
    ArrowRight,
    AlignLeft,
    Tag,
    Flag,
    Paperclip,
    FileText,
    Image as ImageIcon,
    Video,
    Download,
    Play,
    ListChecks,
    Bell
} from 'lucide-react';
import { planTasks, processAudioInput } from '../services/geminiService';
import { Task, VoiceNote, Subtask, Attachment } from '../types';
import { db } from '../services/supabaseClient';

const NICHE_COLORS: Record<string, string> = {
    'Trabalho': 'bg-blue-500',
    'Pessoal': 'bg-pink-500',
    'Saúde': 'bg-emerald-500',
    'Finanças': 'bg-yellow-500',
    'Ideias': 'bg-purple-500',
    'Geral': 'bg-slate-500'
};

const STATUS_CONFIG = {
    'todo': { label: 'PARA FAZER', bg: 'bg-slate-900/50', border: 'border-slate-800', icon: Circle, accent: 'text-slate-400' },
    'in-progress': { label: 'EXECUÇÃO', bg: 'bg-indigo-950/20', border: 'border-indigo-500/20', icon: Clock, accent: 'text-indigo-400' },
    'done': { label: 'CONCLUÍDO', bg: 'bg-emerald-950/20', border: 'border-emerald-500/20', icon: CheckCircle2, accent: 'text-emerald-400' }
};

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    window.dispatchEvent(new CustomEvent('nexus-toast', { detail: { message, type } }));
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
};

// Fixed AttachmentItem definition using React.FC to properly handle key prop in lists and ensure correct type inference
const AttachmentItem: React.FC<{ att: Attachment, onDelete: (id: string) => void | Promise<void> }> = ({ att, onDelete }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5 hover:border-indigo-500/30 group transition-all">
        <div className="p-2 bg-slate-900 rounded-lg text-indigo-400">
            {att.type === 'image' && <ImageIcon size={16}/>}
            {att.type === 'video' && <Video size={16}/>}
            {att.type === 'audio' && <Mic size={16}/>}
            {att.type === 'pdf' && <FileText size={16}/>}
            {(att.type === 'file' || att.type === 'text') && <Paperclip size={16}/>}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{att.name}</p>
            <div className="flex gap-2">
               <a href={att.data} download={att.name} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"><Download size={10}/> Baixar</a>
               {att.type === 'audio' && <span className="text-[10px] text-slate-500">Audio Note</span>}
            </div>
        </div>
        {att.type === 'image' && <img src={att.data} className="w-8 h-8 rounded-lg object-cover border border-white/10" />}
        <button onClick={() => onDelete(att.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 size={14}/>
        </button>
    </div>
);

const SmartBoard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'voice' | 'calendar'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterNiche, setFilterNiche] = useState<string>('Todas');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'next-7' | 'next-30'>('next-30');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [prompt, setPrompt] = useState('');
  
  // New Task Modal State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
      title: '',
      description: '',
      niche: 'Geral',
      priority: 'medium' as 'low'|'medium'|'high',
      dueDate: new Date().toISOString().split('T')[0],
      attachments: [] as Attachment[]
  });

  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingForTask, setRecordingForTask] = useState<boolean>(false); 
  
  const [procrastinationAlert, setProcrastinationAlert] = useState(false);
  const [currentSubtasks, setCurrentSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile for default view
  useEffect(() => {
      if (window.innerWidth < 768) {
          setViewMode('list'); // Default to minimalist list on mobile
      }
      refreshData();
  }, []);

  useEffect(() => { 
      if (selectedTask) {
          fetchSubtasks(selectedTask.id);
          setNewSubtaskTitle(''); // Reset subtask input
      } else {
          setCurrentSubtasks([]);
      }
  }, [selectedTask]);

  const refreshData = async () => {
      setIsLoadingTasks(true);
      const [tData, vData] = await Promise.all([db.tasks.fetch(), db.voiceNotes.fetch()]);
      setTasks(tData.map((t: any) => ({ 
          ...t, 
          id: t.id, 
          dueDate: t.due_date, 
          priority: t.priority, 
          rescheduleCount: t.reschedule_count || 0, 
          attachments: t.attachments || [],
          value: t.value // Ensure value is passed
      })));
      setVoiceNotes(vData.map((n: any) => {
          let metadata = { transcription: n.transcription || '', summary: '', niche: 'Geral' };
          try { if(n.transcription?.startsWith('{')) metadata = JSON.parse(n.transcription); } catch(e) {}
          return { id: n.id, transcription: metadata.transcription || n.transcription, summary: metadata.summary, detectedNiche: metadata.niche, timestamp: new Date(n.created_at), isTranscribing: false, audioUrl: n.audio_url };
      }));
      setIsLoadingTasks(false);
  };

  const fetchSubtasks = async (id: string) => {
      const subs = await db.subtasks.fetch(id);
      setCurrentSubtasks(subs);
  };

  const handleAddSubtask = async () => {
      if (!newSubtaskTitle.trim() || !selectedTask) return;
      
      try {
          const newSub = await db.subtasks.insert({
              taskId: selectedTask.id,
              title: newSubtaskTitle,
              completed: false
          });
          setCurrentSubtasks(prev => [...prev, newSub]);
          setNewSubtaskTitle('');
          showToast("Subtarefa adicionada!");
      } catch (e) {
          showToast("Erro ao adicionar subtarefa.", "error");
      }
  };

  const handleToggleSubtask = async (id: string, currentStatus: boolean) => {
      // Optimistic update
      const updatedSubtasks = currentSubtasks.map(s => 
          s.id === id ? { ...s, completed: !currentStatus } : s
      );
      setCurrentSubtasks(updatedSubtasks);

      try {
          await db.subtasks.update(id, { completed: !currentStatus });
      } catch (e) {
          // Revert on error
          setCurrentSubtasks(currentSubtasks);
          showToast("Erro ao atualizar status.", "error");
      }
  };

  const handleDeleteSubtask = async (id: string) => {
      if(!window.confirm("Remover esta subtarefa?")) return;
      
      const remaining = currentSubtasks.filter(s => s.id !== id);
      setCurrentSubtasks(remaining);
      
      try {
          await db.subtasks.delete(id);
      } catch (e) {
          setCurrentSubtasks(currentSubtasks);
          showToast("Erro ao remover subtarefa.", "error");
      }
  };

  const handleCreateDetailedTask = async () => {
      if (!newTaskData.title.trim()) {
          showToast("O título é obrigatório.", "error");
          return;
      }

      const tempTask = {
          title: newTaskData.title,
          description: newTaskData.description,
          niche: newTaskData.niche,
          status: 'todo',
          priority: newTaskData.priority,
          due_date: newTaskData.dueDate,
          reschedule_count: 0,
          attachments: newTaskData.attachments
      };

      try {
          await db.tasks.insert(tempTask);
          showToast("Tarefa criada com sucesso!");
          
          setIsNewTaskModalOpen(false);
          setNewTaskData({
              title: '',
              description: '',
              niche: 'Geral',
              priority: 'medium',
              dueDate: new Date().toISOString().split('T')[0],
              attachments: []
          });
          
          // Force refresh immediately
          await refreshData();
      } catch (error) {
          showToast("Erro ao criar tarefa, mas foi salva localmente.", "info");
          await refreshData();
      }
  };

  const startRecording = async (forTask = false) => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                
                if (forTask) {
                    // Task Mode: Just add as attachment
                    const newAtt: Attachment = {
                        id: Date.now().toString(),
                        name: `Nota de Voz ${new Date().toLocaleTimeString()}`,
                        type: 'audio',
                        data: `data:audio/webm;base64,${base64}`,
                        timestamp: Date.now()
                    };
                    
                    if (selectedTask) {
                        // Add to existing task
                        const updatedAttachments = [...(selectedTask.attachments || []), newAtt];
                        setSelectedTask({...selectedTask, attachments: updatedAttachments});
                        await db.tasks.update(selectedTask.id, { attachments: updatedAttachments });
                        showToast("Nota de voz anexada!");
                        refreshData();
                    } else {
                        // Add to new task draft
                        setNewTaskData(prev => ({ ...prev, attachments: [...prev.attachments, newAtt] }));
                        showToast("Nota de voz gravada!");
                    }
                } else {
                    // General Mode: Process with AI
                    const result = await processAudioInput(base64, 'audio/webm');
                    await db.voiceNotes.insert({ audio_url: reader.result, transcription: JSON.stringify(result) });
                    showToast("Memo de voz processado!");
                    refreshData();
                }
            };
            reader.readAsDataURL(blob);
        };
        
        mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingForTask(forTask);
    } catch (e) { alert("Microfone bloqueado."); }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          setRecordingForTask(false);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          let type: Attachment['type'] = 'file';
          
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('audio/')) type = 'audio';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type === 'application/pdf') type = 'pdf';
          else if (file.type === 'text/plain') type = 'text';

          const newAtt: Attachment = {
              id: Date.now().toString(),
              name: file.name,
              type: type,
              data: content,
              timestamp: Date.now()
          };

          if (selectedTask) {
              const updatedAttachments = [...(selectedTask.attachments || []), newAtt];
              setSelectedTask({...selectedTask, attachments: updatedAttachments});
              await db.tasks.update(selectedTask.id, { attachments: updatedAttachments });
              showToast("Arquivo anexado!");
              refreshData();
          } else {
              setNewTaskData(prev => ({...prev, attachments: [...prev.attachments, newAtt]}));
          }
      };
      reader.readAsDataURL(file);
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = async (attId: string) => {
      if (confirm("Remover este anexo?")) {
          if (selectedTask) {
              const updated = (selectedTask.attachments || []).filter(a => a.id !== attId);
              setSelectedTask({...selectedTask, attachments: updated});
              await db.tasks.update(selectedTask.id, { attachments: updated });
              refreshData();
          } else {
              setNewTaskData(prev => ({...prev, attachments: prev.attachments.filter(a => a.id !== attId)}));
          }
      }
  };

  const filteredTasks = useMemo(() => {
      let f = tasks;
      if (filterNiche !== 'Todas') f = f.filter(t => t.niche === filterNiche);
      const today = new Date().toISOString().split('T')[0];
      if (filterDate !== 'all') {
          f = f.filter(t => {
              if (t.status === 'done') return true;
              if (!t.dueDate) return false;
              if (filterDate === 'today') return t.dueDate === today;
              const limit = new Date();
              limit.setDate(limit.getDate() + (filterDate === 'next-7' ? 7 : 30));
              return t.dueDate <= limit.toISOString().split('T')[0];
          });
      }
      return f;
  }, [tasks, filterNiche, filterDate]);

  const pendingCount = useMemo(() => filteredTasks.filter(t => t.status !== 'done').length, [filteredTasks]);
  const doneCount = useMemo(() => filteredTasks.filter(t => t.status === 'done').length, [filteredTasks]);

  const handleToggleTaskStatus = async () => {
      if (!selectedTask) return;
      const isFinishing = selectedTask.status !== 'done';
      const newStatus = isFinishing ? 'done' : 'todo';
      
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, status: newStatus as any } : t));
      setSelectedTask(null);
      
      showToast(isFinishing ? "Tarefa concluída! Parabéns." : "Tarefa reaberta.");
      await db.tasks.update(selectedTask.id, { status: newStatus }); 
      refreshData();
  };

  const quickToggle = async (e: React.MouseEvent, task: Task) => {
      e.stopPropagation();
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as any } : t));
      await db.tasks.update(task.id, { status: newStatus });
      if (newStatus === 'done') showToast("Concluído!");
  };

  const changeMonth = (offset: number) => {
      setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      const monthName = calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

      const days = [];
      for (let i = 0; i < firstDay; i++) {
          days.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-slate-900/20 border border-white/5 opacity-50 rounded-xl" />);
      }

      for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayTasks = tasks.filter(t => t.dueDate === dateStr);
          const isToday = new Date().toISOString().split('T')[0] === dateStr;

          days.push(
              <div key={d} className={`h-24 md:h-32 bg-slate-900/40 border border-white/5 p-2 flex flex-col gap-1 rounded-xl transition-all hover:bg-white/5 ${isToday ? 'ring-1 ring-indigo-500 bg-indigo-500/10' : ''}`}>
                  <span className={`text-xs font-bold ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>{d}</span>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                      {dayTasks.map(t => (
                          <div 
                            key={t.id} 
                            onClick={() => setSelectedTask(t)} 
                            className={`px-2 py-1 rounded-md text-[9px] font-bold text-white truncate cursor-pointer hover:opacity-80 flex justify-between ${NICHE_COLORS[t.niche]} ${t.status === 'done' ? 'opacity-50 line-through' : ''}`}
                          >
                              <span>{t.title}</span>
                              {t.value && <span className="opacity-70 text-[8px]">{t.value > 0 ? '+' : ''}{t.value}</span>}
                          </div>
                      ))}
                  </div>
              </div>
          );
      }

      return (
          <div className="h-full flex flex-col animate-fade-in pb-20">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-white capitalize">{monthName}</h3>
                  <div className="flex gap-2">
                      <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-800 border border-slate-700 rounded-xl hover:text-indigo-400"><ArrowLeft size={18} /></button>
                      <button onClick={() => changeMonth(1)} className="p-2 bg-slate-800 border border-slate-700 rounded-xl hover:text-indigo-400"><ArrowRight size={18} /></button>
                  </div>
              </div>
              <div className="grid grid-cols-7 gap-2 md:gap-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              <div className="grid grid-cols-7 gap-2 md:gap-4 flex-1 overflow-y-auto custom-scrollbar">
                  {days}
              </div>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col gap-6 select-none relative" onClick={() => setIsFilterMenuOpen(false)}>
      
      {/* Alerta Procrastinação */}
      {procrastinationAlert && (
          <div className="fixed inset-0 z-[200] bg-red-950/90 backdrop-blur-xl flex items-center justify-center p-8">
              <div className="bg-black border-2 border-red-500 rounded-[40px] p-8 text-center max-w-sm animate-bounce-in">
                  <Siren size={64} className="mx-auto text-red-500 mb-6" />
                  <h2 className="text-3xl font-black text-white mb-4 uppercase italic">Sem Desculpas!</h2>
                  <p className="text-red-200 mb-8 text-sm">Você reagendou esta tarefa múltiplas vezes. Discipline-se!</p>
                  <button onClick={() => setProcrastinationAlert(false)} className="w-full bg-red-600 py-4 rounded-2xl font-black text-white active-scale">EU VOU FAZER</button>
              </div>
          </div>
      )}

      {/* New Task Modal */}
      {isNewTaskModalOpen && (
          <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-indigo-950/20">
                      <h3 className="font-bold text-white flex items-center gap-2">
                          <PlusCircle className="text-indigo-400" /> Nova Tarefa
                      </h3>
                      <button onClick={() => setIsNewTaskModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                  </div>
                  
                  <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                      <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">Título</label>
                          <input 
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-sm font-bold"
                              placeholder="O que precisa ser feito?"
                              value={newTaskData.title}
                              onChange={e => setNewTaskData({...newTaskData, title: e.target.value})}
                              autoFocus
                          />
                      </div>
                      
                      <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><AlignLeft size={12}/> Descrição (Opcional)</label>
                          <textarea 
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-sm min-h-[80px]"
                              placeholder="Detalhes adicionais..."
                              value={newTaskData.description}
                              onChange={e => setNewTaskData({...newTaskData, description: e.target.value})}
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><CalendarIcon size={12}/> Vencimento</label>
                              <input 
                                  type="date"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-sm"
                                  value={newTaskData.dueDate}
                                  onChange={e => setNewTaskData({...newTaskData, dueDate: e.target.value})}
                              />
                          </div>
                          
                          <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><Flag size={12}/> Prioridade</label>
                              <select 
                                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-sm appearance-none"
                                  value={newTaskData.priority}
                                  onChange={e => setNewTaskData({...newTaskData, priority: e.target.value as any})}
                              >
                                  <option value="low">Baixa</option>
                                  <option value="medium">Média</option>
                                  <option value="high">Alta</option>
                              </select>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><Tag size={12}/> Nicho</label>
                          <div className="flex flex-wrap gap-2">
                              {Object.keys(NICHE_COLORS).map(niche => (
                                  <button
                                      key={niche}
                                      onClick={() => setNewTaskData({...newTaskData, niche})}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          newTaskData.niche === niche 
                                          ? `${NICHE_COLORS[niche]} text-white border-transparent` 
                                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                                      }`}
                                  >
                                      {niche}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Anexos na Criação */}
                      <div className="space-y-2">
                           <div className="flex justify-between items-center">
                                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2"><Paperclip size={12}/> Anexos ({newTaskData.attachments.length})</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded hover:bg-indigo-500/20 flex items-center gap-1"
                                    >
                                        <Plus size={10} /> Arquivo
                                    </button>
                                    <button 
                                        onClick={() => isRecording ? stopRecording() : startRecording(true)}
                                        className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 ${isRecording && recordingForTask ? 'bg-red-500 text-white animate-pulse' : 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20'}`}
                                    >
                                        {isRecording && recordingForTask ? <Square size={10} fill="currentColor"/> : <Mic size={10} />}
                                        {isRecording && recordingForTask ? 'Parar' : 'Gravar Nota'}
                                    </button>
                                </div>
                           </div>
                           <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,audio/*,.pdf,.txt" />
                           
                           {newTaskData.attachments.length > 0 && (
                               <div className="space-y-2 bg-slate-900 p-2 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                                   {newTaskData.attachments.map(att => (
                                       <AttachmentItem key={att.id} att={att} onDelete={(id) => setNewTaskData(prev => ({...prev, attachments: prev.attachments.filter(a => a.id !== id)}))} />
                                   ))}
                               </div>
                           )}
                      </div>

                      <button 
                          onClick={handleCreateDetailedTask}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 active-scale transition-all flex items-center justify-center gap-2 mt-4"
                      >
                          <PlusCircle size={18} /> CRIAR TAREFA
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header Board */}
      <div className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
             <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-black text-white italic tracking-tighter">BOARD</h1>
                 <button 
                    onClick={() => setIsNewTaskModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-indigo-500/20 active-scale transition-all"
                 >
                     <Plus size={16} /> NOVA TAREFA
                 </button>
                 <div className="flex items-center gap-2 bg-indigo-600/20 px-3 py-1.5 rounded-full border border-indigo-500/20 hidden md:flex">
                     <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">{pendingCount} Pendentes</span>
                     <div className="w-1 h-1 bg-indigo-500/40 rounded-full" />
                     <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{doneCount} Feitas</span>
                 </div>
             </div>
             
             {/* View Switcher */}
             <div className="flex bg-white/5 p-1 rounded-xl shrink-0">
                {[
                    {id: 'kanban', icon: Trello}, 
                    {id: 'list', icon: ListIcon},
                    {id: 'calendar', icon: CalendarIcon}
                ].map((v, i) => (
                    <button 
                        key={v.id} 
                        onClick={() => setViewMode(v.id as any)} 
                        className={`p-2.5 rounded-lg transition-all active-scale ${viewMode === v.id ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        title={v.id}
                    >
                        <v.icon size={18} />
                    </button>
                ))}
             </div>
          </div>

          {/* Filtros Mobile Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {['Todas', 'Trabalho', 'Saúde', 'Finanças', 'Ideias'].map(n => (
                  <button key={n} onClick={() => setFilterNiche(n)} className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all active-scale ${filterNiche === n ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-500 border-white/5'}`}>{n}</button>
              ))}
              <div className="w-px h-6 bg-white/10 shrink-0 mx-1" />
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFilterMenuOpen(!isFilterMenuOpen); }}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${filterDate !== 'all' ? 'bg-white text-black' : 'text-slate-500 border-white/5'}`}
              >
                  <SlidersHorizontal size={12} /> Prazo
              </button>
          </div>
      </div>

      {/* AI Bar */}
      <div className="ios-glass p-1.5 rounded-2xl flex items-center gap-2 focus-within:ring-2 ring-indigo-500/50 transition-all">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg active-scale">
              <Bot size={20} className={isThinking ? 'animate-spin' : ''} />
          </div>
          <input 
            value={prompt} 
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (async () => { 
                setIsThinking(true); 
                const tasks = await planTasks(prompt); 
                if (tasks && tasks.length > 0) showToast(`${tasks.length} tarefas planejadas pela IA!`);
                setPrompt(''); 
                refreshData(); 
                setIsThinking(false); 
            })()}
            placeholder="Comando AI: 'Planejar semana' ou 'Criar tarefa rápida'..." 
            className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-600 outline-none" 
          />
          <button onClick={() => setIsNewTaskModalOpen(true)} className="p-3 text-slate-500 hover:text-white active-scale">
              <PlusCircle size={20} />
          </button>
      </div>

      {/* VIEWS */}
      
      {/* Calendar View */}
      {viewMode === 'calendar' && renderCalendar()}

      {/* Kanban com Rolagem elástica e Snap */}
      {viewMode === 'kanban' && (
          <div className="flex-1 flex gap-4 overflow-x-auto kanban-snap no-scrollbar pb-6 -mx-4 px-4">
              {Object.entries(STATUS_CONFIG).map(([id, cfg]) => (
                  <div key={id} className="kanban-column shrink-0 w-[85vw] md:w-80 flex flex-col bg-slate-900/40 rounded-[32px] border border-white/5 p-4 overflow-hidden">
                      <div className="flex justify-between items-center mb-5 px-2">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <cfg.icon size={14} className={cfg.accent} /> {cfg.label}
                          </h3>
                          <span className="text-[10px] font-bold text-white bg-white/5 px-2 py-1 rounded-lg">{filteredTasks.filter(t => t.status === id).length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-10">
                          {filteredTasks.filter(t => t.status === id).map(task => (
                              <div 
                                key={task.id} 
                                onClick={() => setSelectedTask(task)}
                                className={`bg-slate-900 p-5 rounded-[24px] border border-white/5 active-scale transition-all ${NICHE_COLORS[task.niche]} bg-opacity-[0.03]`}
                              >
                                  <div className="flex justify-between items-start mb-3">
                                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black text-white uppercase ${NICHE_COLORS[task.niche]}`}>{task.niche}</span>
                                      {task.priority === 'high' && <AlertTriangle size={14} className="text-red-500" />}
                                      {task.attachments && task.attachments.length > 0 && <Paperclip size={12} className="text-slate-500 ml-auto" />}
                                  </div>
                                  <h4 className="text-sm font-bold text-white leading-tight mb-1">{task.title}</h4>
                                  {task.value && (
                                     <div className={`text-[10px] font-mono font-bold mt-1 ${task.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                         {task.value < 0 ? '-' : '+'} R$ {Math.abs(task.value).toFixed(2)}
                                     </div>
                                  )}
                                  {task.dueDate && (
                                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase mt-2">
                                          <CalendarIcon size={10} /> {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* Minimalist Mobile List (Reminder Style) */}
      {viewMode === 'list' && (
          <div className="flex-1 scroll-container px-4 pb-24 pt-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 mt-2">
                  Seus Lembretes ({pendingCount})
              </div>

              <div className="space-y-1">
                  {filteredTasks.map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedTask(task)} 
                        className={`group flex items-center gap-4 py-4 border-b border-white/5 active:bg-white/5 transition-colors ${task.status === 'done' ? 'opacity-40' : ''}`}
                      >
                          {/* Check Button */}
                          <button 
                            onClick={(e) => quickToggle(e, task)}
                            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                task.status === 'done' 
                                ? 'bg-indigo-500 border-indigo-500 text-white' 
                                : 'border-slate-600 group-hover:border-indigo-500'
                            }`}
                          >
                              {task.status === 'done' && <CheckCircle2 size={12} fill="currentColor" />}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                              <span className={`text-sm font-medium text-white truncate ${task.status === 'done' ? 'line-through' : ''}`}>
                                  {task.title}
                              </span>
                              <div className="flex items-center gap-2">
                                  {/* Niche Dot */}
                                  <div className={`w-1.5 h-1.5 rounded-full ${NICHE_COLORS[task.niche]}`} />
                                  
                                  {/* Date (Essential for reminders) */}
                                  {task.dueDate && (
                                      <span className={`text-[10px] ${new Date(task.dueDate) < new Date() ? 'text-red-400' : 'text-slate-500'}`}>
                                          {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                      </span>
                                  )}
                              </div>
                          </div>

                          {/* Priority Indicator (if high) */}
                          {task.priority === 'high' && task.status !== 'done' && (
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                          )}
                      </div>
                  ))}
              </div>
              
              {/* Empty State */}
              {filteredTasks.length === 0 && (
                  <div className="text-center text-slate-600 py-20 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3">
                        <CheckCircle2 size={20} className="opacity-20" />
                      </div>
                      <p className="text-xs font-medium">Tudo feito.</p>
                  </div>
              )}
          </div>
      )}

      {/* Task Detail Modal (Existing) */}
      {selectedTask && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center animate-fade-in" onClick={() => setSelectedTask(null)}>
              <div className="absolute inset-0 bg-black/60" />
              <div className="w-full bg-slate-950 rounded-t-[40px] p-8 pb-12 shadow-2xl relative animate-slide-up flex flex-col gap-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto shrink-0" onClick={() => setSelectedTask(null)} />
                  
                  <div className="space-y-2">
                      <div className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black text-white uppercase ${NICHE_COLORS[selectedTask.niche]}`}>{selectedTask.niche}</div>
                      <h2 className="text-2xl font-black text-white leading-tight">{selectedTask.title}</h2>
                      
                      {selectedTask.value && (
                           <div className={`text-xl font-mono font-bold ${selectedTask.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {selectedTask.value < 0 ? 'Saída: ' : 'Entrada: '} 
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedTask.value)}
                           </div>
                      )}

                      <p className="text-sm text-slate-500">{selectedTask.description || 'Sem descrição.'}</p>
                  </div>

                  {/* Subtasks Section */}
                  <div className="space-y-3">
                      <div className="flex justify-between items-center border-t border-white/5 pt-4">
                          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><ListChecks size={14}/> Checklist & Subtarefas</h4>
                          <span className="text-[10px] font-bold text-slate-600 bg-white/5 px-2 py-0.5 rounded-md">
                              {currentSubtasks.filter(s => s.completed).length}/{currentSubtasks.length}
                          </span>
                      </div>
                      
                      {/* Progress Bar */}
                      {currentSubtasks.length > 0 && (
                          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-500 transition-all duration-500" 
                                style={{ width: `${(currentSubtasks.filter(s => s.completed).length / currentSubtasks.length) * 100}%` }}
                              />
                          </div>
                      )}

                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                          {currentSubtasks.map(sub => (
                              <div key={sub.id} className="flex items-center gap-3 group py-1">
                                  <button onClick={() => handleToggleSubtask(sub.id, sub.completed)} className={`transition-colors ${sub.completed ? 'text-emerald-500' : 'text-slate-600 hover:text-slate-400'}`}>
                                      {sub.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                  </button>
                                  <span className={`text-sm flex-1 cursor-pointer select-none ${sub.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`} onClick={() => handleToggleSubtask(sub.id, sub.completed)}>{sub.title}</span>
                                  <button onClick={() => handleDeleteSubtask(sub.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                          
                          {currentSubtasks.length === 0 && (
                                <p className="text-xs text-slate-600 italic">Nenhuma subtarefa.</p>
                          )}
                      </div>
                          
                      {/* Add Subtask Input */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                          <Plus size={16} className="text-slate-500" />
                          <input 
                              className="bg-transparent border-none text-sm text-white placeholder-slate-600 outline-none flex-1 py-1 focus:border-indigo-500 transition-colors"
                              placeholder="Adicionar subtarefa..."
                              value={newSubtaskTitle}
                              onChange={e => setNewSubtaskTitle(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                          />
                          <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="text-xs font-bold text-indigo-400 disabled:opacity-30 uppercase">Add</button>
                      </div>
                  </div>

                  {/* Attachments Section in Detail */}
                  <div className="space-y-3">
                      <div className="flex justify-between items-center border-t border-white/5 pt-4">
                          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Paperclip size={14}/> Arquivos & Mídia ({selectedTask.attachments?.length || 0})</h4>
                          <div className="flex gap-2">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20"
                                    title="Adicionar Arquivo"
                                >
                                    <Plus size={14} />
                                </button>
                                <button 
                                    onClick={() => isRecording ? stopRecording() : startRecording(true)}
                                    className={`p-2 rounded-lg ${isRecording && recordingForTask ? 'bg-red-500 text-white animate-pulse' : 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20'}`}
                                    title="Gravar Audio Note"
                                >
                                    {isRecording && recordingForTask ? <Square size={14} fill="currentColor"/> : <Mic size={14} />}
                                </button>
                          </div>
                          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,audio/*,.pdf,.txt" />
                      </div>

                      <div className="space-y-2">
                           {(selectedTask.attachments || []).length === 0 ? (
                               <p className="text-xs text-slate-600 italic">Nenhum anexo nesta tarefa.</p>
                           ) : (
                               (selectedTask.attachments || []).map(att => (
                                   <AttachmentItem key={att.id} att={att} onDelete={removeAttachment} />
                               ))
                           )}
                      </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-4">
                      <button 
                        onClick={handleToggleTaskStatus}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active-scale ${selectedTask.status === 'done' ? 'bg-slate-800 text-slate-400' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}
                      >
                          {selectedTask.status === 'done' ? 'REABRIR' : 'CONCLUIR AGORA'}
                      </button>
                      <div className="flex gap-3">
                          <button onClick={async () => { 
                              if (window.confirm("Remover esta tarefa?")) {
                                await db.tasks.delete(selectedTask.id); 
                                setSelectedTask(null); 
                                showToast("Tarefa excluída.", "error");
                                refreshData(); 
                              }
                          }} className="flex-1 py-4 rounded-2xl bg-white/5 text-red-500 text-xs font-bold active-scale">EXCLUIR</button>
                          <button onClick={() => setSelectedTask(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 text-xs font-bold active-scale">VOLTAR</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Filtro Dropdown */}
      {isFilterMenuOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6" onClick={() => setIsFilterMenuOpen(false)}>
              <div className="w-full max-w-xs bg-slate-900 border border-white/10 rounded-3xl p-4 shadow-2xl animate-scale-in flex flex-col gap-2">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Filtrar Prazo</h4>
                  {[
                      { id: 'all', label: 'Tudo', icon: Infinity },
                      { id: 'today', label: 'Hoje', icon: CalendarIcon },
                      { id: 'next-7', label: 'Próximos 7 Dias', icon: CalendarDays },
                      { id: 'next-30', label: 'Próximos 30 Dias', icon: CalendarClock }
                  ].map(item => (
                      <button key={item.id} onClick={() => { setFilterDate(item.id as any); setIsFilterMenuOpen(false); }} className={`flex items-center gap-3 w-full p-4 rounded-2xl text-xs font-bold transition-all active-scale ${filterDate === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                          <item.icon size={16} /> {item.label}
                      </button>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default SmartBoard;
