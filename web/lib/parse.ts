import type { Rec } from './types.ts';

export interface Parsed {
  text: string;
  priority: number;
  due: string | null;
  time: string | null;
  rec: Rec | null;
  tags: string[];
  remind: number | null;
}

const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function addDays(s: string, n: number): string {
  const d = new Date(s + 'T00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
}

function nextWeekday(i: number, now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() + ((i - d.getDay() + 7) % 7));
  return iso(d);
}

/** "Call mom tomorrow 5pm !high #family every week remind me 15 min before" */
export function parseQuick(input: string, now: Date = new Date()): Parsed {
  let t = ` ${input.trim()} `;
  const o: Parsed = { text: '', priority: 0, due: null, time: null, rec: null, tags: [], remind: null };
  const take = (re: RegExp) => {
    const m = t.match(re);
    if (m) t = t.replace(re, ' ');
    return m;
  };

  if (take(/\s!(high|h|3)\b/i) || take(/\s!!!\s/)) o.priority = 3;
  else if (take(/\s!(med|medium|m|2)\b/i) || take(/\s!!\s/)) o.priority = 2;
  else if (take(/\s!(low|l|1)\b/i) || take(/\s!\s/)) o.priority = 1;

  t = t.replace(/\s#([\w-]+)/g, (_, g: string) => {
    o.tags.push(g);
    return ' ';
  });

  let m = take(/\bremind(?: me)? (\d+)\s*(min|mins|minutes|hours?|h|hr)s?\s*before\b/i);
  if (m) o.remind = +m[1] * (/^h/i.test(m[2]) ? 60 : 1);

  m = take(/\bevery\s+(day|weekdays?|week|month|year|daily|weekly|monthly|yearly)\b/i);
  if (m) {
    const map: Record<string, Rec> = {
      day: 'daily', daily: 'daily', weekday: 'weekdays', weekdays: 'weekdays',
      week: 'weekly', weekly: 'weekly', month: 'monthly', monthly: 'monthly', year: 'yearly', yearly: 'yearly',
    };
    o.rec = map[m[1].toLowerCase()];
  } else if ((m = take(new RegExp(`\\bevery\\s+(${WD.join('|')})\\b`, 'i')))) {
    o.rec = 'weekly';
    o.due = nextWeekday(WD.indexOf(m[1].toLowerCase()), now);
  }

  if ((m = take(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i))) {
    let h = +m[1];
    const pm = /pm/i.test(m[3]);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    o.time = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  } else if ((m = take(/\bat\s+(\d{1,2}):(\d{2})\b/i))) {
    o.time = `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  if (!o.due) {
    const td = iso(now);
    if (take(/\b(today|tonight)\b/i)) o.due = td;
    else if (take(/\b(tomorrow|tmrw)\b/i)) o.due = addDays(td, 1);
    else if (take(/\bnext week\b/i)) o.due = addDays(td, 7);
    else if ((m = take(/\bin (\d+) (day|days|week|weeks)\b/i))) o.due = addDays(td, +m[1] * (/^w/i.test(m[2]) ? 7 : 1));
    else if ((m = take(new RegExp(`\\b(?:on |next |this )?(${WD.join('|')})\\b`, 'i'))))
      o.due = nextWeekday(WD.indexOf(m[1].toLowerCase()), now);
    else if ((m = take(/\b(\d{4}-\d{2}-\d{2})\b/))) o.due = m[1];
  }
  if ((o.time || o.rec) && !o.due) o.due = iso(now);

  o.text = t.replace(/\s+/g, ' ').trim().replace(/^[,.\- ]+|[,.\- ]+$/g, '');
  return o;
}

export function nextDue(s: string, r: Rec): string {
  const d = new Date(s + 'T00:00');
  if (r === 'daily') d.setDate(d.getDate() + 1);
  else if (r === 'weekdays') do d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay()));
  else if (r === 'weekly') d.setDate(d.getDate() + 7);
  else if (r === 'monthly') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else d.setFullYear(d.getFullYear() + 1);
  return iso(d);
}
