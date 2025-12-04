
// 患者呼び出しシステムの型定義
export enum Division {
  Reception = 'reception',
  Exam = 'exam',
  Procedure = 'procedure',
  Staff = 'staff',
}

export interface LogEntry {
  timestamp: string;
  number: string;
  division: Division;
  status: 'success' | 'error';
  message: string;
}

// Medivoice AIの型定義
export interface TranscriptItem {
  speaker: string;
  text: string;
}

export interface SoapContent {
  s: string; // Subjective
  o: string; // Objective
  a: string; // Assessment
  p: string; // Plan
}

export interface GeminiResponse {
  language: string;
  transcription: TranscriptItem[];
  soap: SoapContent;
  usedModel?: string; // Model used for generation (e.g., gemini-2.5-flash)
}

export interface PatientInfo {
  id: string;
  name: string;
}

export interface MedicalRecord {
  id: string;
  date: string; // ISO String
  patient: PatientInfo;
  data: GeminiResponse;
}

export enum AppMode {
  STANDARD = 'standard',
  TRANSLATE = 'translate',
  LIVE = 'live'
}

export enum ChatRole {
  DOCTOR = 'DOCTOR',   // 日本語
  PATIENT = 'PATIENT', // 外国語
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  originalText: string;
  translatedText?: string;
  timestamp: number;
  isFinal: boolean; // 文字起こし確定フラグ
}

export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
}
