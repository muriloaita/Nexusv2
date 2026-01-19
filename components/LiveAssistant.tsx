
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getClient, fetchNexusContext, nexusTools, executeNexusAction } from '../services/geminiService';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { LiveServerMessage, Modality } from '@google/genai';
import { db } from '../services/supabaseClient';
import { Mic, Activity, X, PhoneOff, BrainCircuit, CheckCircle, AlertCircle, Paperclip, Image as ImageIcon, Eye } from 'lucide-react';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

const LiveAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('Nexus Offline');
  const [volume, setVolume] = useState(0);
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<any>(null);
  
  const sessionRef = useRef<any>(null); 
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanup = useCallback(() => {
    if (sessionRef.current) { try { sessionRef.current.close(); } catch(e) {} sessionRef.current = null; }
    if (inputContextRef.current) inputContextRef.current.close();
    if (outputContextRef.current) outputContextRef.current.close();
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsActive(false);
    setStatus('Nexus Offline');
    setVolume(0);
  }, []);

  const startSession = async () => {
    setError(null);
    try {
      setStatus('Conectando Nexus...');
      const context = await fetchNexusContext();
      inputContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputContextRef.current = new AudioContext({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = getClient();
      
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setStatus('Nexus Online');
            setIsActive(true);
            const source = inputContextRef.current!.createMediaStreamSource(stream);
            const processor = inputContextRef.current!.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0; for(let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length)); 
              sessionPromise.then(s => { try { s.sendRealtimeInput({ media: createPcmBlob(inputData) }); } catch(err) {} });
            };
            source.connect(processor);
            processor.connect(inputContextRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             if (msg.toolCall) {
                 for (const fc of msg.toolCall.functionCalls) {
                     const result = await executeNexusAction(fc);
                     setLastAction(result);
                     sessionPromise.then(s => s.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] }));
                 }
                 setTimeout(() => setLastAction(null), 4000);
             }
             if (msg.serverContent?.interrupted) {
                 sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
                 return;
             }
             const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputContextRef.current) {
                const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), outputContextRef.current, 24000, 1);
                const source = outputContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputContextRef.current.destination);
                const cur = outputContextRef.current.currentTime;
                if (nextStartTimeRef.current < cur) nextStartTimeRef.current = cur;
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
             }
          },
          onerror: () => { setError("Falha na conexão neural."); cleanup(); },
          onclose: () => cleanup()
        },
        config: { 
            responseModalities: [Modality.AUDIO], 
            tools: nexusTools,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: `Você é o NEXUS, a IA operacional deste CRM. Você pode criar tarefas e registros financeiros. Use Português do Brasil. Dados atuais: ${context}` 
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e) { setError("Erro ao acessar microfone."); cleanup(); }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl glass rounded-[40px] p-12 flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden min-h-[500px]">
            <div className="z-10 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <BrainCircuit size={18} className="text-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">JARVIS v2.5</span>
                </div>
                <h2 className="text-3xl font-black text-white">{isActive ? "NEXUS ATIVO" : "EM STANDBY"}</h2>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">{status}</p>
            </div>

            {lastAction && (
                <div className="z-30 absolute top-32 bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-bounce-in border border-emerald-400/50">
                    <CheckCircle size={16} />
                    <span className="text-xs font-black uppercase">{lastAction}</span>
                </div>
            )}

            <div className="flex-1 flex items-center justify-center w-full relative z-10 py-10">
                <div className={`absolute rounded-full border border-indigo-500/10 transition-all ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    style={{ width: `${200 + volume * 500}px`, height: `${200 + volume * 500}px`, borderWidth: `${1 + volume * 10}px` }}
                />
                <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 shadow-indigo-500/50' : 'bg-slate-800'}`}
                    style={{ transform: `scale(${1 + volume})` }}>
                    <Activity size={64} className="text-white" />
                </div>
            </div>

            <button onClick={isActive ? cleanup : startSession} className={`z-20 p-5 px-12 rounded-3xl font-bold text-white transition-all active-scale flex items-center gap-3 ${isActive ? 'bg-red-500 shadow-red-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}`}>
                {isActive ? <><PhoneOff size={24} /> DESLIGAR</> : <><Mic size={24} /> CONECTAR</>}
            </button>
        </div>
    </div>
  );
};

export default LiveAssistant;
