
import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, X, MessageSquare, Loader2, Sparkles, Command, Volume2, VolumeX, Mic, MicOff, CheckCircle2, TrendingDown } from 'lucide-react';
import { processJarvisInput, generateSpeech } from '../services/geminiService';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

const NexusChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<ChatMessage[]>([
        { id: '0', role: 'model', text: 'Sistemas Nexus prontos. Pode enviar seu Brain Dump por texto ou voz.', timestamp: new Date() }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => { if (isOpen) scrollToBottom(); }, [history, isOpen]);

    const handleSend = async (textOverride?: string) => {
        const input = textOverride || query;
        if (!input.trim()) return;
        
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
        setHistory(prev => [...prev, userMsg]);
        setQuery('');
        setIsLoading(true);

        try {
            const response = await processJarvisInput(input, history.slice(-3).map(h => `${h.role}: ${h.text}`).join('\n'));
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: response, timestamp: new Date() };
            setHistory(prev => [...prev, aiMsg]);
        } catch (error) {
            setHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'Falha na conexão neural. Verifique sua rede.', timestamp: new Date() }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSpeak = async (text: string, msgId: string) => {
        if (isSpeakingId === msgId) {
            currentSourceRef.current?.stop();
            setIsSpeakingId(null);
            return;
        }
        currentSourceRef.current?.stop();
        setIsSpeakingId(msgId);

        try {
            const base64Audio = await generateSpeech(text);
            if (base64Audio) {
                if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.onended = () => setIsSpeakingId(null);
                currentSourceRef.current = source;
                source.start();
            }
        } catch (e) { setIsSpeakingId(null); }
    };

    return (
        <div className="fixed z-[100] flex flex-col pointer-events-none bottom-24 left-1/2 -translate-x-1/2 items-center md:bottom-8 md:right-8 md:left-auto md:translate-x-0 md:items-end">
            
            {isOpen && (
                <div className="pointer-events-auto mb-4 w-[90vw] md:w-[400px] h-[70vh] md:h-[600px] bg-black/90 backdrop-blur-3xl rounded-[32px] shadow-2xl flex flex-col animate-scale-in overflow-hidden relative ring-1 ring-white/10 group">
                    <div className="absolute inset-0 rounded-[32px] p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 opacity-30 pointer-events-none" />

                    <div className="p-4 flex justify-between items-center shrink-0 relative z-10 bg-white/5">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-indigo-400 animate-pulse" size={18} />
                            <span className="font-black text-white tracking-widest uppercase text-[10px]">JARVIS CORE v2.5</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={16} className="text-white" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
                        {history.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-white/5'
                                } shadow-lg`}>
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    {msg.role === 'model' && (
                                        <button onClick={() => handleSpeak(msg.text, msg.id)} className={`mt-2 flex items-center gap-2 p-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest ${isSpeakingId === msg.id ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/5 text-slate-500 border-white/10 hover:text-indigo-400'}`}>
                                            {isSpeakingId === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />} {isSpeakingId === msg.id ? 'Parar' : 'Ouvir'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                             <div className="flex justify-start">
                                <div className="bg-slate-800 p-4 rounded-2xl flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 relative z-10 bg-gradient-to-t from-black to-transparent">
                        <div className="relative flex items-center bg-slate-900 rounded-full px-2 py-2 border border-white/10 focus-within:border-indigo-500/50">
                            <input 
                                autoFocus
                                className="w-full bg-transparent pl-4 pr-12 text-sm text-white placeholder-slate-600 outline-none"
                                placeholder="Dê um Brain Dump natural..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                disabled={isLoading}
                            />
                            <button onClick={() => handleSend()} disabled={!query.trim() || isLoading} className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all active:scale-90 disabled:opacity-50">
                                <Send size={16} fill="white" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => setIsOpen(!isOpen)} className="pointer-events-auto group relative w-16 h-16 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-[100]">
                <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-emerald-500 blur-lg opacity-60 group-hover:opacity-100 transition-opacity ${isOpen ? 'animate-pulse' : 'animate-pulse'}`}></div>
                <div className="relative w-full h-full rounded-full bg-black border border-white/20 flex items-center justify-center overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 to-emerald-600/30"></div>
                    {isOpen ? <X className="text-white relative z-10" size={28} /> : <BrainCircuit className="text-white relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" size={28} />}
                </div>
            </button>
        </div>
    );
};

export default NexusChatWidget;
