import { Division } from './types';

const divisionConfig: Record<Division, { folder: string }> = {
  [Division.Reception]: { folder: 'uketuke' },
  [Division.Exam]: { folder: 'sinsatu' },
  [Division.Procedure]: { folder: 'syoti' },
};

const folderToDivision = Object.entries(divisionConfig).reduce<Record<string, Division>>((map, [division, config]) => {
  map[config.folder] = division as Division;
  return map;
}, {});

const allAudioFiles = import.meta.glob('./audio/*/*.mp3', { as: 'url', eager: true }) as Record<string, string>;

const divisionAudioMap: Record<Division, Map<number, string>> = {
  [Division.Reception]: new Map(),
  [Division.Exam]: new Map(),
  [Division.Procedure]: new Map(),
  [Division.Staff]: new Map(),
};

Object.entries(allAudioFiles).forEach(([path, url]) => {
  const match = path.match(/\.\/audio\/([^/]+)\/.*?(\d+)\.mp3$/);
  if (!match) return;
  const folder = match[1];
  const number = Number(match[2]);
  const division = folderToDivision[folder];
  if (!division) return;
  divisionAudioMap[division].set(number, url);
});

const buildRange = (numbers: number[]): { min: number; max: number } | null => {
  if (numbers.length === 0) return null;
  const sorted = numbers.slice().sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
};

const divisionAudioRanges: Record<Division, { min: number; max: number } | null> = {
  [Division.Reception]: buildRange(Array.from(divisionAudioMap[Division.Reception].keys())),
  [Division.Exam]: buildRange(Array.from(divisionAudioMap[Division.Exam].keys())),
  [Division.Procedure]: buildRange(Array.from(divisionAudioMap[Division.Procedure].keys())),
  [Division.Staff]: null,
};

export const getDivisionAudioSource = (division: Division, number: number): string | null => {
  return divisionAudioMap[division].get(number) ?? null;
};

export const getDivisionAudioRange = (division: Division): { min: number; max: number } | null => {
  return divisionAudioRanges[division];
};

const staffCallAudioUrl = new URL('./audio/staff/staff-call.mp3', import.meta.url).href;

export const getStaffCallAudioSource = (): string => staffCallAudioUrl;
