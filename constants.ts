
import { Division } from './types';

export const DIVISION_LABELS: Record<Division, string> = {
  [Division.Reception]: '受付へ',
  [Division.Exam]: '診察室へ',
  [Division.Procedure]: '処置室へ',
  [Division.Staff]: 'スタッフ呼び出し',
};

export const MAX_NUMBER = 200;
export const MAX_HISTORY = 10;
export const MAX_LOGS = 100;
