
import React, { useState, useRef, useEffect } from 'react';
import { 
    FolderPlus, 
    Folder, 
    Image as ImageIcon, 
    Mic, 
    Type, 
    Send, 
    Bot, 
    Loader2,
    Trash2,
    X,
    MessageSquare,
    Square,
    Play,
    FileText,
    Video,
    Paperclip,
    ChevronRight,
    Home,
    FolderOpen,
    ShieldCheck,
    FileSignature,
    Copy,
    Check,
    BrainCircuit,
    Wand2,
    Globe,
    Volume2,
    Layout,
    Ratio,
    Film,
    ScanEye,
    ArrowLeft
} from 'lucide-react';
import { IdeaProject, IdeaItem, ChatMessage, IdeaFolder, AspectRatio } from '../types';
import { consultProjectAssistant, transcribeAudio, structureProjectIdea, generateImage, searchWeb, generateSpeech, analyzeVideo } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { db, DatabaseProject, DatabaseIdeaItem } from '../services/supabaseClient';

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

const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface Blueprint {
    title: string;
    overview: string;
    objectives: string[];
    phases: { name: string, tasks: string[] }[];
    resources: string[];
    risks: string[];
}

const IdeaLab: React.FC = () => {
    const [projects, setProjects] = useState<IdeaProject[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [folders, setFolders] = useState<IdeaFolder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    
    const [items, setItems] = useState<IdeaItem[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingTool, setLoadingTool] = useState<string | null>(null);
    
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    
    const [textInput, setTextInput] = useState('');
    const [isTemplateMode, setIsTemplateMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const [chatQuery, setChatQuery] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const analysisInputRef = useRef<HTMLInputElement>(null);

    // Studio Integration States
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
    const [showRatioSelector, setShowRatioSelector] = useState(false);

    // Template Generation State
    const [selectedTemplate, setSelectedTemplate] = useState<IdeaItem | null>(null);
    const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

    // Architect Mode State
    const [isArchitectMode, setIsArchitectMode] = useState(false);
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const [architectQuery, setArchitectQuery] = useState('');
    const [architectHistory, setArchitectHistory] = useState<ChatMessage[]>([
        {id: '0', role: 'model', text: 'Olá. Sou o Arquiteto Nexus. Descreva sua ideia e eu vou estruturá-la no quadro ao lado.', timestamp: new Date()}
    ]);
    const [isArchitectThinking, setIsArchitectThinking] = useState(false);
    
    const activeProject = projects.find(p => p.id === activeProjectId);

    useEffect(() => { fetchProjects(); }, []);
    
    useEffect(() => { 
        if (activeProjectId) { 
            fetchItems(activeProjectId); 
            fetchFolders(activeProjectId);
            setCurrentFolderId(null);
            setChatHistory([]); 
            setBlueprint(null);
            setArchitectHistory([{id: '0', role: 'model', text: 'Olá. Sou o Arquiteto Nexus. Descreva sua ideia e eu vou estruturá-la no quadro ao lado.', timestamp: new Date()}]);
        } 
    }, [activeProjectId]);

    const fetchProjects = async () => {
        try {
            const data = await db.projects.fetch();
            if (data) setProjects(data.map((p: DatabaseProject) => ({ id: p.id, name: p.name, description: p.description || '', createdAt: new Date(p.created_at) })));
        } catch (e) { console.error(e); } finally { setLoadingProjects(false); }
    };

    const deleteProject = async (e: React.MouseEvent | null, projectId: string) => {
        if(e) e.stopPropagation();
        
        if (!window.confirm("ATENÇÃO: Deseja excluir este projeto e TODOS os arquivos dentro dele?")) return;

        try {
            // Se o projeto deletado for o ativo, saia dele primeiro
            if (activeProjectId === projectId) {
                setActiveProjectId(null);
            }

            // Atualiza UI instantaneamente
            setProjects(prev => prev.filter(p => p.id !== projectId));
            
            await db.projects.delete(projectId);
            showToast("Projeto removido.", "success");
        } catch (error: any) {
            console.error("Erro ao excluir projeto:", error);
            showToast("Erro ao excluir. Tente novamente.", "error");
            fetchProjects(); // Reverte se der erro
        }
    };

    const fetchFolders = async (projId: string) => {
        const data = await db.folders.fetch(projId);
        if (data) setFolders(data.map((f: any) => ({ id: f.id, projectId: f.project_id || f.projectId, parentId: f.parent_id || f.parentId, name: f.name, createdAt: new Date(f.created_at || f.createdAt) })));
    };

    const fetchItems = async (projId: string) => {
        setLoadingItems(true);
        try {
            const data = await db.ideaItems.fetch(projId);
            if (data) setItems(data.map((i: DatabaseIdeaItem) => ({ 
                id: i.id, 
                projectId: i.project_id, 
                folder_id: i.folder_id,
                folderId: i.folder_id,
                type: i.type as any, 
                content: i.content || '', 
                name: i.name,
                transcription: i.transcription || undefined, 
                timestamp: new Date(i.created_at),
                hash: i.hash
            })));
        } catch (e) { console.error(e); } finally { setLoadingItems(false); }
    };

    const deleteItem = async (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation();
        if(!window.confirm("Excluir este item?")) return;
        
        try {
            await db.ideaItems.delete(itemId);
            showToast("Item removido.", "success");
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (e) {
            alert("Erro ao excluir item.");
        }
    };

    const createFolder = async () => {
        if (!newFolderName.trim() || !activeProjectId) return;
        await db.folders.insert({ projectId: activeProjectId, parentId: currentFolderId, name: newFolderName });
        showToast("Pasta criada!");
        fetchFolders(activeProjectId);
        setNewFolderName('');
        setIsCreatingFolder(false);
    };

    const addTextItem = async () => {
        if (!textInput.trim() || !activeProjectId) return;
        
        const type = isTemplateMode ? 'template' : 'text';
        
        await db.ideaItems.insert({ 
            project_id: activeProjectId, 
            folder_id: currentFolderId,
            type: type, 
            content: textInput,
            name: isTemplateMode ? 'Novo Modelo' : undefined
        });
        
        showToast("Nota salva.");
        fetchItems(activeProjectId); 
        setTextInput(''); 
        setIsTemplateMode(false);
    };

    // --- Creative Tools ---
    const handleGenImage = async () => {
        if(!textInput.trim() || !activeProjectId) return;
        setLoadingTool('image');
        setShowRatioSelector(false);
        try {
            const base64 = await generateImage(textInput, aspectRatio);
            if(base64) {
                await db.ideaItems.insert({ 
                    project_id: activeProjectId, 
                    folder_id: currentFolderId,
                    type: 'image', 
                    content: base64,
                    name: `Img (${aspectRatio}): ${textInput.slice(0, 20)}...`
                });
                showToast("Imagem gerada pela IA!");
                fetchItems(activeProjectId);
                setTextInput('');
            }
        } catch(e) { alert("Erro ao gerar imagem."); } finally { setLoadingTool(null); }
    };

    const handleWebSearch = async () => {
        if(!textInput.trim() || !activeProjectId) return;
        setLoadingTool('search');
        try {
            // Fixed: Expected 2 arguments, but got 3. Removed 'professional'.
            const res = await searchWeb(textInput, false);
            const content = `## Pesquisa: ${textInput}\n\n${res.text}\n\nFontes:\n${res.grounding.map((g: any) => `- ${g.web?.title || 'Link'}: ${g.web?.uri}`).join('\n')}`;
            
            await db.ideaItems.insert({ 
                project_id: activeProjectId, 
                folder_id: currentFolderId,
                type: 'text', 
                content: content,
                name: `Pesquisa: ${textInput.slice(0, 15)}...`
            });
            showToast("Pesquisa web integrada!");
            fetchItems(activeProjectId);
            setTextInput('');
        } catch(e) { alert("Erro na pesquisa."); } finally { setLoadingTool(null); }
    };

    const handleTTS = async () => {
        if(!textInput.trim() || !activeProjectId) return;
        setLoadingTool('tts');
        try {
            const base64 = await generateSpeech(textInput);
            if(base64) {
                await db.ideaItems.insert({ 
                    project_id: activeProjectId, 
                    folder_id: currentFolderId,
                    type: 'audio', 
                    content: `data:audio/wav;base64,${base64}`,
                    name: `Narrativa: ${textInput.slice(0, 15)}...`
                });
                showToast("Áudio de voz gerado.");
                fetchItems(activeProjectId);
                setTextInput('');
            }
        } catch(e) { alert("Erro ao narrar."); } finally { setLoadingTool(null); }
    };

    const handleAnalyzeMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeProjectId) return;
        
        setLoadingTool('analyze');
        try {
            const hash = await calculateSHA256(file);
            const reader = new FileReader();
            
            reader.onload = async (evt) => {
                const base64Content = (evt.target?.result as string).split(',')[1];
                const fullDataUrl = evt.target?.result as string;
                
                let type: IdeaItem['type'] = 'file';
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('audio/')) type = 'audio';
                else if (file.type.startsWith('video/')) type = 'video';

                let analysisText = "";
                const prompt = textInput.trim() || "Analise este arquivo detalhadamente.";
                
                if (type === 'video' || type === 'image') {
                    analysisText = await analyzeVideo(base64Content, file.type, prompt) || "Sem análise.";
                } else if (type === 'audio') {
                    analysisText = await transcribeAudio(base64Content, file.type) || "Sem transcrição.";
                }

                await db.ideaItems.insert({ 
                    project_id: activeProjectId, 
                    folder_id: currentFolderId,
                    type, 
                    content: fullDataUrl,
                    name: file.name,
                    hash: hash
                });

                await db.ideaItems.insert({ 
                    project_id: activeProjectId, 
                    folder_id: currentFolderId,
                    type: 'text', 
                    content: `## Análise Nexus: ${file.name}\n\n${analysisText}`,
                    name: `Análise: ${file.name}`
                });

                showToast("Arquivo analisado com sucesso!");
                fetchItems(activeProjectId);
                setTextInput('');
            };
            reader.readAsDataURL(file);
        } catch(e) { 
            console.error(e); 
        } finally { 
            setLoadingTool(null); 
            if(analysisInputRef.current) analysisInputRef.current.value = '';
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeProjectId) return;

        let type: IdeaItem['type'] = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type === 'application/pdf') type = 'pdf';

        const hash = await calculateSHA256(file);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const content = evt.target?.result as string;
            await db.ideaItems.insert({ 
                project_id: activeProjectId, 
                folder_id: currentFolderId,
                type, 
                content,
                name: file.name,
                hash: hash
            });
            showToast("Arquivo anexado.");
            fetchItems(activeProjectId);
        };
        reader.readAsDataURL(file);
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorderRef.current.onstop = async () => {
                if (!activeProjectId) return;
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const base64 = await blobToBase64(audioBlob);
                
                try {
                    const transcription = await transcribeAudio(base64, 'audio/webm');
                    await db.ideaItems.insert({ 
                        project_id: activeProjectId, 
                        folder_id: currentFolderId,
                        type: 'audio', 
                        content: `data:audio/webm;base64,${base64}`, 
                        transcription 
                    });
                    showToast("Áudio transcrito!");
                    fetchItems(activeProjectId);
                } catch (e) { console.error(e); }
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (e) { alert("Sem microfone"); }
    };

    const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

    const handleChat = async () => {
        if (!chatQuery.trim() || !activeProject) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatQuery, timestamp: new Date() };
        setChatHistory(prev => [...prev, userMsg]);
        setChatQuery('');
        setIsChatting(true);
        try {
            const historyStr = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
            const responseText = await consultProjectAssistant(activeProject.name, items, userMsg.text, historyStr);
            setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: responseText || "Sem resposta.", timestamp: new Date() }]);
        } catch (e) { console.error(e); } finally { setIsChatting(false); }
    };

    const handleArchitectChat = async () => {
        if (!architectQuery.trim()) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: architectQuery, timestamp: new Date() };
        setArchitectHistory(prev => [...prev, userMsg]);
        setArchitectQuery('');
        setIsArchitectThinking(true);

        try {
            const result = await structureProjectIdea(blueprint, userMsg.text);
            if (result.blueprint) {
                setBlueprint(result.blueprint);
            }
            if (result.conversationalResponse) {
                setArchitectHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: result.conversationalResponse, timestamp: new Date() }]);
            }
        } catch (e) { console.error(e); } finally { setIsArchitectThinking(false); }
    };

    const saveBlueprintAsDoc = async () => {
        if(!blueprint || !activeProjectId) return;
        const md = `# ${blueprint.title}\n\n## Overview\n${blueprint.overview}\n\n## Objectives\n${blueprint.objectives.map(o => `- ${o}`).join('\n')}\n\n## Phases\n${blueprint.phases.map(p => `### ${p.name}\n${p.tasks.map(t => `- [ ] ${t}`).join('\n')}`).join('\n')}`;
        
        await db.ideaItems.insert({ 
            project_id: activeProjectId, 
            folder_id: currentFolderId,
            type: 'text', 
            content: md,
            name: `Blueprint: ${blueprint.title}`
        });
        showToast("Blueprint salvo como nota.");
        fetchItems(activeProjectId);
    };

    const openTemplateModal = (item: IdeaItem) => {
        const regex = /\{\{(.*?)\}\}/g;
        const matches = [...item.content.matchAll(regex)];
        const vars: Record<string, string> = {};
        matches.forEach(m => vars[m[1]] = '');
        
        setTemplateVars(vars);
        setSelectedTemplate(item);
    };

    const generateDocument = async () => {
        if (!selectedTemplate || !activeProjectId) return;
        
        let content = selectedTemplate.content;
        Object.entries(templateVars).forEach(([key, value]) => {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        });

        await db.ideaItems.insert({
            project_id: activeProjectId,
            folder_id: currentFolderId,
            type: 'text',
            content: content,
            name: `Doc: ${selectedTemplate.name || 'Gerado'}`
        });

        showToast("Documento gerado do modelo!");
        fetchItems(activeProjectId);
        setSelectedTemplate(null);
    };

    const displayedFolders = folders.filter(f => f.parentId === currentFolderId);
    const displayedItems = items.filter(i => (i.folderId || null) === currentFolderId);

    const getBreadcrumbs = () => {
        const crumbs = [];
        let curr = currentFolderId;
        while(curr) {
            const f = folders.find(fo => fo.id === curr);
            if(f) {
                crumbs.unshift(f);
                curr = f.parentId;
            } else {
                break;
            }
        }
        return crumbs;
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 overflow-hidden relative p-2 md:p-0">
            {/* Template Generation Modal */}
            {selectedTemplate && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <FileSignature className="text-indigo-400" /> Gerar Documento
                            </h3>
                            <button onClick={() => setSelectedTemplate(null)} className="text-slate-500 hover:text-white"><X /></button>
                        </div>
                        <div className="space-y-4 mb-6">
                            {Object.keys(templateVars).length === 0 ? (
                                <p className="text-slate-400 text-sm">Este modelo não possui variáveis para preencher. Gerar assim mesmo?</p>
                            ) : (
                                Object.keys(templateVars).map(v => (
                                    <div key={v}>
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{v}</label>
                                        <input 
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-indigo-500"
                                            value={templateVars[v]}
                                            onChange={e => setTemplateVars({...templateVars, [v]: e.target.value})}
                                            placeholder={`Valor para ${v}...`}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                        <button onClick={generateDocument} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all active-scale">
                            GERAR DOCUMENTO AGORA
                        </button>
                    </div>
                </div>
            )}

            {/* Project List (Sidebar on Desktop, Full Screen on Mobile if no project selected) */}
            <div className={`w-full md:w-64 glass rounded-3xl border border-white/5 flex-col shrink-0 overflow-hidden ${activeProjectId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-white/5">
                    <button onClick={() => setIsCreatingProject(!isCreatingProject)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active-scale shadow-lg shadow-indigo-500/20">
                        <FolderPlus size={16} /> NOVO PROJETO
                    </button>
                    {isCreatingProject && (
                        <div className="mt-4 space-y-2 animate-slide-up">
                            <input autoFocus className="w-full bg-white/5 text-sm p-3 rounded-xl border border-white/10 text-white outline-none focus:border-indigo-500" placeholder="Nome..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (async () => { await db.projects.insert({ name: newProjectName }); showToast("Projeto criado!"); fetchProjects(); setNewProjectName(''); setIsCreatingProject(false); })()} />
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {projects.map(p => (
                        <div key={p.id} className="relative group">
                            <button 
                                onClick={() => setActiveProjectId(p.id)} 
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all active-scale ${
                                    activeProjectId === p.id 
                                    ? 'bg-white/10 text-white shadow-lg border border-white/10 backdrop-blur-md' 
                                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300 border border-transparent'
                                }`}
                            >
                                <Folder size={16} className={activeProjectId === p.id ? "text-indigo-400" : "text-slate-500"} /> 
                                <span className="truncate font-bold flex-1 text-left">{p.name}</span>
                                <ChevronRight size={14} className="md:hidden text-slate-600" />
                            </button>
                            {/* Delete Button (Visible on hover desktop, always accessible via long press logic or just secondary tap) */}
                            <button 
                                onClick={(e) => deleteProject(e, p.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                                title="Excluir Projeto"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {projects.length === 0 && !loadingProjects && (
                        <div className="text-center text-slate-600 py-10 text-xs">
                            Nenhum projeto criado.
                        </div>
                    )}
                </div>
            </div>

            {/* Project Details (Full Screen on Mobile if project selected, Column on Desktop) */}
            <div className={`flex-1 glass rounded-[40px] border border-white/5 flex-col min-w-0 overflow-hidden shadow-2xl relative ${!activeProjectId ? 'hidden md:flex' : 'flex'}`}>
                {/* ARCHITECT MODE OVERLAY */}
                {isArchitectMode && activeProjectId && (
                    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col md:flex-row">
                        {/* Chat Side */}
                        <div className="flex-[1] flex flex-col border-r border-white/10 bg-slate-900/50">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                                <h3 className="font-black text-white flex items-center gap-2"><Layout size={18} className="text-emerald-400" /> ARQUITETO</h3>
                                <button onClick={() => setIsArchitectMode(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={16}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {architectHistory.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-300'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isArchitectThinking && <div className="flex gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"/></div>}
                            </div>
                            <div className="p-4 border-t border-white/5">
                                <div className="relative">
                                    <input className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:border-emerald-500 outline-none" 
                                        placeholder="Fale sobre sua ideia..." 
                                        value={architectQuery} 
                                        onChange={e => setArchitectQuery(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && handleArchitectChat()}
                                    />
                                    <button onClick={handleArchitectChat} className="absolute right-2 top-2 p-1.5 text-emerald-400 hover:text-white"><Send size={16}/></button>
                                </div>
                            </div>
                        </div>
                        {/* Blueprint Side */}
                        <div className="flex-[2] flex flex-col bg-slate-950 p-8 overflow-y-auto custom-scrollbar">
                            {!blueprint ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                    <BrainCircuit size={64} className="mb-4 text-emerald-500/50" />
                                    <p>Aguardando input para estruturar o projeto...</p>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-fade-in max-w-3xl mx-auto w-full">
                                    <div className="border-b border-white/10 pb-6 flex justify-between items-start">
                                        <div>
                                            <h2 className="text-4xl font-black text-white mb-2">{blueprint.title}</h2>
                                            <p className="text-slate-400 text-lg">{blueprint.overview}</p>
                                        </div>
                                        <button onClick={saveBlueprintAsDoc} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"><FileText size={16}/> SALVAR DOC</button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-widest">Objetivos</h3>
                                            <ul className="space-y-2">
                                                {blueprint.objectives.map((o, i) => (
                                                    <li key={i} className="flex gap-3 text-slate-300 text-sm"><Check size={16} className="text-emerald-500 shrink-0"/> {o}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold uppercase text-red-400 tracking-widest">Riscos & Atenção</h3>
                                            <ul className="space-y-2">
                                                {blueprint.risks.map((r, i) => (
                                                    <li key={i} className="flex gap-3 text-slate-300 text-sm"><span className="text-red-500 shrink-0">!</span> {r}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold uppercase text-blue-400 tracking-widest mb-4">Cronograma de Fases</h3>
                                        <div className="space-y-4">
                                            {blueprint.phases.map((phase, i) => (
                                                <div key={i} className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                                    <h4 className="text-lg font-bold text-white mb-3">{phase.name}</h4>
                                                    <ul className="space-y-2 pl-4 border-l-2 border-white/10">
                                                        {phase.tasks.map((t, j) => (
                                                            <li key={j} className="text-slate-400 text-sm">{t}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!activeProjectId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                        <FolderOpen size={64} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Selecione ou crie um projeto.</p>
                    </div>
                ) : (
                <>
                <div className="p-4 md:p-6 border-b border-white/5 bg-white/5 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button onClick={() => setActiveProjectId(null)} className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10">
                                <ArrowLeft size={20} className="text-white"/>
                            </button>
                            <div>
                                <h2 className="text-xl font-black text-white truncate max-w-[200px] md:max-w-md">{activeProject?.name || "Nexus Lab"}</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest md:hidden">Detalhes do Projeto</p>
                            </div>
                            <button 
                                onClick={(e) => deleteProject(e, activeProjectId)} 
                                className="ml-auto md:ml-2 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                title="Excluir Projeto Atual"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => setIsArchitectMode(true)} disabled={!activeProjectId} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 active-scale disabled:opacity-50 transition-all">
                                <Layout size={16} /> <span className="hidden md:inline">ORGANIZADOR</span><span className="md:hidden">ARQUITETO</span>
                            </button>
                            <span className="bg-white/10 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold flex items-center whitespace-nowrap">{displayedItems.length} ARQUIVOS</span>
                        </div>
                    </div>
                    
                    {activeProjectId && (
                        <div className="flex items-center w-full overflow-x-auto custom-scrollbar pb-2">
                            <div className="flex items-center p-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl shadow-inner">
                                <button 
                                    onClick={() => setCurrentFolderId(null)} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-transparent ${
                                        !currentFolderId 
                                        ? 'bg-white/10 text-white shadow-sm border-white/5' 
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Home size={12} />
                                    <span className="truncate max-w-[80px]">Raiz</span>
                                </button>

                                {getBreadcrumbs().map((crumb, index) => (
                                    <React.Fragment key={crumb.id}>
                                        <ChevronRight size={10} className="text-slate-600 mx-1 shrink-0" />
                                        <button 
                                            onClick={() => setCurrentFolderId(crumb.id)} 
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-transparent whitespace-nowrap ${
                                                currentFolderId === crumb.id 
                                                ? 'bg-white/10 text-white shadow-sm border-white/5' 
                                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <Folder size={12} className={currentFolderId === crumb.id ? "text-indigo-400" : "text-slate-500"} />
                                            <span className="truncate max-w-[120px]">{crumb.name}</span>
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-900/50 border-b border-white/5 flex flex-col gap-3">
                    <div className="flex gap-2">
                         <div className="relative flex-1 group">
                            <input 
                                className={`w-full bg-white/5 border border-white/5 rounded-2xl pl-5 pr-32 md:pr-40 py-3 text-white placeholder-slate-600 text-sm focus:border-indigo-500 transition-all outline-none ${isTemplateMode ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}
                                placeholder={isTemplateMode ? "{{VAR}}..." : "Criar ou IA..."}
                                value={textInput} 
                                onChange={e => setTextInput(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addTextItem()} 
                                disabled={!activeProjectId} 
                            />
                            
                            <div className="absolute right-2 top-1.5 flex gap-1">
                                <div className="hidden md:flex relative items-center bg-white/5 rounded-xl hover:bg-white/10 transition-all group/ratio">
                                    <button 
                                        onClick={() => setShowRatioSelector(!showRatioSelector)}
                                        className="p-2 text-slate-500 hover:text-white border-r border-white/5"
                                        title="Proporção"
                                    >
                                        <Ratio size={14} />
                                    </button>
                                    
                                    {showRatioSelector && (
                                        <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl p-1 flex flex-col gap-1 z-50 shadow-xl min-w-[80px]">
                                            {["1:1", "16:9", "9:16", "4:3"].map(r => (
                                                <button key={r} onClick={() => { setAspectRatio(r as any); setShowRatioSelector(false); }} className={`px-2 py-1 text-xs text-left rounded-lg hover:bg-white/10 ${aspectRatio === r ? 'text-pink-400 font-bold' : 'text-slate-400'}`}>
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <button onClick={handleGenImage} disabled={loadingTool === 'image'} className="p-2 text-slate-400 hover:text-pink-400" title={`Gerar Imagem (${aspectRatio})`}>
                                        <ImageIcon size={16} className={loadingTool === 'image' ? 'animate-spin' : ''} />
                                    </button>
                                </div>

                                {/* Mobile Tools simplified - Smaller padding and buttons */}
                                <button onClick={() => analysisInputRef.current?.click()} disabled={loadingTool === 'analyze'} className="p-2 text-slate-400 hover:text-cyan-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all" title="Analisar Mídia">
                                    <ScanEye size={16} className={loadingTool === 'analyze' ? 'animate-spin' : ''} />
                                    <input ref={analysisInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleAnalyzeMedia} />
                                </button>
                                <button onClick={handleGenImage} disabled={loadingTool === 'image'} className="md:hidden p-2 text-slate-400 hover:text-pink-400 bg-white/5 rounded-xl">
                                     <ImageIcon size={16} className={loadingTool === 'image' ? 'animate-spin' : ''} />
                                </button>

                                <button onClick={handleWebSearch} disabled={loadingTool === 'search'} className="p-2 text-slate-400 hover:text-blue-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all" title="Pesquisar"><Globe size={16} className={loadingTool === 'search' ? 'animate-spin' : ''} /></button>
                            </div>
                         </div>
                        <button onClick={addTextItem} disabled={!textInput || !activeProjectId} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl active-scale disabled:opacity-30 shadow-lg"><Send size={20} /></button>
                    </div>

                    {/* Action Buttons: 2x2 Grid on Mobile for visibility, Flex on Desktop */}
                    <div className="grid grid-cols-2 md:flex gap-2">
                        {isRecording ? (
                             <button onClick={stopRecording} className="col-span-2 md:flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold animate-pulse active-scale md:min-w-[120px]">
                                <Square size={16} fill="currentColor" /> PARAR
                             </button>
                        ) : (
                            <button onClick={startRecording} disabled={!activeProjectId} className="bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold active-scale disabled:opacity-30 border border-white/5 transition-all md:flex-1 md:min-w-[120px]">
                                <Mic size={16} className="text-pink-500" /> GRAVAR
                            </button>
                        )}
                        <button onClick={() => setIsTemplateMode(!isTemplateMode)} disabled={!activeProjectId} className={`py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold active-scale disabled:opacity-30 border transition-all md:flex-1 md:min-w-[120px] ${isTemplateMode ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'}`}>
                             <FileSignature size={16} className={isTemplateMode ? "text-white" : "text-blue-400"} /> 
                             {isTemplateMode ? 'MODELO' : 'DOC'}
                        </button>
                        <button onClick={() => setIsCreatingFolder(true)} disabled={!activeProjectId} className="bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold active-scale disabled:opacity-30 border border-white/5 transition-all md:flex-1 md:min-w-[120px]">
                             <FolderPlus size={16} className="text-yellow-500" /> PASTA
                        </button>
                        <label className={`bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold cursor-pointer border border-white/5 transition-all active-scale md:flex-1 md:min-w-[120px] ${!activeProjectId && 'opacity-30 pointer-events-none'}`}>
                            <Paperclip size={16} className="text-emerald-500" /> ANEXAR
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>
                
                {/* Create Folder Input */}
                {isCreatingFolder && (
                     <div className="px-6 py-2 bg-slate-800 border-b border-white/5 flex gap-2 animate-fade-in">
                         <input autoFocus className="flex-1 bg-transparent text-white text-sm outline-none" placeholder="Nome da pasta..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createFolder()} />
                         <button onClick={createFolder} className="text-indigo-400 font-bold text-xs">CRIAR</button>
                         <button onClick={() => setIsCreatingFolder(false)} className="text-slate-500"><X size={16}/></button>
                     </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-32 md:pb-24">
                    {/* Folders Grid */}
                    {displayedFolders.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {displayedFolders.map(folder => (
                                <button key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 hover:bg-slate-700/50 flex flex-col items-center gap-2 transition-all active-scale group">
                                    <FolderOpen size={32} className="text-yellow-500/80 group-hover:text-yellow-400" />
                                    <span className="text-xs font-bold text-slate-300 truncate w-full text-center">{folder.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Items List */}
                    {displayedItems.map(item => (
                        <div key={item.id} className={`bg-white/5 rounded-[32px] p-5 border hover:border-indigo-500/30 transition-all group relative glass shadow-lg ${item.type === 'template' ? 'border-indigo-500/20 bg-indigo-900/5' : 'border-white/5'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-xl ${
                                    item.type === 'text' ? 'bg-blue-500/10 text-blue-400' : 
                                    item.type === 'audio' ? 'bg-pink-500/10 text-pink-400' : 
                                    item.type === 'image' ? 'bg-emerald-500/10 text-emerald-400' :
                                    item.type === 'video' ? 'bg-red-500/10 text-red-400' :
                                    item.type === 'template' ? 'bg-indigo-500/10 text-indigo-400' :
                                    'bg-slate-500/10 text-slate-300'
                                }`}>
                                    {item.type === 'text' && <Type size={16}/>}
                                    {item.type === 'audio' && <Mic size={16}/>}
                                    {item.type === 'image' && <ImageIcon size={16}/>}
                                    {item.type === 'video' && <Video size={16}/>}
                                    {item.type === 'template' && <FileSignature size={16}/>}
                                    {(item.type === 'pdf' || item.type === 'file') && <FileText size={16}/>}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{item.type === 'template' ? 'MODELO INTELIGENTE' : item.type}</span>
                                    {item.name && <span className="text-xs font-bold text-slate-300 truncate">{item.name}</span>}
                                </div>
                                <button onClick={(e) => deleteItem(e, item.id)} className="p-2 text-slate-600 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                            </div>

                            {item.type === 'text' && <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed whitespace-pre-wrap"><ReactMarkdown>{item.content}</ReactMarkdown></div>}
                            
                            {item.type === 'template' && (
                                <div>
                                    <p className="text-slate-400 text-xs italic mb-4 line-clamp-3 bg-black/20 p-3 rounded-xl border border-white/5">{item.content}</p>
                                    <button onClick={() => openTemplateModal(item)} className="w-full py-2 rounded-xl bg-indigo-600/20 text-indigo-400 text-xs font-bold border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all">
                                        USAR ESTE MODELO
                                    </button>
                                </div>
                            )}

                            {item.type === 'audio' && (
                                <div className="space-y-3">
                                    <audio controls src={item.content} className="w-full h-8 opacity-60" />
                                    {item.transcription && <div className="bg-black/20 p-4 rounded-2xl text-xs text-slate-400 italic border-l-2 border-pink-500/50">"{item.transcription}"</div>}
                                </div>
                            )}
                            
                            {item.type === 'image' && <img src={item.content} className="rounded-3xl border border-white/10 w-full max-w-sm object-cover" />}
                            
                            {item.type === 'video' && (
                                <video controls src={item.content} className="rounded-3xl border border-white/10 w-full max-w-sm" />
                            )}

                            {(item.type === 'pdf' || item.type === 'file') && (
                                <div className="bg-slate-900/50 p-4 rounded-2xl flex items-center gap-4 border border-white/5">
                                    {item.hash ? <ShieldCheck size={32} className="text-emerald-500" /> : <FileText size={32} className="text-slate-500" />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{item.name || 'Documento Anexado'}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <a href={item.content} download={item.name || "download"} className="text-xs text-indigo-400 hover:underline">Baixar</a>
                                            {item.hash && (
                                                <div className="group/hash relative flex items-center gap-1 text-[9px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded cursor-help">
                                                    <ShieldCheck size={10} /> VERIFICADO
                                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-black border border-white/10 rounded-lg text-xs text-slate-300 break-all opacity-0 group-hover/hash:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                                                        Hash SHA-256: <br/><span className="text-emerald-500 font-mono text-[10px]">{item.hash}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {displayedItems.length === 0 && displayedFolders.length === 0 && (
                        <div className="text-center text-slate-600 py-10">
                            <FolderOpen size={48} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Pasta vazia. Comece a criar.</p>
                        </div>
                    )}
                </div>
                </>
                )}
            </div>

            <div className="fixed bottom-32 right-6 md:bottom-10 md:right-10 z-[70] flex flex-col items-end">
                {isAssistantOpen && (
                    <div className="w-[90vw] md:w-96 h-[60vh] md:h-[500px] glass rounded-[40px] border border-white/10 shadow-2xl flex flex-col mb-4 animate-scale-in overflow-hidden">
                        <div className="p-5 border-b border-white/5 bg-indigo-600/20 flex justify-between items-center">
                            <h3 className="font-black text-white text-sm flex items-center gap-2"><BrainCircuit size={18} className="text-indigo-400" /> NEXUS AI</h3>
                            <button onClick={() => setIsAssistantOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] rounded-[24px] p-4 text-xs font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-200 border border-white/5 rounded-tl-none'}`}>
                                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-white/5 border-t border-white/5">
                            <div className="relative">
                                <input className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-5 pr-12 py-3 text-xs text-white outline-none focus:border-indigo-500 transition-all" placeholder="Consultar Nexus sobre o projeto..." value={chatQuery} onChange={e => setChatQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} />
                                <button onClick={handleChat} disabled={!chatQuery.trim() || isChatting} className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-xl active-scale disabled:opacity-30"><Send size={14}/></button>
                            </div>
                        </div>
                    </div>
                )}
                <button onClick={() => setIsAssistantOpen(!isAssistantOpen)} disabled={!activeProjectId} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl active-scale transition-all animate-pulse-glow ${isAssistantOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'}`}>
                    {isAssistantOpen ? <X size={24} /> : <MessageSquare size={24} />}
                </button>
            </div>
        </div>
    );
};

export default IdeaLab;
