export type Rec = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: number; // 0 none, 1 low, 2 med, 3 high
  due: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  rec: Rec | null;
  tags: string[];
  remind: number | null; // minutes before due
  parent: string | null;
  doneOn: string | null;
}

export type Days = Record<string, number>;
