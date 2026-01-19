
import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Video, Mic, Play, Sparkles, Loader2, Ratio } from 'lucide-react';
import { generateImage, analyzeVideo, transcribeAudio, generateSpeech } from '../services/geminiService';
import { AspectRatio } from '../types';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';

const CreativeStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'analysis' | 'tts'>('image');
  
  // Image State
  const [imgPrompt, setImgPrompt] = useState('');
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  // Analysis State
  const [file, setFile] = useState<File | null>(null);
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleGenImage = async () => {
    if(!imgPrompt) return;
    setImgLoading(true);
    try {
        const res = await generateImage(imgPrompt, aspect);
        setGeneratedImg(res);
    } catch(e) {
        alert("Erro ao gerar imagem.");
    } finally {
        setImgLoading(false);
    }
  };

  const handleAnalysis = async () => {
    if(!file) return;
    setAnalysisLoading(true);
    setAnalysisResult('');
    try {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            let res = '';
            
            if (file.type.startsWith('video')) {
                res = await analyzeVideo(base64, file.type, analysisPrompt || "Descreva este vídeo.");
            } else if (file.type.startsWith('audio')) {
                res = await transcribeAudio(base64, file.type);
            } else if (file.type.startsWith('image')) {
                 // For reuse, we could add analyzeImage service, but keeping strict to prompt features:
                 // "Video understanding" and "Transcribe audio" requested.
                 // Adding Image Analysis support via Video function (Multimodal generic)
                 res = await analyzeVideo(base64, file.type, analysisPrompt || "O que tem nesta imagem?"); 
            }
            setAnalysisResult(res || "Sem resultado.");
        };
        reader.readAsDataURL(file);
    } catch(e) {
        console.error(e);
        alert("Erro na análise.");
    } finally {
        setAnalysisLoading(false);
    }
  };

  const handleTTS = async () => {
      if(!ttsText) return;
      setTtsLoading(true);
      try {
          const base64Audio = await generateSpeech(ttsText);
          if(base64Audio) {
            // Initialize AudioContext for raw PCM playback as per Gemini API guidelines
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            }
            const ctx = audioContextRef.current;
            const audioBuffer = await decodeAudioData(
                base64ToUint8Array(base64Audio),
                ctx,
                24000,
                1
            );
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();
          }
      } catch (e) {
          console.error("TTS Playback Error:", e);
          alert("Erro no TTS");
      } finally {
          setTtsLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
        <div>
            <h2 className="text-2xl font-bold text-white">Estúdio Criativo</h2>
            <p className="text-slate-400 text-sm">Geração de imagens, análise de mídia e voz sintética.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 space-x-6">
            <button onClick={() => setActiveTab('image')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'image' ? 'border-pink-500 text-pink-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                Gerar Imagem
            </button>
            <button onClick={() => setActiveTab('analysis')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'analysis' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                Análise de Mídia
            </button>
            <button onClick={() => setActiveTab('tts')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tts' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                Texto para Fala
            </button>
        </div>

        <div className="flex-1 overflow-y-auto">
            {activeTab === 'image' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <div className="flex gap-2">
                         <select 
                            value={aspect} 
                            onChange={(e) => setAspect(e.target.value as AspectRatio)}
                            className="bg-slate-800 text-white rounded-lg px-3 border border-slate-700 outline-none"
                         >
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                            <option value="4:3">4:3</option>
                         </select>
                        <input 
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" 
                            placeholder="Descreva a imagem (Seja criativo)..."
                            value={imgPrompt}
                            onChange={(e) => setImgPrompt(e.target.value)}
                        />
                        <button onClick={handleGenImage} disabled={imgLoading} className="bg-pink-600 hover:bg-pink-500 text-white px-6 rounded-lg font-bold">
                            {imgLoading ? <Loader2 className="animate-spin"/> : <Sparkles />}
                        </button>
                    </div>
                    
                    <div className="bg-slate-800 rounded-2xl h-96 flex items-center justify-center border-2 border-dashed border-slate-700 overflow-hidden relative">
                        {generatedImg ? (
                            <img src={generatedImg} alt="Generated" className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-slate-500 flex flex-col items-center">
                                <ImageIcon size={48} className="mb-2 opacity-50"/>
                                <span>A imagem aparecerá aqui</span>
                            </div>
                        )}
                         {imgLoading && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center"><Loader2 className="animate-spin text-pink-500" size={48} /></div>}
                    </div>
                </div>
            )}

            {activeTab === 'analysis' && (
                <div className="space-y-6 max-w-2xl mx-auto">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
                        <input 
                            type="file" 
                            id="fileUpload" 
                            className="hidden" 
                            accept="video/*,audio/*,image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)} 
                        />
                        <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center gap-2 text-slate-300 hover:text-white transition-colors">
                            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-2">
                                <Video size={32} />
                            </div>
                            <span className="font-medium">{file ? file.name : "Clique para upload de Vídeo ou Áudio"}</span>
                            <span className="text-xs text-slate-500">Suporta Video, Audio, Imagem</span>
                        </label>
                    </div>

                    <div className="flex gap-2">
                         <input 
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" 
                            placeholder="O que deseja saber sobre este arquivo?"
                            value={analysisPrompt}
                            onChange={(e) => setAnalysisPrompt(e.target.value)}
                        />
                        <button 
                            onClick={handleAnalysis} 
                            disabled={!file || analysisLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold disabled:opacity-50"
                        >
                            {analysisLoading ? <Loader2 className="animate-spin"/> : "Analisar"}
                        </button>
                    </div>

                    {analysisResult && (
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 prose prose-invert">
                            <h4 className="text-blue-400 font-bold mb-2">Resultado da Análise</h4>
                            <p>{analysisResult}</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tts' && (
                 <div className="space-y-4 max-w-2xl mx-auto">
                    <textarea 
                        className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Digite o texto para o Gemini falar..."
                        value={ttsText}
                        onChange={(e) => setTtsText(e.target.value)}
                    />
                    <button 
                        onClick={handleTTS}
                        disabled={ttsLoading || !ttsText}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                         {ttsLoading ? <Loader2 className="animate-spin"/> : <><Play size={20} /> Falar</>}
                    </button>
                 </div>
            )}
        </div>
    </div>
  );
};

export default CreativeStudio;
