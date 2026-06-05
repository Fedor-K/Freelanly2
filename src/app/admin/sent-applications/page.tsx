'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, ChevronDown, ChevronRight, FileText, FileWarning, CheckCircle2, XCircle } from 'lucide-react';

// Feed of SENT applications + the WHY: who applied, their CV, and the match reasoning
// (matchScore/label + per-skill breakdown of what the candidate has vs the listing needs).
// Mirror of /admin/imports, but for the outbound side.

type Line = { label: string; status: string; source: string | null; evidence: string | null };
type Row = {
  id: string;
  sentAt: string | null;
  status: string;
  candidate: {
    name: string; title: string | null; location: string | null; experienceYears: number | null;
    skills: string[]; cvUrl: string | null; cvName: string | null; cvGenerated: boolean; hasResumeText: boolean;
    languages: string[]; summary: string | null; linkedinUrl: string | null;
    experience: { title: string; company: string; dates: string; description: string }[];
    education: { degree: string; school: string; dates: string }[];
    certifications: string[];
  };
  jobTitle: string | null;
  jobSlug: string | null;
  jobDescription: string | null;
  recruiterEmail: string | null;
  matchScore: number | null;
  matchLabel: string | null;
  match: { matched: number; total: number; lines: Line[] } | null;
  caveats: { strength: 'Strong' | 'Good' | 'Weak'; items: string[] } | null;
  reasoning: { kind: 'info' | 'ok' | 'warn' | 'final'; text: string }[];
  recruiterReasoning: string | null;
  coverLetter: string | null;
};

const PERIODS = [
  { value: '6h', label: '6 часов' },
  { value: '24h', label: '24 часа' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
];
const LABELS = [
  { value: 'all', label: 'Все' },
  { value: 'Strong', label: 'Strong' },
  { value: 'Good', label: 'Good' },
  { value: 'Weak', label: 'Weak' },
  { value: 'none', label: 'Без оценки' },
];
const CV_OPTS = [
  { value: 'all', label: 'CV: все' },
  { value: 'with', label: 'С CV' },
  { value: 'without', label: 'Без CV' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}с`;
  if (s < 3600) return `${Math.floor(s / 60)}м`;
  if (s < 86400) return `${Math.floor(s / 3600)}ч`;
  return `${Math.floor(s / 86400)}д`;
}

function labelColor(l: string | null): string {
  if (l === 'Strong') return 'bg-green-100 text-green-700';
  if (l === 'Good') return 'bg-blue-100 text-blue-700';
  if (l === 'Weak') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-500';
}

export default function SentApplicationsPage() {
  const [period, setPeriod] = useState('24h');
  const [label, setLabel] = useState('all');
  const [cv, setCv] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [byLabel, setByLabel] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const limit = 250;

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, label, cv, search, page: String(page), limit: String(limit) });
      const r = await fetch(`/api/admin/sent-applications?${params.toString()}`);
      const d = await r.json();
      setRows(d.rows || []);
      setTotal(d.total || 0);
      setByLabel(d.byLabel || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, label, cv, search, page]);

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  }

  const cvWith = rows.filter((r) => r.candidate.cvUrl).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Отправленные заявки</h1>
          <p className="text-sm text-muted-foreground">Кто, кому и <b>почему</b> — кандидат, его резюме и логика матча по каждому отклику.</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 hover:bg-muted">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="py-3"><div className="text-2xl font-bold">{total.toLocaleString('ru-RU')}</div><div className="text-xs text-muted-foreground">отправлено за период</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-2xl font-bold">{rows.length ? Math.round((cvWith / rows.length) * 100) : 0}%</div><div className="text-xs text-muted-foreground">с приложенным CV (на странице)</div></CardContent></Card>
        {['Strong', 'Good', 'Weak'].map((l) => (
          <Card key={l}><CardContent className="py-3"><div className="text-2xl font-bold">{(byLabel[l] || 0).toLocaleString('ru-RU')}</div><div className="text-xs text-muted-foreground">{l}</div></CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => { setPage(1); setPeriod(p.value); }} className={`text-sm px-3 py-1.5 rounded-lg border ${period === p.value ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{p.label}</button>
        ))}
        <span className="w-px h-6 bg-border mx-1" />
        {LABELS.map((l) => (
          <button key={l.value} onClick={() => { setPage(1); setLabel(l.value); }} className={`text-sm px-2.5 py-1.5 rounded-lg border ${label === l.value ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{l.label}</button>
        ))}
        <span className="w-px h-6 bg-border mx-1" />
        {CV_OPTS.map((c) => (
          <button key={c.value} onClick={() => { setPage(1); setCv(c.value); }} className={`text-sm px-2.5 py-1.5 rounded-lg border ${cv === c.value ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{c.label}</button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setSearch(searchInput); } }}
            placeholder="кандидат / вакансия / email рекрутера"
            className="text-sm border rounded-lg px-3 py-1.5 w-64"
          />
          <button onClick={() => { setPage(1); setSearch(searchInput); }} className="p-2 border rounded-lg hover:bg-muted"><Search className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="w-6" />
                <th className="text-left py-2 px-2">Когда</th>
                <th className="text-left py-2 px-2">Кандидат</th>
                <th className="text-left py-2 px-2">Вакансия</th>
                <th className="text-left py-2 px-2">Рекрутер</th>
                <th className="text-left py-2 px-2">Матч</th>
                <th className="text-left py-2 px-2">CV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => toggle(r.id)}>
                    <td className="py-2 px-2 text-gray-400">{expanded.has(r.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                    <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{timeAgo(r.sentAt)}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{r.candidate.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[14rem]">{r.candidate.title || '—'}{r.candidate.experienceYears ? ` · ${r.candidate.experienceYears}y` : ''}</div>
                    </td>
                    <td className="py-2 px-2 max-w-[16rem] truncate">{r.jobSlug ? <Link href={`/freelance/${r.jobSlug}`} target="_blank" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{r.jobTitle}</Link> : r.jobTitle || '—'}</td>
                    <td className="py-2 px-2 font-mono text-[11px] text-muted-foreground truncate max-w-[12rem]">{r.recruiterEmail || '—'}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${labelColor(r.matchLabel)}`}>{r.matchLabel || '—'}{r.matchScore != null ? ` ${r.matchScore}` : ''}</span>
                      {r.match && <span className="text-[11px] text-muted-foreground ml-1.5">{r.match.matched}/{r.match.total} скиллов</span>}
                    </td>
                    <td className="py-2 px-2">
                      {r.candidate.cvUrl
                        ? <span className="inline-flex items-center gap-1 text-green-600 text-xs">{r.candidate.cvGenerated ? <FileWarning className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{r.candidate.cvGenerated ? 'gen' : 'CV'}</span>
                        : <span className="text-xs text-red-400">нет</span>}
                    </td>
                  </tr>
                  {expanded.has(r.id) && (
                    <tr className="bg-muted/30 border-b">
                      <td />
                      <td colSpan={6} className="py-3 px-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* WHY: match breakdown */}
                          <div>
                            <div className="text-xs font-semibold mb-1.5 uppercase text-muted-foreground">Почему отправили (матч скиллов)</div>
                            {r.match ? (
                              <>
                                <div className="text-xs text-muted-foreground mb-2">Совпало <b>{r.match.matched}</b> из <b>{r.match.total}</b> требуемых скиллов вакансии.</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {r.match.lines.map((l, i) => {
                                    const ok = l.status === 'full' || l.status === 'partial';
                                    return (
                                      <span key={i} className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-500'}`} title={l.evidence ? `evidence: ${l.evidence} (${l.source})` : 'не найдено в профиле/CV'}>
                                        {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{l.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">Нет сохранённого breakdown (старый отклик или матч без verifier). Оценка: {r.matchLabel || '—'} {r.matchScore ?? ''}.</div>
                            )}

                            {r.caveats && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.caveats.strength === 'Strong' ? 'bg-green-100 text-green-700' : r.caveats.strength === 'Good' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>{r.caveats.strength}</span>
                                {r.caveats.items.map((cv, i) => (
                                  <span key={i} className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">⚠️ {cv}</span>
                                ))}
                              </div>
                            )}

                            {/* HOW we decided to send. Recruiter-voice judgement (LLM, send-time) when
                                available; otherwise the deterministic gate trail (older records). */}
                            {(r.recruiterReasoning || (r.reasoning && r.reasoning.length > 0)) && (
                              <div className="mt-3">
                                <div className="text-xs font-semibold mb-1 uppercase text-muted-foreground">Как система решила</div>
                                {r.recruiterReasoning ? (
                                  <p className="text-[12px] leading-relaxed text-foreground bg-muted/40 rounded p-2 whitespace-pre-line">{r.recruiterReasoning}</p>
                                ) : (
                                  <ol className="space-y-0.5">
                                    {r.reasoning.map((s, i) => (
                                      <li key={i} className={`text-[11px] flex gap-1.5 ${s.kind === 'final' ? 'font-semibold text-foreground mt-1 pt-1 border-t border-dashed' : s.kind === 'warn' ? 'text-amber-800' : s.kind === 'ok' ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                                        <span className="shrink-0">{s.kind === 'final' ? '→' : s.kind === 'warn' ? '⚠️' : s.kind === 'ok' ? '✓' : '·'}</span>
                                        <span>{s.text}</span>
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            )}

                            <div className="text-xs font-semibold mt-3 mb-1.5 uppercase text-muted-foreground">Профиль кандидата</div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div>Title: {r.candidate.title || '—'} · {r.candidate.location || '—'} · {r.candidate.experienceYears ? `${r.candidate.experienceYears} лет` : 'опыт ?'}</div>
                              {r.candidate.languages.length > 0 && <div className="mt-1">Языки: <span className="text-foreground">{r.candidate.languages.join(', ')}</span></div>}
                              <div className="flex flex-wrap gap-1 mt-1">{r.candidate.skills.map((s, i) => <span key={i} className="bg-gray-100 rounded px-1.5 py-0.5 text-[10px]">{s}</span>)}</div>
                              {r.candidate.experience.length > 0 && (
                                <div className="mt-2">
                                  <div className="font-semibold text-[10px] uppercase text-muted-foreground">Опыт работы (LinkedIn / резюме)</div>
                                  {r.candidate.experience.map((e, i) => (
                                    <div key={i} className="ml-1 mt-0.5">• <span className="text-foreground">{e.title || '—'}</span>{e.company ? ` @ ${e.company}` : ''}{e.dates ? ` · ${e.dates}` : ''}</div>
                                  ))}
                                </div>
                              )}
                              {r.candidate.education.length > 0 && (
                                <div className="mt-2">
                                  <div className="font-semibold text-[10px] uppercase text-muted-foreground">Образование</div>
                                  {r.candidate.education.map((e, i) => (
                                    <div key={i} className="ml-1 mt-0.5">• <span className="text-foreground">{e.degree || '—'}</span>{e.school ? ` — ${e.school}` : ''}{e.dates ? ` · ${e.dates}` : ''}</div>
                                  ))}
                                </div>
                              )}
                              {r.candidate.certifications.length > 0 && <div className="mt-2">Сертификаты: <span className="text-foreground">{r.candidate.certifications.join(', ')}</span></div>}
                              {r.candidate.linkedinUrl && (
                                <div className="mt-1">LinkedIn: <a href={r.candidate.linkedinUrl.startsWith('http') ? r.candidate.linkedinUrl : `https://${r.candidate.linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{r.candidate.linkedinUrl.replace(/^https?:\/\//, '')}</a></div>
                              )}
                              <div className="mt-1">
                                CV: {r.candidate.cvUrl
                                  ? <a href={r.candidate.cvUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{r.candidate.cvName || 'resume.pdf'}</a>
                                  : <span className="text-red-400">не приложено</span>}
                                {r.candidate.cvGenerated && <span className="text-amber-600 ml-1">(сгенерировано из профиля)</span>}
                              </div>
                            </div>
                          </div>

                          {/* Vacancy text + the actual application text */}
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs font-semibold mb-1.5 uppercase text-muted-foreground">Текст вакансии{r.jobSlug && <Link href={`/freelance/${r.jobSlug}`} target="_blank" className="text-blue-600 hover:underline normal-case ml-2 font-normal">открыть →</Link>}</div>
                              <div className="text-xs text-gray-700 whitespace-pre-wrap bg-amber-50 border border-amber-200 rounded p-2 max-h-72 overflow-auto">{r.jobDescription || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold mb-1.5 uppercase text-muted-foreground">Текст отклика (cover letter)</div>
                              <div className="text-xs text-gray-700 whitespace-pre-wrap bg-white border rounded p-2 max-h-72 overflow-auto">{r.coverLetter || '—'}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!rows.length && !loading && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Нет отправленных заявок за период</td></tr>
              )}
              {loading && !rows.length && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Загрузка…</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pager */}
      {total > limit && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">← Назад</button>
          <span>стр. {page} из {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Вперёд →</button>
        </div>
      )}
    </div>
  );
}
