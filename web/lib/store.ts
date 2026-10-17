import type { SupabaseClient } from '@supabase/supabase-js';
import type { Days, Task } from './types.ts';

/** Persistence boundary: the UI only talks to this, so local and cloud are interchangeable. */
export interface Store {
  load(): Promise<{ tasks: Task[]; days: Days }>;
  upsertTasks(tasks: Task[]): Promise<void>;
  deleteTasks(ids: string[]): Promise<void>;
  setDay(day: string, n: number): Promise<void>;
}

const safe = {
  get<T>(k: string, d: T): T {
    try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d; } catch { return d; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export const uid = () => crypto.randomUUID();

export class LocalStore implements Store {
  async load() { return { tasks: safe.get<Task[]>('tadaa_tasks', []), days: safe.get<Days>('tadaa_days', {}) }; }
  async upsertTasks(tasks: Task[]) {
    const all = safe.get<Task[]>('tadaa_tasks', []);
    const byId = new Map(all.map((t) => [t.id, t]));
    tasks.forEach((t) => byId.set(t.id, t));
    safe.set('tadaa_tasks', [...byId.values()]);
  }
  async deleteTasks(ids: string[]) {
    safe.set('tadaa_tasks', safe.get<Task[]>('tadaa_tasks', []).filter((t) => !ids.includes(t.id)));
  }
  async setDay(day: string, n: number) {
    const d = safe.get<Days>('tadaa_days', {});
    if (n > 0) d[day] = n; else delete d[day];
    safe.set('tadaa_days', d);
  }
}

interface Row {
  id: string; text: string; done: boolean; priority: number; due: string | null; time: string | null;
  rec: Task['rec']; tags: string[]; remind: number | null; parent: string | null; done_on: string | null;
}
const fromRow = (r: Row): Task => ({
  id: r.id, text: r.text, done: r.done, priority: r.priority, due: r.due, time: r.time, rec: r.rec,
  tags: r.tags ?? [], remind: r.remind, parent: r.parent, doneOn: r.done_on,
});
const toRow = (t: Task) => ({
  id: t.id, text: t.text, done: t.done, priority: t.priority, due: t.due, time: t.time, rec: t.rec,
  tags: t.tags, remind: t.remind, parent: t.parent, done_on: t.doneOn,
});

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient, private userId: string) {}

  async load() {
    const [t, d] = await Promise.all([
      this.db.from('tasks').select('*').order('created_at', { ascending: false }),
      this.db.from('days').select('day,n'),
    ]);
    if (t.error) throw t.error;
    if (d.error) throw d.error;
    return {
      tasks: (t.data as Row[]).map(fromRow),
      days: Object.fromEntries((d.data as { day: string; n: number }[]).map((r) => [r.day, r.n])),
    };
  }
  async upsertTasks(tasks: Task[]) {
    if (!tasks.length) return;
    // Parents must exist before children (FK), so insert roots first.
    const roots = tasks.filter((t) => !t.parent), kids = tasks.filter((t) => t.parent);
    for (const batch of [roots, kids]) {
      if (!batch.length) continue;
      const { error } = await this.db.from('tasks').upsert(batch.map((t) => ({ ...toRow(t), user_id: this.userId })));
      if (error) throw error;
    }
  }
  async deleteTasks(ids: string[]) {
    const { error } = await this.db.from('tasks').delete().in('id', ids);
    if (error) throw error;
  }
  async setDay(day: string, n: number) {
    const { error } = n > 0
      ? await this.db.from('days').upsert({ user_id: this.userId, day, n })
      : await this.db.from('days').delete().eq('day', day);
    if (error) throw error;
  }
}

/** One-time migration: push anything created in local mode up to the account. */
export async function migrateLocalToCloud(cloud: Store) {
  const local = new LocalStore();
  const { tasks, days } = await local.load();
  if (!tasks.length && !Object.keys(days).length) return false;
  await cloud.upsertTasks(tasks);
  for (const [d, n] of Object.entries(days)) await cloud.setDay(d, n);
  safe.set('tadaa_tasks', []); safe.set('tadaa_days', {});
  return true;
}
