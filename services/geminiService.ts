
import { GoogleGenAI, Type, Modality, FunctionDeclaration, Tool } from "@google/genai";
import { AspectRatio, SearchPurpose, IdeaItem, Task } from "../types";
import { db } from './supabaseClient';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CONTEXTO GLOBAL ---
export const fetchNexusContext = async () => {
    try {
        const tasks = await db.tasks.fetch();
        const finance = tasks.filter((t: any) => t.niche === 'Finanças' || (t.value && t.value !== 0));
        const balance = finance.reduce((acc: number, t: any) => t.status === 'done' ? acc + (t.value || 0) : acc, 0);
        const pending = tasks.filter((t: any) => t.status !== 'done');
        return `[SITUAÇÃO ATUAL] Saldo: R$ ${balance.toFixed(2)}. Pendências: ${pending.length}.`;
    } catch (e) { return "Contexto indisponível."; }
};

// --- FERRAMENTAS UNIFICADAS (FUNCTION CALLING) ---
export const nexusTools: Tool[] = [{
    functionDeclarations: [
        {
            name: 'create_task',
            description: 'Adiciona tarefa ou lembrete.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    niche: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                    dueDate: { type: Type.STRING, description: 'YYYY-MM-DD' }
                },
                required: ['title']
            }
        },
        {
            name: 'add_finance',
            description: 'Registra ganhos (+) ou gastos (-).',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    value: { type: Type.NUMBER },
                    category: { type: Type.STRING }
                },
                required: ['title', 'value']
            }
        }
    ]
}];

export const executeNexusAction = async (call: any) => {
    const args = call.args as any;
    if (call.name === 'create_task') {
        await db.tasks.insert({ 
            title: args.title, 
            niche: args.niche || 'Geral', 
            priority: args.priority || 'medium', 
            due_date: args.dueDate || new Date().toISOString().split('T')[0],
            status: 'todo' 
        });
        return `Tarefa "${args.title}" registrada no board.`;
    }
    if (call.name === 'add_finance') {
        await db.tasks.insert({ 
            title: args.title, 
            value: args.value, 
            niche: 'Finanças', 
            financial_type: args.value < 0 ? 'expense' : 'income', 
            financial_category: args.category || 'Geral',
            status: 'done',
            due_date: new Date().toISOString().split('T')[0]
        });
        return `Lançamento de R$ ${args.value} efetuado com sucesso.`;
    }
    return "Ação desconhecida.";
};

// --- SERVIÇOS DE IA ---

export const processJarvisInput = async (input: string, history: string = "") => {
    const context = await fetchNexusContext();
    const system = `Você é o NEXUS. Analise o comando e use as ferramentas para organizar a vida do usuário. ${context}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${history}\nUSER: ${input}`,
        config: { tools: nexusTools, systemInstruction: system }
    });

    if (response.functionCalls) {
        let confirmation = "";
        for (const call of response.functionCalls) {
            confirmation += await executeNexusAction(call) + " ";
        }
        window.dispatchEvent(new CustomEvent('nexus-data-updated'));
        return confirmation || "Comando processado.";
    }
    return response.text || "Entendido.";
};

export const transcribeAudio = async (b64: string, mime: string) => {
    const res = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts: [{ inlineData: { data: b64, mimeType: mime } }, { text: "Transcreva este áudio com precisão." }] }
    });
    return res.text || "";
};

export const processAudioInput = async (b64: string, mime: string) => {
    const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { data: b64, mimeType: mime } }, { text: "Transcreva este áudio e forneça um resumo e nicho em JSON." }] },
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    transcription: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    niche: { type: Type.STRING }
                },
                required: ["transcription", "summary", "niche"]
            }
        }
    });
    return JSON.parse(res.text || "{}");
};

export const generateImage = async (p: string, ar: AspectRatio) => {
    const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const res = await freshAi.models.generateContent({ 
        model: 'gemini-3-pro-image-preview', 
        contents: { parts: [{ text: p }] }, 
        config: { imageConfig: { aspectRatio: ar, imageSize: "1K" }}
    });
    const imgPart = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return imgPart?.inlineData?.data ? `data:image/png;base64,${imgPart.inlineData.data}` : null;
};

export const searchWeb = async (q: string, deep: boolean) => {
    const res = await ai.models.generateContent({ 
        model: deep ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview', 
        contents: q, 
        config: { tools: [{ googleSearch: {} }] }
    });
    return { text: res.text || "", grounding: res.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};

export const searchMaps = async (q: string, lat: number, lng: number) => {
    const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: q,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
        },
    });
    return { text: res.text || "", grounding: res.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};

export const generateSpeech = async (t: string) => {
    const res = await ai.models.generateContent({ 
        model: "gemini-2.5-flash-preview-tts", 
        contents: [{ parts: [{ text: t }] }], 
        config: { 
            responseModalities: [Modality.AUDIO], 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' }}}
        }
    });
    return res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const analyzeVideo = async (b64: string, mime: string, p: string) => {
    const res = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: { parts: [{ inlineData: { data: b64, mimeType: mime } }, { text: p }] }
    });
    return res.text || "";
};

export const planTasks = async (p: string) => {
    const res = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview", 
        contents: `Gere uma lista de tarefas em JSON para este pedido: ${p}`, 
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || "[]");
};

// Fixed missing exports: consultProjectAssistant, structureProjectIdea, generateExecutiveReport, summarizeReport
export const consultProjectAssistant = async (projectName: string, items: IdeaItem[], query: string, history: string) => {
    const context = items.map(i => `[${i.type}] ${i.name || 'Nota'}: ${i.content.slice(0, 500)}`).join('\n');
    const system = `Você é o Assistente do Projeto "${projectName}". Use o contexto abaixo para responder:\n${context}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${history}\nUSER: ${query}`,
        config: { systemInstruction: system }
    });
    return response.text;
};

export const structureProjectIdea = async (blueprint: any, query: string) => {
    const system = `Você é o Arquiteto Nexus. Sua tarefa é transformar ideias em blueprints estruturados (JSON). 
    Blueprint atual: ${JSON.stringify(blueprint || {})}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: { 
            systemInstruction: system,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    blueprint: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            overview: { type: Type.STRING },
                            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                            phases: { 
                                type: Type.ARRAY, 
                                items: { 
                                    type: Type.OBJECT, 
                                    properties: { 
                                        name: { type: Type.STRING }, 
                                        tasks: { type: Type.ARRAY, items: { type: Type.STRING } } 
                                    } 
                                } 
                            },
                            resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                            risks: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    },
                    conversationalResponse: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
};

export const generateExecutiveReport = async (tasks: Task[]) => {
    const taskContext = tasks.map(t => `- ${t.title} (${t.status}, Prio: ${t.priority}, Prazo: ${t.dueDate})`).join('\n');
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Gere um relatório executivo detalhado em Markdown para estas tarefas:\n${taskContext}`,
        config: { systemInstruction: "Você é um consultor de produtividade de elite." }
    });
    return response.text || "";
};

export const summarizeReport = async (report: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Resuma os pontos de ação deste relatório em 5 tópicos diretos:\n${report}`,
    });
    return response.text || "";
};

export const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
