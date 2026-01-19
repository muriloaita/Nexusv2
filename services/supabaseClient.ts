
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rrzcoxrmqcfcykcflinj.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable__eVc6T9cxMvQaLDlz6ru7w_T0W11V3u'; 

export interface DatabaseTask {
  id: string;
  title: string;
  description?: string;
  niche: string;
  status: 'todo' | 'in-progress' | 'done';
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  value?: number;
  financial_type?: 'income' | 'expense';
  financial_category?: string;
  is_habit?: boolean;
  created_at: string;
  attachments?: any[];
}

// Fixed missing DatabaseProject and DatabaseIdeaItem interfaces
export interface DatabaseProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface DatabaseIdeaItem {
  id: string;
  project_id: string;
  folder_id?: string | null;
  type: string;
  content: string;
  name?: string;
  transcription?: string;
  created_at: string;
  hash?: string;
}

// Inicialização com Fallback
let supabaseInstance: any;
try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.warn("Supabase Init Failed. App running in restricted local mode.");
}

export const supabase = supabaseInstance;

const localStore = {
    get: (key: string) => JSON.parse(localStorage.getItem(`nexus_v2_${key}`) || '[]'),
    set: (key: string, val: any) => localStorage.setItem(`nexus_v2_${key}`, JSON.stringify(val))
};

export const checkConnection = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { 
            method: 'GET', 
            headers: { 'apikey': SUPABASE_KEY },
            signal: AbortSignal.timeout(2500)
        });
        return res.ok;
    } catch (e) { return false; }
};

export const db = {
    tasks: {
        async fetch() {
            if (localStorage.getItem('nexus_guest_mode') === 'true') return localStore.get('tasks');
            try {
                const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                localStore.set('tasks', data);
                return data;
            } catch (e) { return localStore.get('tasks'); }
        },
        async insert(task: any) {
            const isGuest = localStorage.getItem('nexus_guest_mode') === 'true';
            const record = { ...task, id: Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() };
            if (isGuest) {
                const current = localStore.get('tasks');
                localStore.set('tasks', [record, ...current]);
                return [record];
            }
            const { data, error } = await supabase.from('tasks').insert(task).select();
            if (error) throw error;
            return data;
        },
        async update(id: string, updates: any) {
            if (localStorage.getItem('nexus_guest_mode') === 'true') {
                const current = localStore.get('tasks');
                localStore.set('tasks', current.map((t: any) => t.id === id ? { ...t, ...updates } : t));
                return;
            }
            await supabase.from('tasks').update(updates).eq('id', id);
        },
        async delete(id: string) {
            if (localStorage.getItem('nexus_guest_mode') === 'true') {
                localStore.set('tasks', localStore.get('tasks').filter((t: any) => t.id !== id));
                return;
            }
            await supabase.from('tasks').delete().eq('id', id);
        }
    },
    projects: {
        async fetch() { return localStorage.getItem('nexus_guest_mode') === 'true' ? localStore.get('projects') : (await supabase.from('projects').select('*')).data || []; },
        async insert(p: any) { return (await supabase.from('projects').insert(p).select()).data; },
        async delete(id: string) { await supabase.from('projects').delete().eq('id', id); }
    },
    ideaItems: {
        async fetch(projId: string) { return (await supabase.from('idea_items').select('*').eq('project_id', projId)).data || []; },
        async insert(i: any) { return (await supabase.from('idea_items').insert(i).select()).data; },
        async delete(id: string) { await supabase.from('idea_items').delete().eq('id', id); }
    },
    voiceNotes: {
        async fetch() { return (await supabase.from('voice_notes').select('*').limit(10)).data || []; },
        async insert(n: any) { return (await supabase.from('voice_notes').insert(n).select()).data; }
    },
    subtasks: {
        async fetch(taskId: string) { return (await supabase.from('subtasks').select('*').eq('task_id', taskId)).data || []; },
        async insert(s: any) { return (await supabase.from('subtasks').insert({ task_id: s.taskId, title: s.title, completed: false }).select()).data; },
        async update(id: string, u: any) { await supabase.from('subtasks').update(u).eq('id', id); },
        async delete(id: string) { await supabase.from('subtasks').delete().eq('id', id); }
    },
    folders: {
        async fetch(projId: string) { return (await supabase.from('folders').select('*').eq('project_id', projId)).data || []; },
        async insert(f: any) { return (await supabase.from('folders').insert(f).select()).data; }
    }
};

export const signInWithEmail = async (email: string, pass: string) => supabase.auth.signInWithPassword({ email, password: pass });
export const signUpWithEmail = async (email: string, pass: string) => supabase.auth.signUp({ email, password: pass });
export const signOut = async () => supabase.auth.signOut();
export const setGuestMode = (enabled: boolean) => localStorage.setItem('nexus_guest_mode', enabled ? 'true' : 'false');
