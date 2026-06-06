'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

type Data = {
  period: string;
  gate: { gate_reached: number; with_prof: number };
  profDist: { profession: string; n: number }[];
  sends: { sent: number; exact: number; adjacent: number; score80: number; score80_not_strong: number; no_score: number; no_breakdown: number };
  tags: { active: number; tagged: number; untagged: number; avg_tags: number; max_tags: number; over3: number };
  samples: { name: string; title: string | null; job: string | null; score: number | null; label: string | null; letter: string | null }[];
};

const PERIODS = [{ value: '24h', label: '24 часа' }, { value: '7d', label: '7 дней' }, { value: '30d', label: '30 дней' }];
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-rose-700' : '';
  return <Card><CardContent className="py-3"><div className={`text-2xl font-bold ${c}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>;
}

export default function QualityDashboard() {
  const [period, setPeriod] = useState('24h');
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setD(await (await fetch(`/api/admin/quality?period=${period}`)).json()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  const gateCov = d ? pct(d.gate.with_prof, d.gate.gate_reached) : 0;
  const sentTotal = d?.sends.sent ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Качество матчинга</h1>
          <p className="text-sm text-muted-foreground">Профессия, калибровка скоров, здоровье тегов и спот-чек каверов. По <b>созданным</b> парам (breakdown заморожен на queue-time).</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`text-sm px-3 py-1.5 rounded-lg border ${period === p.value ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{p.label}</button>
          ))}
          <button onClick={load} className="flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 hover:bg-muted"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {!d ? <div className="text-muted-foreground">Загрузка…</div> : (
        <>
          {/* MATCHING */}
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Матчинг — профессия</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat value={`${gateCov}%`} label={`покрытие вердикта гейта (${d.gate.with_prof}/${d.gate.gate_reached})`} tone={gateCov >= 80 ? 'good' : gateCov >= 50 ? 'warn' : 'bad'} />
              {d.profDist.map((p) => (
                <Stat key={p.profession} value={p.n.toLocaleString('ru-RU')} label={`профессия: ${p.profession}`} tone={p.profession === 'exact' ? 'good' : p.profession === 'different' ? 'bad' : p.profession === 'adjacent' ? 'warn' : undefined} />
              ))}
            </div>
          </div>

          {/* CALIBRATION (on sends) */}
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Калибровка скоров (на отправках за период)</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat value={sentTotal.toLocaleString('ru-RU')} label="отправлено" />
              <Stat value={`${pct(d.sends.exact, sentTotal)}% / ${pct(d.sends.adjacent, sentTotal)}%`} label="profession exact / adjacent" />
              <Stat value={`${pct(d.sends.score80_not_strong, d.sends.score80)}%`} label={`score≥80, но label≠Strong (${d.sends.score80_not_strong}/${d.sends.score80})`} tone={pct(d.sends.score80_not_strong, d.sends.score80) > 40 ? 'warn' : undefined} />
              <Stat value={d.sends.no_score.toLocaleString('ru-RU')} label="без скора (слепые)" tone={d.sends.no_score > 0 ? 'warn' : 'good'} />
              <Stat value={d.sends.no_breakdown.toLocaleString('ru-RU')} label="без breakdown" tone={d.sends.no_breakdown > 0 ? 'warn' : 'good'} />
            </div>
          </div>

          {/* TAGS */}
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Теги / роутинг (активные лупы)</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat value={`${pct(d.tags.tagged, d.tags.active)}%`} label={`размечены (${d.tags.tagged}/${d.tags.active})`} tone={pct(d.tags.tagged, d.tags.active) >= 90 ? 'good' : 'warn'} />
              <Stat value={d.tags.untagged.toLocaleString('ru-RU')} label="без тегов (fail-open)" tone={d.tags.untagged > 100 ? 'warn' : undefined} />
              <Stat value={d.tags.avg_tags ?? '—'} label="ср. тегов/луп (овер-тег индикатор)" tone={(d.tags.avg_tags ?? 0) > 2.5 ? 'warn' : 'good'} />
              <Stat value={d.tags.over3.toLocaleString('ru-RU')} label="лупов с >3 тегами (овер-тег)" tone={d.tags.over3 > 50 ? 'warn' : undefined} />
              <Stat value={d.tags.max_tags ?? '—'} label="макс тегов на лупе" />
            </div>
          </div>

          {/* COVER SPOT-CHECK */}
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Спот-чек каверов (свежие real-CV отправки) — читать на выдумки/генерик</div>
            <Card><CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground"><tr>
                  <th className="text-left py-2 px-3">Кандидат → Вакансия</th>
                  <th className="text-left py-2 px-3 w-16">Скор</th>
                  <th className="text-left py-2 px-3">Письмо (начало)</th>
                </tr></thead>
                <tbody>
                  {d.samples.map((s, i) => (
                    <tr key={i} className="border-b align-top">
                      <td className="py-2 px-3"><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{(s.title || '—').slice(0, 40)} → <b>{s.job}</b></div></td>
                      <td className="py-2 px-3 text-xs whitespace-nowrap">{s.label || '—'} {s.score ?? ''}</td>
                      <td className="py-2 px-3 text-xs text-gray-700">{s.letter || '—'}</td>
                    </tr>
                  ))}
                  {!d.samples.length && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Нет отправок за период</td></tr>}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}
