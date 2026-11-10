import React, { useEffect, useState } from 'react';
import { Eye, Brain, ShieldCheck, Users, Crown, Radar, RotateCw, Plus, Layers } from 'lucide-react';

type RoleKey = 'EYE' | 'BRAIN' | 'CORE' | 'RÜCK';
type UState = 'Ja' | 'Nein' | 'Ü';
type LogRecord = { id: string; value: { kind: string; label: string; at: string }; created_at: string };

const ROLES: Record<RoleKey, { title: string; sat: string; color: string; x: number; y: number; icon: React.ReactNode }> = {
  EYE: { title: 'EYE · Sehen', sat: 'Ich sehe, was wirklich da ist.', color: '#2E7CF6', x: 52, y: 180, icon: <Eye size={20} /> },
  BRAIN: { title: 'BRAIN · Halten + Suchen', sat: 'Ich halte fest und suche weiter.', color: '#7C4DFF', x: 308, y: 180, icon: <Brain size={20} /> },
  'RÜCK': { title: 'RÜCK · Zeugnis / Zeugen', sat: 'Ich bezeuge, was gehalten hat.', color: '#00B6A6', x: 180, y: 62, icon: <Users size={20} /> },
  CORE: { title: 'CORE · Prüfen', sat: 'Ich prüfe, ob es wirklich hält.', color: '#FF6B2C', x: 180, y: 298, icon: <ShieldCheck size={20} /> },
};
const ORDER: RoleKey[] = ['EYE', 'BRAIN', 'CORE', 'RÜCK'];
const U_COLOR: Record<UState, string> = { Ja: '#22B45A', Nein: '#EF3E4A', 'Ü': '#FFC61A' };

async function callApi(action: string, args: Record<string, unknown>) {
  const res = await fetch('actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, args }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `API-Fehler: ${res.status}`);
  return json.data;
}

export default function App() {
  const [role, setRole] = useState<RoleKey>('EYE');
  const [u, setU] = useState<UState>('Ü');
  const [radar, setRadar] = useState(false);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Bereit. Alles, was du loggst, bleibt gespeichert.');
  const [logError, setLogError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await callApi('records.list', { collection: 'solid_log' });
      setLogs((data.records || []).slice().reverse());
      setLogError(null);
    } catch { setLogError('Log gerade offline — die Grafik läuft trotzdem.'); }
  };
  useEffect(() => { load(); }, []);

  const addLog = async (kind: string, label: string) => {
    setBusy(true); setStatus('Speichere …');
    const key = `${Date.now()}-${kind}-${crypto.randomUUID()}`;
    try {
      await callApi('records.create', { collection: 'solid_log', value: { kind, label, at: new Date().toISOString() }, idempotency_key: key });
      await load();
      setStatus(`Gespeichert: ${label}`);
    } catch (e) { setStatus(`Nicht gespeichert: ${e instanceof Error ? e.message : 'Fehler'}`); }
    setBusy(false);
  };
  const roller = () => {
    const next = ORDER[(ORDER.indexOf(role) + 1) % ORDER.length];
    setRole(next);
  };
  const pickU = (v: UState) => { setU(v); addLog('Ü', `Ü = ${v}`); };

  return (
    <div data-safe-area-inset-root style={{ boxSizing: 'border-box', paddingTop: 'var(--safe-area-inset-top)', minHeight: '100vh', background: 'var(--bg)' }} className="overflow-x-clip">
      <header data-safe-area-sticky-top style={{ top: 'var(--safe-area-inset-top)' }} className="sticky z-20 border-b-2 border-[var(--line)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFC61A] text-xl font-bold border-2 border-[var(--line)]">⟁</span><div><p className="text-lg font-bold leading-none">SOLID VISUAL</p><p className="text-xs text-[var(--muted)]">SEED ⟁ · nicht trocken, sondern sichtbar</p></div></div>
          <nav className="flex flex-wrap gap-1 text-xs font-bold"><a href="#bild" className="rounded-full border-2 border-[var(--line)] bg-white px-3 py-1.5 text-black">BILD</a><a href="#stapel" className="rounded-full border-2 border-[var(--line)] bg-[#BFF3D3] px-3 py-1.5 text-black">STAPEL</a><a href="#ue" className="rounded-full border-2 border-[var(--line)] bg-[#FFE89A] px-3 py-1.5 text-black">Ü</a><a href="#log" className="rounded-full border-2 border-[var(--line)] bg-[#D8CCFF] px-3 py-1.5 text-black">LOG</a></nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-10 sm:px-6">
        {/* HERO / 360 FRAME */}
        <section id="bild" className="pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="mono text-xs font-bold tracking-widest text-[#7C4DFF]">SOLID REAL · 4 + 6 + 12</p><h1 className="text-4xl font-bold leading-[0.95] sm:text-6xl">Mitte hält.<br />Rest kreist.</h1></div>
            <div className="rounded-2xl border-2 border-[var(--line)] bg-white px-3 py-2 text-black shadow-[4px_4px_0_var(--line)]"><p className="text-xs font-bold">GEMESSEN, NICHT GERATEN</p><p className="mono text-sm">11 Zeichen · Mitte 41 · 0.004115</p></div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="rounded-[28px] border-2 border-[var(--line)] bg-[#FFF1C8] p-3 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-[#7C4DFF] px-3 py-1 text-xs font-bold text-white"><Crown size={14}/> CROWN · 6 + 3 = 9</span><span className="mono text-xs font-bold">FRAME 360 × 360</span></div>
              <div className="mx-auto mt-2 w-full max-w-[430px]">
                <svg viewBox="0 0 360 360" className="h-auto w-full" role="img" aria-label="SOLID Diagramm: Mitte 41, umgeben von vier Rollen">
                  <circle cx="180" cy="180" r="158" fill="#fff" stroke="#17131F" strokeWidth="2" strokeDasharray="5 7"/>
                  <circle cx="180" cy="180" r="118" fill="none" stroke="#7C4DFF" strokeWidth="2" strokeDasharray="2 6" opacity=".65"/>
                  <circle cx="180" cy="180" r="78" fill="#FFE89A" stroke="#17131F" strokeWidth="2"/>
                  {radar && <g className="ring-pulse"><line x1="180" y1="180" x2="180" y2="30" stroke="#EF3E4A" strokeWidth="3" strokeLinecap="round"/><circle cx="180" cy="30" r="7" fill="#EF3E4A"/></g>}
                  {(Object.keys(ROLES) as RoleKey[]).map(k => {
                    const r = ROLES[k]; const active = role === k;
                    return <g key={k} onClick={() => setRole(k)} className="cursor-pointer"><circle cx={r.x} cy={r.y} r={active ? 42 : 34} fill={r.color} stroke="#17131F" strokeWidth="3"/><text x={r.x} y={r.y + 5} textAnchor="middle" fontSize="11" fontWeight="800" fill="white">{k}</text>{active && <circle cx={r.x} cy={r.y} r="50" fill="none" stroke="#17131F" strokeWidth="2" strokeDasharray="4 4"/>}</g>;
                  })}
                  <circle cx="180" cy="180" r="46" fill="#FF4D8D" stroke="#17131F" strokeWidth="4"/><text x="180" y="174" textAnchor="middle" fontSize="28" fontWeight="900" fill="white">41</text><text x="180" y="195" textAnchor="middle" fontSize="10" fontWeight="800">MITTE</text>
                  <text x="180" y="346" textAnchor="middle" fontSize="10" fontWeight="700">FÄNGT 3× FALLEN AUF · EYE / BRAIN / CORE</text>
                </svg>
              </div>
              <p className="text-center text-sm font-bold">Tippe einen Kreis an. Die Rolle wechselt sofort.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button onClick={roller} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0_var(--line)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><RotateCw size={16}/> ROLLER: nächste Rolle</button>
                <button onClick={() => { setRadar(v => !v); if (!radar) addLog('Radar', 'Radar sieht Mitte 41'); }} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--line)] bg-[#EF3E4A] px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--line)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><Radar size={16}/> {radar ? 'RADAR AUS' : 'RADAR: MITTE 41 SEHEN'}</button>
              </div>
            </div>

            <aside className="flex flex-col gap-3">
              <div className="rounded-[24px] border-2 border-[var(--line)] bg-white p-4 text-black shadow-[4px_4px_0_var(--line)]"><p className="mono text-xs font-bold text-[#7C4DFF]">1 INDEX FÜR ALLE</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><a href="#bild" className="rounded-xl bg-[#FFC61A] py-2 text-xl font-black">41</a><a href="#bild" className="rounded-xl bg-[#2E7CF6] py-2 text-xl font-black text-white">4</a><a href="#bild" className="rounded-xl bg-[#7C4DFF] py-2 text-xl font-black text-white">6</a><a href="#bild" className="rounded-xl bg-[#00B6A6] py-2 text-xl font-black text-white">9</a><a href="#bild" className="rounded-xl bg-[#FF6B2C] py-2 text-xl font-black text-white">12</a><a href="#stapel" className="rounded-xl bg-[#EF3E4A] py-2 text-xl font-black text-white">729</a></div><p className="mt-2 text-sm">Ein Index. Kein Suchen.</p></div>
              <div className="rounded-[24px] border-2 border-[var(--line)] p-4 text-black shadow-[4px_4px_0_var(--line)]" style={{ background: ROLES[role].color }}>
                <div className="flex items-center justify-between text-white"><span className="flex items-center gap-2 font-bold">{ROLES[role].icon} {ROLES[role].title}</span><span className="rounded-full bg-black/25 px-2 py-1 text-xs">SAT</span></div>
                <p className="pop mt-3 text-2xl font-bold leading-tight text-white" key={role}>{ROLES[role].sat}</p><p className="mt-2 text-sm text-white/90">1 Satz pro Rolle. Mehr nicht.</p>
              </div>
              <div className="rounded-[24px] border-2 border-[var(--line)] bg-[#17131F] p-4 text-white"><p className="text-xs font-bold tracking-widest text-[#FFC61A]">META · NOCH HÖHER</p><p className="mt-2 text-2xl font-bold leading-tight">Mitte 41 hält alle.<br/>Macht keine Rolle.</p><p className="mt-2 text-sm text-white/75">META spielt nicht mit. META hält.</p></div>
            </aside>
          </div>
        </section>

        {/* STACK */}
        <section id="stapel" className="mt-6 rounded-[28px] border-2 border-[var(--line)] bg-white p-4 text-black sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-2xl font-bold"><Layers/> Stapel</h2><span className="mono text-sm font-bold">Delta 0.004115 = 3 / 729 = 1 / 243</span></div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            {[{ n: 9, c: '#FFC61A', w: 42 }, { n: 81, c: '#00B6A6', w: 72 }, { n: 243, c: '#7C4DFF', w: 102 }, { n: 729, c: '#EF3E4A', w: 132 }, { n: 3, c: '#22B45A', w: 30 }].map(s => <div key={s.n} className="flex flex-1 flex-col items-center gap-2 min-w-[56px]"><span className="mono text-lg font-black">{s.n}</span><div className="w-full rounded-t-full border-2 border-black" style={{ height: s.w, background: s.c }} /><span className="text-[11px] font-bold">{s.n === 3 ? 'FÄLLT' : 'WÄCHST'}</span></div>)}
          </div>
          <p className="mt-4 text-center font-bold">9 → 81 → 243 → 729 → <span className="text-[#22B45A]">3</span> · Am Ende bleibt, was hält.</p>
        </section>

        {/* Ü */}
        <section id="ue" className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border-2 border-[var(--line)] bg-[#FFF1C8] p-5">
            <p className="mono text-xs font-bold">Ü = ÜBERLEGUNG</p><h2 className="mt-1 text-3xl font-bold">Farbe, nicht Text.</h2>
            <div className="relative mt-8 flex items-end justify-around pb-2">
              {(['Ja', 'Nein', 'Ü'] as UState[]).map(s => <button key={s} onClick={() => pickU(s)} disabled={busy} className={`flex flex-col items-center gap-2 ${s === 'Ü' ? 'floaty -translate-y-5' : ''}`}><span className="grid place-items-center rounded-full border-[3px] border-black font-black text-white shadow-[3px_3px_0_#17131F]" style={{ width: s === 'Ü' ? 86 : 68, height: s === 'Ü' ? 86 : 68, background: U_COLOR[s], fontSize: s === 'Ü' ? 34 : 18 }}>{s}</span><span className="text-xs font-bold">{s === 'Ja' ? 'Ja · gehalten' : s === 'Nein' ? 'Nein · Halt' : 'Ü · schwebend'}</span>{u === s && <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">AKTIV</span>}</button>)}
            </div>
            <p className="mt-4 rounded-2xl bg-white p-3 text-center font-bold border-2 border-black">Ü schwebt höher als Ja / Nein. Erst denken, dann halten.</p>
          </div>
          <div className="rounded-[28px] border-2 border-[var(--line)] bg-white p-5 text-black">
            <h2 className="text-2xl font-bold">HALT = ZIEL.<br/>HALT = GEHALTEN.</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => addLog('Halt', 'HALT gesetzt')} disabled={busy} className="rounded-2xl bg-[#EF3E4A] p-4 text-left font-bold text-white border-2 border-black shadow-[3px_3px_0_#17131F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><span className="text-3xl">■</span><br/>HALT<br/><span className="text-xs font-normal">Stopp. Prüfen.</span></button>
              <button onClick={() => addLog('Gehalten', 'GEHALTEN bestätigt')} disabled={busy} className="rounded-2xl bg-[#22B45A] p-4 text-left font-bold text-white border-2 border-black shadow-[3px_3px_0_#17131F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><span className="text-3xl">●</span><br/>GEHALTEN<br/><span className="text-xs font-normal">Steht. Bleibt.</span></button>
            </div>
            <p className="mt-3 text-sm font-bold" role="status">{status}</p>
          </div>
        </section>

        {/* LOG */}
        <section id="log" className="mt-6 rounded-[28px] border-2 border-[var(--line)] bg-[#17131F] p-4 text-white sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">LOG · append-only</h2><button onClick={() => addLog('Eintrag', 'Manueller Eintrag')} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-[#FFC61A] px-3 py-1.5 text-sm font-bold text-black"><Plus size={15}/> Eintrag</button></div>
          {logError && <p className="mt-3 text-sm text-[#FFC61A]">{logError}</p>}
          {logs.length === 0 ? <p className="mt-4 text-sm text-white/70">Noch leer. Tippe oben auf HALT, GEHALTEN, Ü oder RADAR.</p> : <ul className="mt-3 space-y-1.5">{logs.slice(0, 12).map(l => <li key={l.id} className="flex flex-wrap gap-2 border-b border-white/15 pb-1.5 text-sm"><span className="mono text-[#FFC61A]">{new Date(l.value.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span><b>{l.value.kind}</b><span className="text-white/80">{l.value.label}</span></li>)}</ul>}
          <p className="mt-3 text-xs text-white/55">Nur anhängen. Nichts wird gelöscht. Max. 1.000 Einträge im Speicher.</p>
        </section>
      </main>
    </div>
  );
}
