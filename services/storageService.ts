import { MedicalRecord } from '../types';

const STORAGE_KEY = 'medivoice_records_v1';

export const saveRecord = (record: MedicalRecord): void => {
  const existingJson = localStorage.getItem(STORAGE_KEY);
  const records: MedicalRecord[] = existingJson ? JSON.parse(existingJson) : [];
  records.unshift(record); // Add to top
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const getRecords = (): MedicalRecord[] => {
  const existingJson = localStorage.getItem(STORAGE_KEY);
  return existingJson ? JSON.parse(existingJson) : [];
};

export const deleteRecord = (id: string): void => {
  const records = getRecords();
  const filtered = records.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const searchRecords = (query: string): MedicalRecord[] => {
  const records = getRecords();
  const lowerQ = query.toLowerCase();
  return records.filter(r => 
    r.patient.name.toLowerCase().includes(lowerQ) || 
    r.patient.id.toLowerCase().includes(lowerQ) ||
    r.data.soap.s.toLowerCase().includes(lowerQ)
  );
};