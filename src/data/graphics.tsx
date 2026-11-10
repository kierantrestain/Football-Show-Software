import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, BarChart3, Captions, ChartNoAxesColumnIncreasing, ChevronDown, CircleDot, ClipboardList, GalleryHorizontalEnd, LayoutTemplate, ListOrdered, Play, ScanLine, Swords, Target, Trophy, Users } from 'lucide-react'
import type { GraphicKind, GraphicSpec, Match, Team } from './model'
import { displayDate, scoreText } from './model'
import { demoMatches, demoStandings, officialPlayers } from './fixtures'
import './data.css'

export function TeamMark({ team, large = false }: { team: Pick<Team, 'shortName' | 'color'>; large?: boolean }) {
  return <span className={large ? 'data-team-mark is-large' : 'data-team-mark'} style={{ '--team-color': team.color } as React.CSSProperties} aria-hidden="true"><span>{team.shortName}</span></span>
}
export function matchGraphic(match: Match, kind?: GraphicKind): GraphicSpec {
  return {
    id: `graphic-${match.id}-${kind || match.status}`,
    kind: kind || (match.score ? 'result' : 'preview'),
    title: match.score ? 'Full-time result' : 'Match preview',
    subtitle: `${match.competition} · ${match.season}${match.venue ? ` · ${match.venue}` : ''}`,
    source: match.source.label,
    teams: [match.home, match.away].map(({ name, shortName, color, formation }) => ({ name, shortName, color, formation })),
    score: match.score, detail: match.score ? 'Full time' : displayDate(match.kickoff, true),
  }
}
export function lineupGraphic(match: Match, side: 'home' | 'away'): GraphicSpec {
  const team = match[side]
  return {
    id: `graphic-${match.id}-${side}-xi`, kind: 'lineup',
    title: team.name, subtitle: `Starting XI · ${team.formation || 'Formation unavailable'} · ${match.competition}`,
    source: match.source.label, teams: [team], lineup: team.players,
  }
}
const templates = [
  { kind: 'title', label: 'Match title', icon: Captions, desc: 'Introduce a fixture or a segment' },
  { kind: 'lineup', label: 'Starting XI', icon: Users, desc: 'Name and shirt number for all starters' },
  { kind: 'formation', label: 'Formation comparison', icon: Swords, desc: 'Compare the two starting shapes' },
  { kind: 'spotlight', label: 'Player spotlight', icon: Target, desc: 'Single-player profile and key figures' },
  { kind: 'players', label: 'Player comparison', icon: BarChart3, desc: 'Put the panel’s picks side by side' },
  { kind: 'teams', label: 'Team comparison', icon: ChartNoAxesColumnIncreasing, desc: 'Compare team performance' },
  { kind: 'stat', label: 'Key statistic', icon: CircleDot, desc: 'One number that tells the story' },
  { kind: 'result', label: 'Match result', icon: Trophy, desc: 'Full-time score and team identities' },
  { kind: 'preview', label: 'Fixture preview', icon: Play, desc: 'Introduce an upcoming kick-off' },
  { kind: 'tactics', label: 'Tactical title', icon: ScanLine, desc: 'Open a tactical segment' },
  { kind: 'prediction', label: 'Score prediction', icon: Target, desc: 'Put a panel prediction on air' },
  { kind: 'leaderboard', label: 'Leaderboard', icon: ListOrdered, desc: 'Panel scores and season totals' },
  { kind: 'substitution', label: 'Substitution', icon: Activity, desc: 'Show the outgoing and incoming player' },
  { kind: 'performance', label: 'Performance summary', icon: ClipboardList, desc: 'Editorial highlights from a match' },
  { kind: 'events', label: 'Event timeline', icon: GalleryHorizontalEnd, desc: 'A minute-by-minute match story' },
] as const

export function exampleGraphic(kind: GraphicKind): GraphicSpec {
  const match = demoMatches[0]
  const basic = { ...matchGraphic(match, kind), title: templates.find(template => template.kind === kind)?.label || 'Match graphic' }
  switch (kind) {
    case 'title': return { ...basic, title: 'The weekend review', score: undefined, detail: 'Matchweek 12' }
    case 'lineup': return lineupGraphic(match, 'home')
    case 'formation': return { ...basic, title: 'Starting shapes', score: undefined, detail: 'Starting formations' }
    case 'preview': return { ...matchGraphic(demoMatches[1], kind), title: 'Next on the panel' }
    case 'tactics': return { ...basic, title: 'Breaking the high press', subtitle: 'Tactical analysis · Premier Division', label: '01 / The set-up', detail: 'The pivot creates a third-man exit' }
    case 'prediction': return { ...basic, title: 'Panel prediction', subtitle: 'Ana’s score pick · Premier Division', source: 'Prediction · fictional demonstration', detail: 'Predicted score' }
    case 'stat': return { ...basic, title: 'Northbridge set the tempo', value: '54%', label: 'Northbridge possession', detail: 'Matchweek 12 · Full time' }
    case 'spotlight': return { ...basic, title: 'Cole Palmer', subtitle: 'Chelsea · Premier League 2023/24', source: 'Premier League · final 2023/24 records', value: '33', label: 'Goal involvements', detail: '22 goals · 11 assists' }
    case 'substitution': return { ...basic, title: 'Northbridge substitution', subtitle: 'Northbridge FC · 67′', rows: [{ label: 'ON', value: '22', detail: 'Felix Moss' }, { label: 'OFF', value: '10', detail: 'Noah Blake' }] }
    case 'leaderboard': return { ...basic, title: 'The panel table', subtitle: 'Score predictions · 2026/27', rows: [{ label: 'Ana', value: '3 pts', detail: '1 exact' }, { label: 'James', value: '1 pt', detail: '1 correct result' }, { label: 'Ellis', value: '0 pts', detail: '1 prediction' }] }
    case 'players': return { ...basic, title: 'The creative midfielders', subtitle: 'Premier League · 2023/24 · season totals', source: 'Premier League · final 2023/24 records', subjects: officialPlayers.slice(0, 3), rows: [{ label: 'Goals', values: [22, 4, 19] }, { label: 'Assists', values: [11, 10, 8] }, { label: 'Goal involvements', values: [33, 14, 27] }] }
    case 'teams': return { ...basic, title: 'Team comparison', subtitle: 'Premier Division · 2026/27', subjects: [match.home, match.away].map(team => ({ ...team, subtitle: 'Premier Division' })), rows: [{ label: 'Points', values: [demoStandings[0].points, demoStandings[2].points] }, { label: 'Wins', values: [demoStandings[0].wins, demoStandings[2].wins] }, { label: 'Goal difference', values: [demoStandings[0].goalDifference, demoStandings[2].goalDifference] }] }
    case 'events': return { ...basic, title: 'The match in five moments', rows: match.moments.map(moment => ({ label: `${moment.minute}′`, value: moment.title, detail: moment.kind })) }
    case 'performance': return { ...basic, title: 'Match performance', subjects: [match.home, match.away].map(team => ({ ...team, subtitle: team.formation })), rows: match.stats.slice(0, 5).map(stat => ({ label: stat.label, values: [stat.home, stat.away], unit: stat.unit })) }
    default: return basic
  }
}

export function BroadcastGraphic({ graphic }: { graphic: GraphicSpec }) {
  const comparison = !!graphic.subjects?.length
  const fixture = ['title', 'result', 'preview', 'formation', 'prediction'].includes(graphic.kind) && !!graphic.teams?.length
  const largeValue = !!graphic.value
  return <div className="data-graphic" data-testid="broadcast-graphic">
    <div className={`data-graphic-stage graphic-${graphic.kind}`}>
      <header className="data-graphic-header">
        <div><i /> TOUCHLINE STUDIO</div><span>{templates.find(template => template.kind === graphic.kind)?.label || 'Studio graphic'}</span>
      </header>
      <div className="data-graphic-content">
        <div className="data-graphic-kicker">{graphic.subtitle}</div>
        <h2>{graphic.title}</h2>
        {fixture && <div className="data-graphic-fixture">
          {graphic.teams?.slice(0, 2).map((team, index) => <div className={`data-graphic-team side-${index}`} key={team.shortName}>
            <TeamMark team={team} large /><strong>{team.name}</strong>{graphic.kind === 'formation' && <span>{team.formation || 'Unavailable'}</span>}
          </div>)}
          <div className="data-graphic-score"><b>{scoreText(graphic.score)}</b><span>{graphic.detail}</span></div>
        </div>}
        {largeValue && <div className="data-graphic-stat"><strong>{graphic.value}</strong><div><b>{graphic.label}</b><span>{graphic.detail}</span></div></div>}
        {graphic.kind === 'tactics' && <div className="data-graphic-chapter"><span>{graphic.label}</span><b>{graphic.detail}</b></div>}
        {graphic.lineup && <div className="data-graphic-xi">
          {graphic.lineup.map((player, index) => <div key={player.id || index}><strong>{player.number || '—'}</strong><span>{player.name}</span><small>{player.position}</small></div>)}
        </div>}
        {comparison && <div className="data-graphic-comparison" style={{ '--subjects': graphic.subjects?.length } as React.CSSProperties}>
          <div className="data-graphic-data-row"><span /><>{graphic.subjects?.map(subject => <b key={subject.name} style={{ borderColor: subject.color }}>{subject.name}</b>)}</></div>
          {graphic.rows?.map((row, index) => <div className="data-graphic-data-row" key={`${row.label}-${index}`}>
            <span>{row.label}</span>{row.values?.map((value, valueIndex) => <strong key={valueIndex}>{value == null ? '—' : `${value}${row.unit === '%' ? '%' : ''}`}</strong>)}
          </div>)}
        </div>}
        {!comparison && graphic.rows && <div className="data-graphic-list">
          {graphic.rows.map((row, index) => <div key={`${row.label}-${index}`}><span>{row.label}</span><strong>{row.value}</strong><small>{row.detail}</small></div>)}
        </div>}
      </div>
      <footer className="data-graphic-footer"><span>{graphic.source}</span><span>STUDIO FEED</span></footer>
    </div>
  </div>
}

export function GraphicsLibrary({ onQueueGraphic }: { onQueueGraphic: (graphic: GraphicSpec) => void }) {
  const [kind, setKind] = useState<GraphicKind>('result')
  const [draft, setDraft] = useState(() => exampleGraphic('result'))
  const [queued, setQueued] = useState(false)
  useEffect(() => {
    if (!queued) return
    const timeout = window.setTimeout(() => setQueued(false), 2500)
    return () => window.clearTimeout(timeout)
  }, [queued])
  const choose = (next: GraphicKind) => {
    setKind(next)
    setDraft(exampleGraphic(next))
    setQueued(false)
  }
  return <div className="desk-root graphics-desk">
    <header className="desk-heading"><div><span className="desk-eyebrow"><LayoutTemplate size={14} /> PRODUCTION / GRAPHICS</span><h1>Graphics library</h1></div><span className="desk-indicator">15 templates</span></header>
    <div className="graphic-library-layout">
      <aside className="graphic-template-list" aria-label="Graphic templates">
        <div className="desk-section-label">TEMPLATES <ChevronDown size={13} /></div>
        {templates.map(template => <button key={template.kind} type="button" className={template.kind === kind ? 'active' : ''} onClick={() => choose(template.kind)}>
          <template.icon size={17} /><span>{template.label}</span>
        </button>)}
      </aside>
      <section className="graphic-preview-panel">
        <div className="desk-panel-head"><div><span className="desk-eyebrow">PREVIEW MONITOR</span><h2>{templates.find(template => template.kind === kind)?.label}</h2></div><span className="desk-indicator">16:9</span></div>
        <BroadcastGraphic graphic={draft} />
        <div className="graphic-edit-grid">
          <label>Title <input maxLength={80} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Subtitle <input maxLength={100} value={draft.subtitle} onChange={event => setDraft({ ...draft, subtitle: event.target.value })} /></label>
          <label>Source <input maxLength={100} value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })} /></label>
          {draft.label !== undefined && <label>Label <input maxLength={60} value={draft.label} onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>}
          {draft.value !== undefined && <label>Display value <input maxLength={12} value={draft.value} onChange={event => setDraft({ ...draft, value: event.target.value })} /></label>}
          {draft.detail !== undefined && <label>Detail <input maxLength={100} value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} /></label>}
          {draft.score && <label className="graphic-edit-score">Score <span>
            <input aria-label="Home score" type="number" min="0" max="99" value={draft.score[0]} onChange={event => setDraft({ ...draft, score: [Math.max(0, Math.min(99, Number(event.target.value))), draft.score![1]] })} />
            <input aria-label="Away score" type="number" min="0" max="99" value={draft.score[1]} onChange={event => setDraft({ ...draft, score: [draft.score![0], Math.max(0, Math.min(99, Number(event.target.value)))] })} />
          </span></label>}
        </div>
        <div className="desk-action-row"><span role="status">{queued ? 'Added to studio preview' : templates.find(template => template.kind === kind)?.desc}</span>
          <button className="desk-primary" type="button" disabled={!draft.title.trim()} onClick={() => { onQueueGraphic({ ...draft, id: `graphic-${globalThis.crypto?.randomUUID?.() || Date.now()}` }); setQueued(true) }}>Queue to preview <ArrowUpRight size={16} /></button>
        </div>
      </section>
    </div>
  </div>
}
