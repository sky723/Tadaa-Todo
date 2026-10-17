'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LocalStore, SupabaseStore, migrateLocalToCloud, uid, type Store } from '@/lib/store';
import { addDays, iso, nextDue, parseQuick } from '@/lib/parse';
import { chime, fanfare, setSoundEnabled, softTick, tick } from '@/lib/sound';
import { confetti } from '@/lib/confetti';
import type { Days, Task } from '@/lib/types';

type Screen = 'landing' | 'auth' | 'app';
type Tab = 'today' | 'upcoming' | 'all' | 'done';
const TABS: [Tab, string][] = [['today', '☀️ Today'], ['upcoming', '🗓 Upcoming'], ['all', 'All'], ['done', '✅ Done']];

const pref = {
  get<T>(k: string, d: T): T { try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const today = () => iso(new Date());

function streakOf(days: Days): number {
  let n = 0, d = today();
  if (!days[d]) d = addDays(d, -1);
  while (days[d]) { n++; d = addDays(d, -1); }
  return n;
}

function dueLabel(t: Task): string {
  if (!t.due) return '';
  const td = today();
  const l = t.due === td ? 'Today' : t.due === addDays(td, 1) ? 'Tomorrow'
    : new Date(t.due + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return l + (t.time ? ' ' + t.time : '');
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [store, setStore] = useState<Store | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [days, setDays] = useState<Days>({});
  const [tab, setTab] = useState<Tab>('today');
  const [sound, setSound] = useState(true);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState('');
  const [banner, setBanner] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [focus, setFocus] = useState<{ name: string; left: number; running: boolean } | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const fired = useRef(new Set<string>());

  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2400); }, []);
  const fail = useCallback((e: unknown) => { setErr(e instanceof Error ? e.message : String(e)); }, []);

  /* boot: prefs, then session */
  useEffect(() => {
    const s = pref.get('tadaa_sound', true), d = pref.get('tadaa_dark', false);
    setSound(s); setSoundEnabled(s); setDark(d);
    setName(pref.get('tadaa_name', ''));
    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => setSession(data.session));
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s2) => setSession(s2));
      return () => sub.subscription.unsubscribe();
    }
    if (pref.get('tadaa_name', '')) { setStore(new LocalStore()); setScreen('app'); }
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : ''; }, [dark]);

  /* when a Supabase session appears, switch to the cloud store */
  useEffect(() => {
    if (!supabase || !session) return;
    const cloud = new SupabaseStore(supabase, session.user.id);
    setStore(cloud);
    setName((n) => n || session.user.email?.split('@')[0] || 'friend');
    setScreen('app');
    void migrateLocalToCloud(cloud).then((m) => m && say('☁️ Local tasks synced to your account')).catch(fail);
  }, [session, say, fail]);

  const reload = useCallback(async (s: Store) => {
    try { const r = await s.load(); setTasks(r.tasks); setDays(r.days); } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { if (store) void reload(store); }, [store, reload]);

  /* realtime: another device changes a task → refresh */
  useEffect(() => {
    if (!supabase || !session || !store) return;
    const ch = supabase.channel('tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => void reload(store)).subscribe();
    return () => { void supabase!.removeChannel(ch); };
  }, [session, store, reload]);

  /* helpers that apply a change locally (optimistic) and persist it */
  const persist = useCallback((changed: Task[], removed: string[] = [], day?: [string, number]) => {
    setTasks((cur) => {
      const ids = new Set(cur.map((t) => t.id));
      const fresh = changed.filter((t) => !ids.has(t.id)).reverse();
      const upd = new Map(changed.map((t) => [t.id, t]));
      return [...fresh, ...cur.filter((t) => !removed.includes(t.id)).map((t) => upd.get(t.id) ?? t)];
    });
    if (day) setDays((d) => { const n = { ...d }; if (day[1] > 0) n[day[0]] = day[1]; else delete n[day[0]]; return n; });
    const jobs: Promise<void>[] = [];
    if (changed.length) jobs.push(store!.upsertTasks(changed));
    if (removed.length) jobs.push(store!.deleteTasks(removed));
    if (day) jobs.push(store!.setDay(day[0], day[1]));
    Promise.all(jobs).catch((e) => { fail(e); void reload(store!); });
  }, [store, fail, reload]);

  const burst = (el: Element | null, n: number) => {
    if (!cv.current) return;
    const r = el?.getBoundingClientRect();
    confetti(cv.current, r ? r.left + 14 : innerWidth / 2, r ? r.top + 14 : innerHeight / 2, n);
  };
  const flashBanner = () => setBanner((b) => b + 1);

  /* derived */
  const roots = useMemo(() => tasks.filter((t) => !t.parent), [tasks]);
  const kids = useCallback((id: string) => tasks.filter((t) => t.parent === id), [tasks]);
  const td = today();
  const open = roots.filter((t) => !t.done);
  const over = open.filter((t) => t.due && t.due < td);
  const tod = open.filter((t) => t.due === td);
  const up = open.filter((t) => t.due && t.due > td && t.due <= addDays(td, 7));
  const doneToday = roots.filter((t) => t.done && t.doneOn === td);
  const totalToday = over.length + tod.length + doneToday.length;
  const streak = streakOf(days);
  const sortT = (a: Task[]) => [...a].sort((x, y) => y.priority - x.priority || (x.time ?? '99').localeCompare(y.time ?? '99'));

  const briefing = (() => {
    const h = new Date().getHours(), g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    let s = `${g}, ${name || 'friend'}! `;
    if (!over.length && !tod.length) s += 'Nothing is due today — a clear runway. ';
    else {
      s += `${tod.length} task${tod.length === 1 ? '' : 's'} today` + (over.length ? ` and ${over.length} overdue` : '') + '. ';
      const first = sortT([...over, ...tod])[0];
      s += `Start with “${first.text}”. `;
    }
    if (up.length) s += `${up.length} more this week. `;
    if (streak) s += `🔥 ${streak}-day streak — keep it alive!`;
    return s;
  })();

  /* actions */
  const add = () => {
    const o = parseQuick(input);
    if (!o.text) return;
    const t: Task = { id: uid(), text: o.text, done: false, priority: o.priority, due: o.due, time: o.time, rec: o.rec, tags: o.tags, remind: o.remind, parent: null, doneOn: null };
    persist([t]); setInput(''); softTick();
  };

  const complete = (t: Task, el: Element | null) => {
    const changed: Task[] = [{ ...t, done: true, doneOn: today() }];
    kids(t.id).filter((c) => !c.done).forEach((c) => changed.push({ ...c, done: true, doneOn: today() }));
    if (t.rec && !t.parent) {
      let nd = nextDue(t.due ?? today(), t.rec);
      while (t.due && nd <= today()) nd = nextDue(nd, t.rec);
      const nid = uid();
      changed.push({ ...t, id: nid, done: false, doneOn: null, due: nd });
      kids(t.id).forEach((c) => changed.push({ ...c, id: uid(), parent: nid, done: false, doneOn: null }));
      say('🔁 Next one scheduled for ' + nd);
    }
    const n = (days[today()] ?? 0) + 1;
    persist(changed, [], [today(), n]);
    tick(); burst(el, 45);
    const remaining = roots.filter((x) => x.id !== t.id && !x.done && x.due && x.due <= today()).length;
    if (!remaining && tab === 'today') setTimeout(() => { fanfare(); flashBanner(); burst(null, 180); say('🎉 All done for today!'); }, 250);
    else if (n === 1 && streakOf({ ...days, [today()]: 1 }) > 1) say(`🔥 ${streakOf({ ...days, [today()]: 1 })}-day streak!`);
  };

  const uncomplete = (t: Task) => {
    persist([{ ...t, done: false, doneOn: null }], [], [today(), Math.max(0, (days[today()] ?? 0) - 1)]);
    softTick();
  };

  const toggleSub = (c: Task, el: Element | null) => {
    const next = { ...c, done: !c.done, doneOn: c.done ? null : today() };
    persist([next]);
    next.done ? tick(0.6) : softTick();
    const p = tasks.find((x) => x.id === c.parent);
    if (p && next.done && !p.done && kids(p.id).every((k) => k.id === c.id || k.done)) complete(p, el);
  };

  const addSub = (p: Task, text: string) => {
    persist([{ id: uid(), text, done: false, priority: 0, due: null, time: null, rec: null, tags: [], remind: null, parent: p.id, doneOn: null }]);
    softTick();
  };

  const remove = (t: Task) => persist([], [t.id, ...kids(t.id).map((k) => k.id)]);

  /* reminders */
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      for (const t of tasks) {
        if (t.done || t.remind == null || !t.due || !t.time) continue;
        const due = new Date(`${t.due}T${t.time}`), fire = new Date(+due - t.remind * 60000), k = t.id + t.due + t.time;
        if (now >= fire && now <= new Date(+due + 3600000) && !fired.current.has(k)) {
          fired.current.add(k); say('🔔 ' + t.text); chime();
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Tadaa', { body: `${t.text} · ${t.time}` });
        }
      }
    }, 20000);
    return () => clearInterval(id);
  }, [tasks, say]);

  /* focus timer */
  useEffect(() => {
    if (!focus?.running) return;
    const id = setInterval(() => setFocus((f) => {
      if (!f) return f;
      if (f.left <= 1) { fanfare(); burst(null, 200); return { ...f, left: 0, running: false }; }
      return { ...f, left: f.left - 1 };
    }), 1000);
    return () => clearInterval(id);
  }, [focus?.running]);
  useEffect(() => { document.title = focus?.running ? `${fmt(focus.left)} · Tadaa` : 'Tadaa — celebrate every finished task'; }, [focus]);

  /* keyboard: "/" focuses quick add */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement?.tagName ?? '';
      if (e.key === '/' && screen === 'app' && !/INPUT|TEXTAREA/.test(el)) { e.preventDefault(); document.getElementById('quick')?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen]);

  /* landing / auth */
  const getTadaa = () => {
    fanfare(); flashBanner(); burst(null, 160);
    setTimeout(() => setScreen(store ? 'app' : 'auth'), 700);
  };
  const localSignup = (e: React.FormEvent) => {
    e.preventDefault(); pref.set('tadaa_name', name.trim()); setStore(new LocalStore()); softTick(); setScreen('app');
  };
  const magicLink = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message); else setSent(true);
  };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    pref.set('tadaa_name', ''); setStore(null); setTasks([]); setDays({}); setSession(null); setScreen('landing');
  };

  const list = (() => {
    if (tab === 'upcoming') return open.filter((t) => t.due && t.due > td).sort((a, b) => a.due!.localeCompare(b.due!));
    if (tab === 'done') return roots.filter((t) => t.done);
    return open;
  })();

  const row = (t: Task) => {
    const ch = kids(t.id), late = !t.done && t.due && t.due < td, isOpen = openIds.has(t.id);
    return (
      <div key={t.id} className={`task p${t.priority} ${t.done ? 'done' : ''}`}>
        <button className="box" aria-label="toggle" onClick={(e) => (t.done ? uncomplete(t) : complete(t, e.currentTarget))}>✓</button>
        <div className="body">
          <span className="t">{t.text}</span>
          <div className="chips">
            {t.due && <span className={late ? 'late' : ''}>📅 {dueLabel(t)}</span>}
            {t.rec && <span>🔁 {t.rec}</span>}
            {t.remind != null && <span>🔔</span>}
            {ch.length > 0 && <span>☑ {ch.filter((c) => c.done).length}/{ch.length}</span>}
            {t.tags.map((g) => <span key={g}>#{g}</span>)}
          </div>
          {(ch.length > 0 || isOpen) && !t.done && (
            <div className="sub">
              {ch.map((c) => (
                <label key={c.id}>
                  <input type="checkbox" checked={c.done} onChange={(e) => toggleSub(c, e.currentTarget)} />
                  <span style={c.done ? { textDecoration: 'line-through', color: 'var(--mut)' } : undefined}>{c.text}</span>
                </label>
              ))}
              <input type="text" placeholder="+ subtask, Enter" onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) { addSub(t, e.currentTarget.value.trim()); e.currentTarget.value = ''; }
              }} />
            </div>
          )}
        </div>
        <div className="act">
          <button title="Subtasks" onClick={() => setOpenIds((s) => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>☰</button>
          <button title="Focus" onClick={() => setFocus({ name: t.text, left: 1500, running: false })}>⏱</button>
          <button title="Delete" onClick={() => remove(t)}>✕</button>
        </div>
      </div>
    );
  };
  const group = (h: string, a: Task[], cls = '') => a.length ? (<><div className={`grp ${cls}`}>{h} · {a.length}</div>{a.map(row)}</>) : null;

  return (
    <>
      <button id="snd" onClick={() => { const v = !sound; setSound(v); setSoundEnabled(v); pref.set('tadaa_sound', v); if (v) tick(0.5); }}>{sound ? '🔊 Sound on' : '🔇 Sound off'}</button>
      <button id="thm" onClick={() => { setDark(!dark); pref.set('tadaa_dark', !dark); }}>{dark ? '☀️ Light' : '🌙 Dark'}</button>
      <canvas ref={cv} className="fx" />
      {banner > 0 && <div key={banner} id="tadaa" className="show">Tadaa!</div>}
      <div id="toast" className={toast ? 'show' : ''}>{toast}</div>

      {focus && (
        <div id="focus" className="on"><div>
          <div style={{ opacity: 0.7 }}>{focus.name}</div>
          <div id="ftime">{fmt(focus.left)}</div>
          <div>
            <button onClick={() => setFocus({ ...focus, running: !focus.running })}>{focus.running ? 'Pause' : focus.left === 1500 ? 'Start' : 'Resume'}</button>
            <button onClick={() => setFocus({ ...focus, left: 300, running: false })}>Break 5</button>
            <button onClick={() => setFocus({ ...focus, left: 1500, running: false })}>Focus 25</button>
            <button onClick={() => setFocus(null)}>Close</button>
          </div>
        </div></div>
      )}

      {screen === 'landing' && (
        <section className="screen on">
          <div className="hero">
            <div className="stamp">Price of a coffee<b>$4.50</b>one time</div>
            <div className="icon">✓</div>
            <h1>Finish a task.<br /><em>Feel the tadaa.</em></h1>
            <p className="lead">The to-do list that celebrates every checkmark — with a crisp, satisfying tick and a burst of confetti.</p>
            <button className="cta" onClick={getTadaa}>Get Tadaa · $4.50</button>
            <p style={{ color: 'var(--mut)', fontSize: 14 }}>One coffee. A lifetime of celebrated tasks.</p>
          </div>
          <div className="eq">
            <div className="row"><div className="i cup">☕</div>=<div className="i td">✓</div></div>
            <div className="vs"><div>Your coffee<b>$5 every day</b></div><div>Tadaa<b>$4.50 once. forever.</b></div></div>
            <div className="money">Skip one coffee. Celebrate every finished task. Forever.</div>
          </div>
        </section>
      )}

      {screen === 'auth' && (
        <section className="screen on">
          {supabase ? (
            <form className="auth" onSubmit={magicLink}>
              <div className="icon" style={{ width: 72, height: 72, fontSize: 40 }}>✓</div>
              <h2 style={{ fontSize: 28, margin: '0 0 6px' }}>Sign in</h2>
              <p style={{ color: 'var(--mut)', margin: '0 0 14px' }}>We’ll email you a magic link. Your tasks sync everywhere.</p>
              {sent ? <p>📬 Check <b>{email}</b> for your link.</p> : (<>
                <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="cta">Send magic link</button></>)}
              {err && <div className="err">{err}</div>}
            </form>
          ) : (
            <form className="auth" onSubmit={localSignup}>
              <div className="icon" style={{ width: 72, height: 72, fontSize: 40 }}>✓</div>
              <h2 style={{ fontSize: 28, margin: '0 0 6px' }}>What should we call you?</h2>
              <p style={{ color: 'var(--mut)', margin: '0 0 14px' }}>Local mode: tasks stay in this browser. Add Supabase keys to sync.</p>
              <input placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
              <button className="cta">Start celebrating</button>
            </form>
          )}
        </section>
      )}

      {screen === 'app' && (
        <section className="screen on"><div className="app">
          <div className="top"><h2>Hi {name || 'there'} 👋</h2>
            <span className={`meta ${totalToday > 0 && doneToday.length === totalToday ? 'gold' : ''}`}>{totalToday ? `${doneToday.length} of ${totalToday} celebrated today` : 'Nothing due today'}</span></div>
          <div className="bar"><i style={{ width: totalToday ? `${(doneToday.length / totalToday) * 100}%` : 0 }} /></div>
          <div className="stats">
            <div className="stat"><b>{streak}</b>🔥 day streak</div>
            <div className="stat"><b>{days[td] ?? 0}</b>done today</div>
            <div className="stat"><b>{Object.values(days).reduce((a, b) => a + b, 0)}</b>all-time</div>
          </div>
          <div className="brief">✨ {briefing}</div>
          <div className="tabs">{TABS.map(([k, n]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>)}</div>
          <form className="add" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <input id="quick" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Call mom tomorrow 5pm !high #family every week" autoComplete="off" />
            <button>Add</button>
          </form>
          <div className="hint"><b>!high</b> priority · <b>#tag</b> · <b>every week</b> · <b>remind me 15 min before</b> · <b>/</b> to focus</div>
          {err && <div className="err">⚠️ {err}</div>}
          <div>
            {tab === 'today' ? (
              <>
                {group('Overdue', sortT(over), 'bad')}
                {group('Today', sortT(tod))}
                {group('No date', sortT(open.filter((t) => !t.due)))}
                {group('Coming up', [...up].sort((a, b) => a.due!.localeCompare(b.due!)))}
                {group('Done today', doneToday)}
                {!over.length && !tod.length && !open.some((t) => !t.due) && !up.length && !doneToday.length && <div className="empty">Add your first task and finish it. You’ll see. 🎉</div>}
              </>
            ) : list.length ? list.map(row) : <div className="empty">Nothing here 🎉</div>}
          </div>
          <div className="foot">
            <button onClick={async () => { if ('Notification' in window) await Notification.requestPermission(); say('Reminders: ' + (typeof Notification !== 'undefined' ? Notification.permission : 'n/a')); }}>🔔 Enable reminders</button>
            <button onClick={() => setFocus({ name: 'Focus session', left: 1500, running: false })}>⏱ Focus timer</button>
            <button onClick={signOut}>Sign out</button>
          </div>
          <div className="who">{session ? `☁️ Synced as ${session.user.email}` : '💾 Local mode — tasks live in this browser'}</div>
        </div></section>
      )}
    </>
  );
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
