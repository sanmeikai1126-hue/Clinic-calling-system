
export enum Division {
  Reception = 'reception',
  Exam = 'exam',
  Procedure = 'procedure',
}

export interface LogEntry {
  timestamp: string;
  number: string;
  division: Division;
  status: 'success' | 'error';
  message: string;
}
