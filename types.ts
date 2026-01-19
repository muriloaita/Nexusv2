
export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  LIVE_ASSISTANT = 'LIVE_ASSISTANT',
  TASKS = 'TASKS',
  ORGANIZER = 'ORGANIZER',
  KNOWLEDGE = 'KNOWLEDGE',
  IDEAS = 'IDEAS',
  REPORTS = 'REPORTS',
  FINANCE = 'FINANCE',
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'file';
  data: string; // Base64 content
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  observations?: string;
  niche: string;
  status: 'todo' | 'in-progress' | 'done';
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  subtasks?: Subtask[];
  attachments?: Attachment[];
  
  // Campos Financeiros Explícitos
  value?: number; // Valor numérico real (Positivo ou Negativo)
  financialType?: 'income' | 'expense';
  financialCategory?: string;
  
  rescheduleCount?: number; // Tracks procrastination
}

export interface VoiceNote {
  id: string;
  audioUrl: string;
  transcription: string;
  summary?: string;
  detectedNiche?: string;
  suggestedTasks?: string[];
  timestamp: Date;
  isTranscribing: boolean;
}

export interface Niche {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  groundingMetadata?: any;
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export type SearchPurpose = 'curiosity' | 'scientific' | 'professional';

export interface IdeaProject {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
}

export interface IdeaFolder {
    id: string;
    projectId: string;
    parentId: string | null;
    name: string;
    createdAt: Date;
}

export interface IdeaItem {
    id: string;
    projectId: string;
    folderId?: string | null;
    type: 'text' | 'image' | 'audio' | 'video' | 'pdf' | 'file' | 'template';
    content: string; // Base64 or Text
    name?: string; // Filename
    transcription?: string;
    summary?: string;
    detectedNiche?: string;
    timestamp: Date;
    hash?: string; // SHA-256 for Vault
}
