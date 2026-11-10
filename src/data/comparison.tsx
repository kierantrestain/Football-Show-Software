import { useState } from 'react'
import { ArrowUpRight, BarChart3, Check, List, Search, Users } from 'lucide-react'
import { demoPlayerStats, demoSource, demoTeamStats, officialPlayers, officialTeamStats, playerMetrics, teamMetrics } from './fixtures'
import type { ComparisonSubject, GraphicSpec, Match, Metric } from './model'
import { seasonSubjects } from './footballDataset'

const defaultMetrics = { players: ['goals', 'assists', 'involvements', 'played'], teams: ['points', 'wins', 'goalDifference', 'winRate'] }
const pageSize = 7
function compareValue(subject: ComparisonSubject, metric: Metric, per90: boolean) {
  const value = subject.stats[metric.key]
  if (value == null) return null
  if (per90 && metric.per90) return subject.stats.minutes > 0 ? Math.round((value * 90 / subject.stats.minutes) * 100) / 100 : null
  return Math.round(value * 100) / 100
}
function unique(items: (string | undefined)[]) {
  return Array.from(new Set(items.filter((item): item is string => !!item)))
}
export function ComparisonDesk({ onQueueGraphic, matches, competition, demo }: {
  onQueueGraphic: (graphic: GraphicSpec) => void; matches: Match[]; competition: string; demo: boolean
}) {
  type Dataset = 'current' | 'archive' | 'demo'
  type Mode = 'players' | 'teams'
  const getSubjects = (dataset: Dataset, mode: Mode) => dataset === 'archive' ? mode === 'players' ? officialPlayers : officialTeamStats
    : dataset === 'demo' ? mode === 'players' ? demoPlayerStats : demoTeamStats
      : seasonSubjects(matches, competition, mode === 'players' ? 'player' : 'team')
  const initialDataset: Dataset = demo ? 'archive' : 'current'
  const initialMode: Mode = demo ? 'players' : 'teams'
  const initialSubjects = getSubjects(initialDataset, initialMode)
  const [dataset, setDataset] = useState<Dataset>(initialDataset)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [period, setPeriod] = useState(initialSubjects[0]?.period ?? '')
  const [selected, setSelected] = useState<string[]>(initialSubjects.filter(subject => subject.period === initialSubjects[0]?.period).slice(0, 3).map(subject => subject.id))
  const [metricKeys, setMetricKeys] = useState(defaultMetrics[initialMode])
  const [presentation, setPresentation] = useState<'table' | 'bars'>('table')
  const [per90, setPer90] = useState(false)
  const [search, setSearch] = useState('')
  const [club, setClub] = useState('')
  const [position, setPosition] = useState('')
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const archived = dataset === 'archive'
  const allSubjects = getSubjects(dataset, mode)
  const periods = unique(allSubjects.map(subject => subject.period))
  const subjects = period ? allSubjects.filter(subject => subject.period === period) : allSubjects
  const metrics = mode === 'players' ? playerMetrics : teamMetrics
  const chosen = subjects.filter(subject => selected.includes(subject.id))
  const shownMetrics = metrics.filter(metric => metricKeys.includes(metric.key))
  const sample = archived ? 'Premier League · 2023/24 · full season' : dataset === 'demo' ? 'Premier Division · 2026/27 · 12 matchweeks' : subjects[0]?.subtitle || 'Season statistics unavailable for this selection'
  const selectMode = (nextDataset: typeof dataset, nextMode: typeof mode) => {
    setDataset(nextDataset)
    setMode(nextMode)
    setMetricKeys(defaultMetrics[nextMode])
    const candidates = getSubjects(nextDataset, nextMode)
    const firstPeriod = candidates[0]?.period
    setPeriod(firstPeriod ?? '')
    setSelected(candidates.filter(subject => subject.period === firstPeriod).slice(0, 3).map(subject => subject.id))
    setSearch('')
    setClub('')
    setPosition('')
    setPer90(false)
    setPage(0)
    setStatus('')
  }
  const choices = subjects.filter(subject =>
    (!club || subject.club === club) && (!position || subject.position === position) &&
    (!search || subject.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  )
  const per90Available = mode === 'players' && chosen.some(subject => subject.stats.minutes > 0)
  const usePer90 = per90 && per90Available
  const rows = shownMetrics.map(metric => ({
    label: metric.label,
    unit: metric.unit,
    detail: metric.definition,
    values: chosen.map(subject => compareValue(subject, metric, usePer90)),
  }))
  const queue = () => {
    onQueueGraphic({
      id: `comparison-${Date.now()}`, kind: mode, title: mode === 'players' ? 'Player comparison' : 'Team comparison',
      subtitle: `${sample} · ${usePer90 ? 'per 90 where available' : 'season totals'}`,
      source: archived ? 'Premier League · verified season archive' : dataset === 'demo' ? demoSource.label : unique(chosen.map(subject => subject.source?.label)).join(' / ') || 'Authorised season records',
      subjects: chosen.map(({ name, subtitle, color }) => ({ name, subtitle, color })),
      rows: rows.slice(page * pageSize, (page + 1) * pageSize),
    })
    setStatus('Comparison added to preview')
  }
  return <div className="data-comparison-layout">
    <aside className="desk-panel data-subject-picker">
      <div className="desk-panel-head"><div><span className="desk-eyebrow"><Users size={14} /> SUBJECTS</span><h2>Build comparison</h2></div><span className="desk-indicator">{selected.length} / 5</span></div>
      <div className="desk-stack">
        <div className="desk-segmented" aria-label="Comparison type">
          <button type="button" aria-pressed={mode === 'players'} onClick={() => selectMode(dataset, 'players')}>Players</button>
          <button type="button" aria-pressed={mode === 'teams'} onClick={() => selectMode(dataset, 'teams')}>Teams</button>
        </div>
        <label className="desk-field">Dataset<select value={dataset} onChange={event => selectMode(event.target.value as typeof dataset, mode)}>{!demo && <option value="current">{matches[0]?.competition ?? 'Selected competition'} · {matches[0]?.season ?? '2026/27'}</option>}<option value="archive">Premier League · 2023/24 archive</option>{demo && <option value="demo">Premier Division · Rehearsal</option>}</select></label>
        {periods.length > 1 && <label className="desk-field">Period<select value={period} onChange={event => {
          const next = event.target.value
          setPeriod(next)
          setSelected(allSubjects.filter(subject => subject.period === next).slice(0, 3).map(subject => subject.id))
          setPage(0)
        }}>{periods.map(value => <option key={value} value={value}>{allSubjects.find(subject => subject.period === value)?.subtitle || value}</option>)}</select></label>}
        <label className="desk-search"><Search size={16} /><input aria-label="Search comparison subjects" value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === 'players' ? 'Find a player' : 'Find a team'} /></label>
        {mode === 'players' && <div className="desk-field-row">
          <label className="desk-field">Club<select value={club} onChange={event => setClub(event.target.value)}><option value="">All clubs</option>{unique(subjects.map(subject => subject.club)).map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="desk-field">Position<select value={position} onChange={event => setPosition(event.target.value)}><option value="">All positions</option>{unique(subjects.map(subject => subject.position)).map(item => <option key={item}>{item}</option>)}</select></label>
        </div>}
      </div>
      <div className="data-subjects">
        {choices.length ? choices.map(subject => {
          const active = selected.includes(subject.id)
          return <button className="data-subject" key={subject.id} type="button" aria-pressed={active} disabled={selected.length === 5 && !active} onClick={() => {
            setSelected(active ? selected.filter(id => id !== subject.id) : [...selected, subject.id])
            setStatus('')
          }}>
            <span className="data-subject-mark" style={{ '--team-color': subject.color } as React.CSSProperties}>{subject.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>
            <span><strong>{subject.name}</strong><small>{subject.subtitle}</small></span><span className="desk-check">{active && <Check size={13} />}</span>
          </button>
        }) : <p className="desk-empty">No subjects match those filters.</p>}
      </div>
    </aside>
    <section className="desk-panel data-comparison">
      <div className="desk-panel-head data-comparison-head">
        <div><span className="desk-eyebrow"><BarChart3 size={14} /> ANALYSIS</span><h2>{mode === 'players' ? 'Player comparison' : 'Team comparison'}</h2><p>{sample}</p></div>
        <div className="desk-segmented" aria-label="Comparison display"><button type="button" aria-label="Table" aria-pressed={presentation === 'table'} onClick={() => setPresentation('table')}><List size={17} /></button><button type="button" aria-label="Ranking bars" aria-pressed={presentation === 'bars'} onClick={() => setPresentation('bars')}><BarChart3 size={17} /></button></div>
      </div>
      <div className="data-comparison-options">
        <details className="desk-metric-picker">
          <summary>{shownMetrics.length} metrics</summary>
          <div><div className="desk-field-row"><button type="button" className="desk-secondary" onClick={() => { setMetricKeys(metrics.map(metric => metric.key)); setPage(0) }}>Select all</button><button type="button" className="desk-secondary" onClick={() => { setMetricKeys(defaultMetrics[mode]); setPage(0) }}>Reset</button></div>
          {metrics.map(metric => <label key={metric.key} title={metric.definition}><input type="checkbox" checked={metricKeys.includes(metric.key)} onChange={event => { setMetricKeys(event.target.checked ? [...metricKeys, metric.key] : metricKeys.filter(key => key !== metric.key)); setPage(0); setStatus('') }} />{metric.label}</label>)}</div>
        </details>
        {mode === 'players' && <label className="desk-field inline">Display<select value={usePer90 ? 'per90' : 'totals'} onChange={event => setPer90(event.target.value === 'per90')}><option value="totals">Totals</option><option value="per90" disabled={!per90Available}>Per 90 minutes</option></select></label>}
      </div>
      {chosen.length < 2 || !rows.length
        ? <div className="desk-empty comparison-empty">{chosen.length < 2 ? 'Select at least two subjects to compare.' : 'Choose at least one metric to compare.'}</div>
        : presentation === 'table' ? <div className="desk-table-wrap">
          <table className="desk-table comparison-table"><thead><tr><th scope="col">Metric</th>{chosen.map(subject => <th scope="col" key={subject.id} style={{ '--team-color': subject.color } as React.CSSProperties}><span>{subject.name}</span>{mode === 'players' && dataset === 'current' && <small>{subject.stats.minutes === undefined ? 'Minutes unavailable' : subject.stats.minutes + ' min'}</small>}</th>)}</tr></thead><tbody>
            {rows.map(row => <tr key={row.label}><th scope="row" title={row.detail}>{row.label}</th>{row.values.map((value, index) => <td key={chosen[index].id}>{value == null ? <span aria-label="Unavailable" title="Unavailable">—</span> : `${value}${row.unit || ''}`}</td>)}</tr>)}
          </tbody></table>
        </div> : <div className="data-ranking-bars">
          {rows.map(row => {
            const max = Math.max(1, ...row.values.map(value => Math.abs(value ?? 0)))
            return <div key={row.label}><h3 title={row.detail}>{row.label}</h3>
              {row.values.map((value, index) => <div className="data-bar-row" key={chosen[index].id}><span>{chosen[index].name}</span><i style={{ '--value': `${Math.abs(value ?? 0) / max * 100}%`, '--team-color': chosen[index].color } as React.CSSProperties} /><b>{value == null ? '—' : `${value}${row.unit || ''}`}</b></div>)}
            </div>
          })}
        </div>}
      <div className="data-comparison-sources">
        <span className={archived ? 'desk-source-tag official' : 'desk-source-tag'}>{archived ? 'Official archive' : dataset === 'demo' ? 'Demonstration data' : 'Current season · sourced totals'}</span>
        {dataset !== 'demo' && unique(chosen.map(subject => subject.source?.url)).map(url => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname.replace(/^www\./, '')} <ArrowUpRight size={12} /></a>)}
        <span>— Unavailable</span>
      </div>
      <div className="desk-action-row">
        <span role="status">{status}</span>
        {rows.length > pageSize && <label className="desk-field inline">Graphic page<select value={page} onChange={event => setPage(Number(event.target.value))}>{Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>}
        <button className="desk-primary" type="button" onClick={queue} disabled={chosen.length < 2 || !rows.length}>Queue comparison <ArrowUpRight size={16} /></button>
      </div>
    </section>
  </div>
}
