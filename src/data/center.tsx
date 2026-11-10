import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, CircleDot, ClipboardList, Clock, Crosshair, Goal, ListOrdered, MapPin, Radio, Search, Shield, Swords, Table2, Users } from 'lucide-react'
import { ComparisonDesk } from './comparison'
import { competitions, demoMatches, demoStandings } from './fixtures'
import { lineupGraphic, matchGraphic, TeamMark } from './graphics'
import { applyMoment, displayDate, scoreText } from './model'
import type { GraphicSpec, LineupPlayer, LoadTacticsPayload, Match, Moment, Source, Standing, Team } from './model'
import { PredictionDesk } from './predictions'
import { footballProvider } from './provider'
import './data.css'

type DeskTab = 'matches' | 'standings' | 'compare' | 'predictions'
type DetailTab = 'summary' | 'lineups' | 'stats' | 'squads'
type FixtureFilter = 'all' | 'scheduled' | 'finished'
const statusLabels = { scheduled: 'Upcoming', finished: 'Full time', live: 'Live', postponed: 'Postponed' }
const current = new Date()
const currentYear = current.getUTCMonth() >= 6 ? current.getUTCFullYear() : current.getUTCFullYear() - 1
const seasons = Array.from({ length: 5 }, (_, index) => currentYear - index)
const listLimit = 14
const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const tabs = [
  { id: 'matches', text: 'Match centre', icon: CalendarDays },
  { id: 'standings', text: 'League table', icon: Table2 },
  { id: 'compare', text: 'Comparisons', icon: BarChart3 },
  { id: 'predictions', text: 'Predictions', icon: ListOrdered },
] as const

function SourceTag({ source }: { source: Source }) {
  const name = source.kind === 'demo' ? 'Fictional demo' : source.kind === 'official' ? 'Official archive' : source.label
  return source.url
    ? <a className="desk-source-tag official" href={source.url} target="_blank" rel="noreferrer">{name} <ArrowUpRight size={12} /></a>
    : <span className="desk-source-tag">{name}</span>
}
export function DataCenter({ onLoadTactics, onQueueGraphic, producer = false, initialMatchId }: {
  onLoadTactics: (payload: LoadTacticsPayload) => void
  onQueueGraphic: (graphic: GraphicSpec) => void
  producer?: boolean; initialMatchId?: string
}) {
  const [tab, setTab] = useState<DeskTab>('matches')
  const [competition, setCompetition] = useState('demo')
  const [season, setSeason] = useState(String(currentYear))
  const [filter, setFilter] = useState<FixtureFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [activeId, setActiveId] = useState(initialMatchId ?? demoMatches[0].id)
  const [matchFeed, setMatchFeed] = useState<{ matches: Match[]; source?: Source; message?: string; loading?: boolean }>({ matches: [] })
  const [tableFeed, setTableFeed] = useState<{ standings: Standing[]; message?: string; loading?: boolean }>({ standings: [] })
  const demo = competition === 'demo'
  const matches = demo ? demoMatches : matchFeed.matches
  const active = matches.find(match => match.id === activeId) || matches[0]
  const shouldFetchTable = !demo && (tab === 'standings' || (tab === 'matches' && active?.status === 'scheduled'))
  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    footballProvider.matches(competition, season, controller.signal).then(feed => {
      const matches = feed.matches || []
      const closest = [...matches].sort((left, right) => Math.abs(Date.parse(left.kickoff) - Date.now()) - Math.abs(Date.parse(right.kickoff) - Date.now()))[0]
      setMatchFeed({ matches, source: feed.source, message: feed.error || feed.message || (feed.stale ? 'Showing the last available provider snapshot.' : '') })
      if (closest) setActiveId(closest.id)
    }).catch(() => {})
    return () => controller.abort()
  }, [competition, season, demo])
  useEffect(() => {
    if (!shouldFetchTable) return
    const controller = new AbortController()
    footballProvider.standings(competition, season, controller.signal).then(feed => setTableFeed({
      standings: feed.standings || [], message: feed.error || feed.message || (feed.stale ? 'Showing the last available table.' : ''),
    })).catch(() => {})
    return () => controller.abort()
  }, [competition, season, shouldFetchTable])
  const changeFeed = (nextCompetition: string, nextSeason: string) => {
    setCompetition(nextCompetition)
    setSeason(nextSeason)
    setMatchFeed({ matches: [], loading: nextCompetition !== 'demo' })
    setTableFeed({ standings: [], loading: nextCompetition !== 'demo' })
    setActiveId(demoMatches[0].id)
    setExpanded(false)
    setSearch('')
    setFilter('all')
  }
  const relevant = matches.filter(match => (filter === 'all' || filter === match.status) && `${match.home.name} ${match.away.name}`.toLowerCase().includes(search.toLowerCase().trim()))
  const sorted = demo ? relevant : [...relevant].sort((a, b) => filter === 'scheduled'
    ? Date.parse(a.kickoff) - Date.parse(b.kickoff)
    : filter === 'finished' ? Date.parse(b.kickoff) - Date.parse(a.kickoff)
      : Math.abs(Date.parse(a.kickoff) - Date.now()) - Math.abs(Date.parse(b.kickoff) - Date.now()))
  const visible = expanded ? sorted : sorted.slice(0, listLimit)
  return <div className="desk-root" data-testid="match-intelligence">
    <header className="desk-heading">
      <div><span className="desk-eyebrow"><Radio size={14} /> ANALYSIS / DATA DESK</span><h1>Match intelligence</h1></div>
      <div className="desk-heading-controls">
        {demo ? <span className="desk-source-tag">Fictional demo</span> : matchFeed.source && <SourceTag source={matchFeed.source} />}
        <label className="desk-field"><span className="desk-sr-only">Competition</span><select value={competition} onChange={event => changeFeed(event.target.value, season)}>
          <option value="demo">Premier Division · Demo</option>{competitions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>
        {!demo && <label className="desk-field"><span className="desk-sr-only">Season</span><select value={season} onChange={event => changeFeed(competition, event.target.value)}>{seasons.map(year => <option value={year} key={year}>{year}/{String(year + 1).slice(-2)}</option>)}</select></label>}
      </div>
    </header>
    <nav className="desk-tabs" aria-label="Match intelligence sections">
      {tabs.map(item => <button type="button" key={item.id} aria-pressed={tab === item.id} onClick={() => {
        if (item.id === 'standings' && !demo && !tableFeed.standings.length) setTableFeed({ standings: [], loading: true })
        setTab(item.id)
      }}><item.icon size={16} />{item.text}</button>)}
    </nav>
    {!demo && matchFeed.message && <div className="desk-service-message" role="status">{matchFeed.message}</div>}
    {tab === 'matches' && <div className="data-match-layout">
      <aside className="desk-panel data-fixture-list">
        <div className="desk-panel-head"><div><span className="desk-eyebrow">FIXTURE INDEX</span><h2>Matches</h2></div><span className="desk-indicator">{matches.length}</span></div>
        <div className="desk-stack">
          <label className="desk-search"><Search size={16} /><input placeholder="Find a team" aria-label="Find a team" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="desk-segmented" aria-label="Fixture filter">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            <button type="button" aria-pressed={filter === 'scheduled'} onClick={() => setFilter('scheduled')}>Upcoming</button>
            <button type="button" aria-pressed={filter === 'finished'} onClick={() => setFilter('finished')}>Results</button>
          </div>
        </div>
        <div className="data-fixtures">
          {visible.map(match => <button className="data-fixture" type="button" aria-pressed={active?.id === match.id} key={match.id} onClick={() => setActiveId(match.id)}>
            <span className="data-fixture-date"><span>{displayDate(match.kickoff)}</span><span>{statusLabels[match.status]}</span></span>
            <span className="data-fixture-teams"><span><TeamMark team={match.home} /><b>{match.home.name}</b></span><span><TeamMark team={match.away} /><b>{match.away.name}</b></span></span>
            <span className="data-fixture-score">{match.score ? <><b>{match.score[0]}</b><b>{match.score[1]}</b></> : <ChevronRight size={17} />}</span>
          </button>)}
          {!visible.length && <p className="desk-empty">{!demo && matchFeed.loading ? 'Loading fixtures…' : 'No fixtures match this view.'}</p>}
          {sorted.length > listLimit && <button className="desk-secondary data-more" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer matches' : `Show all ${sorted.length} matches`}</button>}
        </div>
      </aside>
      {active ? <MatchCenter key={active.id} match={active} matches={matches} standings={demo ? demoStandings : tableFeed.standings} onLoadTactics={onLoadTactics} onQueueGraphic={onQueueGraphic} />
        : <section className="desk-panel"><div className="desk-empty comparison-empty">{matchFeed.loading ? 'Loading match data…' : 'Select a competition with available match data.'}</div></section>}
    </div>}
    {tab === 'standings' && <LeagueTable standings={demo ? demoStandings : tableFeed.standings} loading={!demo && tableFeed.loading} message={!demo ? tableFeed.message : undefined} />}
    {tab === 'compare' && <ComparisonDesk onQueueGraphic={onQueueGraphic} />}
    {tab === 'predictions' && (matches.length
      ? <PredictionDesk key={`${competition}-${season}`} matches={matches} onQueueGraphic={onQueueGraphic} producer={producer} />
      : <section className="desk-panel"><p className="desk-empty">{matchFeed.loading ? 'Loading fixtures…' : 'No fixtures are available for predictions in this competition.'}</p></section>)}
  </div>
}

function LeagueTable({ standings, loading, message }: { standings: Standing[]; loading?: boolean; message?: string }) {
  return <section className="desk-panel league-desk">
    <div className="desk-panel-head"><div><span className="desk-eyebrow"><Table2 size={14} /> COMPETITION</span><h2>League table</h2></div></div>
    {message && <div className="desk-service-message">{message}</div>}
    {standings.length ? <div className="desk-table-wrap"><table className="desk-table">
      <thead><tr><th scope="col">Pos</th><th scope="col">Club</th><th scope="col">Played</th><th scope="col">Won</th><th scope="col">Drawn</th><th scope="col">Lost</th><th scope="col">GD</th><th scope="col">Points</th></tr></thead>
      <tbody>{standings.map(row => <tr key={`${row.group || 'total'}-${row.team.id}`}><td>{row.rank}</td><th scope="row"><span className="table-club"><TeamMark team={row.team} />{row.team.name}{row.group && <small>{row.group.replaceAll('_', ' ')}</small>}</span></th><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td><td>{row.points}</td></tr>)}</tbody>
    </table></div> : <div className="desk-empty comparison-empty">{loading ? 'Loading league table…' : 'A table is unavailable for this competition and season.'}</div>}
  </section>
}

function MatchCenter({ match, matches, standings, onLoadTactics, onQueueGraphic }: {
  match: Match
  matches: Match[]
  standings: Standing[]
  onLoadTactics: (payload: LoadTacticsPayload) => void
  onQueueGraphic: (graphic: GraphicSpec) => void
}) {
  const [detail, setDetail] = useState<Match | null>(null)
  const [detailStatus, setDetailStatus] = useState('')
  const [tab, setTab] = useState<DetailTab>('summary')
  const [status, setStatus] = useState('')
  const [manual, setManual] = useState(false)
  const [squad, setSquad] = useState<{ home?: Team; away?: Team; message?: string }>({})
  const [analysisNote, setAnalysisNote] = useState(() => readNote(match.id))
  useEffect(() => {
    if (match.source.kind !== 'provider') return
    const controller = new AbortController()
    footballProvider.match(match.id, controller.signal).then(feed => {
      setDetail(feed.match || null)
      setDetailStatus(feed.error || (feed.stale ? 'Showing the last available match details.' : ''))
    }).catch(() => {})
    return () => controller.abort()
  }, [match.id, match.source.kind])
  const active = detail || match
  useEffect(() => {
    if (tab !== 'squads' || active.source.kind !== 'provider' || !/^\d+$/.test(active.home.id) || !/^\d+$/.test(active.away.id)) return
    const controller = new AbortController()
    Promise.all([footballProvider.squad(active.home.id, controller.signal), footballProvider.squad(active.away.id, controller.signal)]).then(([home, away]) => {
      setSquad({ home: home.team, away: away.team, message: home.error || away.error || home.message || away.message })
    }).catch(() => {})
    return () => controller.abort()
  }, [active.away.id, active.home.id, active.source.kind, tab])
  const hasHome = active.home.players.length >= 11
  const hasAway = active.away.players.length >= 11
  const hasLineups = hasHome && hasAway
  const load = (moment?: Moment, teams?: [Team, Team]) => {
    const [home, away] = teams || [
      hasHome ? active.home : { ...active.home, formation: active.home.formation || '4-3-3', players: [] },
      hasAway ? active.away : { ...active.away, formation: active.away.formation || '4-2-3-1', players: [] },
    ]
    const lineupSource = teams ? 'manual line-up' : hasLineups ? 'line-ups supplied' : hasHome || hasAway ? 'one line-up supplied' : 'blank formations'
    onLoadTactics({
      matchId: active.id, title: `${home.name} v ${away.name}`, competition: active.competition, score: active.score,
      home: moment ? applyMoment(home, active.moments, moment) : home,
      away: moment ? applyMoment(away, active.moments, moment) : away,
      classification: moment && active.source.kind !== 'demo' ? 'RECONSTRUCTED' : 'HYPOTHETICAL',
      source: `${active.source.label} · ${lineupSource} · positions estimated`, moment,
    })
  }
  const queue = (graphic: GraphicSpec) => {
    onQueueGraphic(graphic)
    setStatus('Graphic added to studio preview')
  }
  const label = hasLineups
    ? active.source.kind === 'demo' ? active.status === 'scheduled' ? 'Load expected demo XI' : 'Load into tactics' : 'Load confirmed XI'
    : hasHome || hasAway ? 'Load available XI' : 'Load blank formation'
  return <section className="data-match-centre" aria-label="Match details">
    <div className="data-match-hero">
      <div className="data-hero-top"><div><span><i /> {active.competition.toUpperCase()}</span><small>{active.season}{active.round ? ` / MATCHWEEK ${active.round}` : ''}</small></div><span className={active.status === 'live' ? 'desk-indicator live' : 'desk-indicator'}>{statusLabels[active.status]}</span></div>
      <div className="data-hero-score">
        <div><TeamMark team={active.home} large /><b>{active.home.name}</b><span>{active.home.formation || 'Home'}</span></div>
        <div><strong>{scoreText(active.score)}</strong><span>{active.score ? statusLabels[active.status] : displayDate(active.kickoff, true)}</span></div>
        <div><TeamMark team={active.away} large /><b>{active.away.name}</b><span>{active.away.formation || 'Away'}</span></div>
      </div>
      <div className="data-hero-bottom"><span><Clock size={14} /> {displayDate(active.kickoff, true)}</span>{active.venue && <span><MapPin size={14} /> {active.venue}</span>}<SourceTag source={active.source} /></div>
    </div>
    <div className="data-match-actions"><button className="desk-primary" type="button" onClick={() => load()}><Crosshair size={17} /> {label}</button>
      {!hasLineups && <button type="button" className="desk-secondary" aria-expanded={manual} onClick={() => setManual(!manual)}>Manual line-up</button>}
      <button className="desk-secondary" type="button" onClick={() => queue(matchGraphic(active))}>Queue match graphic <ArrowUpRight size={15} /></button>
      <span role="status">{status || detailStatus}</span>
    </div>
    {manual && <ManualLineup match={active} onLoad={teams => load(undefined, teams)} />}
    <div className="desk-panel data-match-detail">
      <nav className="desk-tabs compact" aria-label="Match detail sections">
        <button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}><ClipboardList size={15} /> Overview</button>
        <button type="button" aria-pressed={tab === 'lineups'} onClick={() => setTab('lineups')}><Users size={15} /> Line-ups</button>
        <button type="button" aria-pressed={tab === 'stats'} onClick={() => setTab('stats')}><BarChart3 size={15} /> Statistics</button>
        <button type="button" aria-pressed={tab === 'squads'} onClick={() => setTab('squads')}><Shield size={15} /> Squads</button>
      </nav>
      {tab === 'summary' && <>
        {active.notes && <div className="data-match-summary"><span className="desk-eyebrow">{active.status === 'scheduled' ? 'MATCH PREVIEW' : 'MATCH REPORT'}</span><p>{active.notes}</p></div>}
        {active.status === 'scheduled' && <MatchPreview match={active} matches={matches} standings={standings} />}
        {active.moments.length > 0 && <div className="data-moments">
          <div className="desk-panel-head"><div><span className="desk-eyebrow"><Goal size={14} /> RECONSTRUCTION</span><h2>Key moments</h2></div><span className="desk-indicator">Positions estimated</span></div>
          {active.moments.map(moment => <button className="data-moment" type="button" key={moment.id} onClick={() => load(moment)} aria-label={`Reconstruct ${moment.title}`}>
            <span className="data-moment-minute">{moment.minute}{moment.extra ? `+${moment.extra}` : ''}′</span><span><strong>{moment.title}</strong><small>{moment.description}</small></span><span className="data-moment-kind">{moment.kind}</span><ArrowUpRight size={16} />
          </button>)}
        </div>}
        {!active.moments.length && active.status !== 'scheduled' && <div className="desk-empty">No event feed is available for this match.</div>}
        <div className="desk-stack data-match-note">
          <label className="desk-field">Analyst notes<textarea value={analysisNote} onChange={event => {
            setAnalysisNote(event.target.value)
            try { localStorage.setItem(`football-studio:match-note:${active.id}`, event.target.value) } catch { setStatus('Notes could not be saved in browser storage.') }
          }} rows={2} maxLength={1000} placeholder="Add a note for the analysis desk" /></label>
        </div>
      </>}
      {tab === 'lineups' && <div className="data-two-columns">
        {(['home', 'away'] as const).map(side => <LineupList key={side} team={active[side]} label={active.source.kind === 'demo' ? active.status === 'scheduled' ? 'Expected XI · fictional' : 'Demonstration XI' : 'Starting XI'} onQueue={active[side].players.length === 11 ? () => queue(lineupGraphic(active, side)) : undefined} />)}
      </div>}
      {tab === 'stats' && (active.stats.length ? <div className="data-match-stat-list">
        <div className="desk-panel-head"><div><span className="desk-eyebrow">MATCH TOTALS</span><h2>Team statistics</h2></div><button type="button" className="desk-secondary" onClick={() => queue({
          ...matchGraphic(active, 'performance'), title: 'Match performance', subjects: [active.home, active.away].map(team => ({ name: team.name, color: team.color, subtitle: team.formation })),
          rows: active.stats.slice(0, 7).map(stat => ({ label: stat.label, values: [stat.home, stat.away], unit: stat.unit })),
        })}>Queue statistics <ArrowUpRight size={14} /></button></div>
        {active.stats.map(stat => <div key={stat.label}><b>{stat.home == null ? '—' : `${numberFormat.format(stat.home)}${stat.unit || ''}`}</b><span>{stat.label}</span><b>{stat.away == null ? '—' : `${numberFormat.format(stat.away)}${stat.unit || ''}`}</b></div>)}
        <p className="desk-empty">Player-level match statistics are unavailable for this feed.</p>
      </div> : <p className="desk-empty">Statistics are unavailable for this match.</p>)}
      {tab === 'squads' && <>
        {squad.message && <div className="desk-service-message">{squad.message}</div>}
        <div className="data-two-columns">
          {(['home', 'away'] as const).map(side => <LineupList key={side} team={active.source.kind === 'demo' ? { ...active[side], players: [...active[side].players, ...(active[side].bench || [])], bench: [] } : squad[side] || { ...active[side], players: [], bench: [] }} label="Squad" />)}
        </div>
      </>}
      <div className="data-match-provenance"><SourceTag source={active.source} />{active.source.updatedAt && <span>Source updated {displayDate(active.source.updatedAt, true)}</span>}{active.source.kind === 'provider' && <span>Provider coverage and delay vary by competition.</span>}</div>
    </div>
  </section>
}
function readNote(id: string) {
  try { return localStorage.getItem(`football-studio:match-note:${id}`) || '' } catch { return '' }
}
function LineupList({ team, label, onQueue }: { team: Team; label: string; onQueue?: () => void }) {
  return <section className="data-lineup-list">
    <div className="desk-panel-head"><TeamMark team={team} /><div><span className="desk-eyebrow">{label.toUpperCase()}</span><h2>{team.name}</h2></div><span className="desk-indicator">{team.formation || '—'}</span></div>
    {team.players.length ? <ol>{team.players.map((player, index) => <li key={player.id || index}><strong>{player.number || '—'}</strong><span>{player.name}</span><small>{player.position || '—'}</small></li>)}</ol> : <p className="desk-empty">{label} unavailable.</p>}
    {!!team.bench?.length && <details className="data-bench"><summary>Substitutes ({team.bench.length})</summary><ol>{team.bench.map((player, index) => <li key={player.id || index}><strong>{player.number || '—'}</strong><span>{player.name}</span><small>{player.position || '—'}</small></li>)}</ol></details>}
    {onQueue && <button className="desk-secondary" type="button" onClick={onQueue}>Queue starting XI <ArrowUpRight size={14} /></button>}
  </section>
}
function MatchPreview({ match, matches, standings }: { match: Match; matches: Match[]; standings: Standing[] }) {
  const recent = (teamId: string) => matches.filter(item => item.status === 'finished' && item.score && Date.parse(item.kickoff) < Date.parse(match.kickoff) && [item.home.id, item.away.id].includes(teamId))
    .sort((left, right) => Date.parse(right.kickoff) - Date.parse(left.kickoff)).slice(0, 5).map(item => {
      const [home, away] = item.score!
      return home === away ? 'D' : (item.home.id === teamId ? home > away : away > home) ? 'W' : 'L'
    })
  const headToHead = matches.filter(item => item.status === 'finished' && item.score && Date.parse(item.kickoff) < Date.parse(match.kickoff) && [item.home.id, item.away.id].includes(match.home.id) && [item.home.id, item.away.id].includes(match.away.id))
    .sort((left, right) => Date.parse(right.kickoff) - Date.parse(left.kickoff))
  return <div className="data-fixture-preview">
    <span className="desk-eyebrow"><Swords size={14} /> FORM GUIDE</span>
    <div className="data-two-columns">{[match.home, match.away].map(team => {
      const rank = standings.find(row => row.team.id === team.id)?.rank
      const form = recent(team.id)
      return <div key={team.id}><strong>{team.name}</strong><small>{rank ? `League position ${rank}` : 'League position unavailable'}</small><span className="data-form-run">{form.length ? form.map((item, index) => <i key={index} className={`form-${item.toLowerCase()}`}>{item}</i>) : 'Recent form unavailable'}</span></div>
    })}</div>
    <p>{headToHead.length ? `Most recent meeting in this feed: ${headToHead[0].home.name} ${scoreText(headToHead[0].score)} ${headToHead[0].away.name}.` : 'Head-to-head is unavailable in this season feed.'}</p>
    <p>Squad availability reports are unavailable.</p>
  </div>
}
function ManualLineup({ match, onLoad }: { match: Match; onLoad: (teams: [Team, Team]) => void }) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const parse = (text: string): LineupPlayer[] => text.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [number, name, position] = line.split(',').map(value => value.trim())
    return { number: /^\d{1,2}$/.test(number) ? Number(number) : index + 1, name: name || number, position: position || '' }
  })
  const homePlayers = parse(home)
  const awayPlayers = parse(away)
  return <div className="desk-panel data-manual-lineup">
    <div className="desk-panel-head"><div><span className="desk-eyebrow"><CircleDot size={14} /> ANALYST ENTRY</span><h2>Manual line-up</h2></div><span className="desk-indicator">Unverified</span></div>
    <div className="desk-stack"><p>Enter one player per line as shirt number, name, position.</p>
      <div className="desk-field-row">
        <label className="desk-field">{match.home.name} <textarea rows={5} placeholder="1, Player name, GK" value={home} onChange={event => setHome(event.target.value)} /></label>
        <label className="desk-field">{match.away.name} <textarea rows={5} placeholder="1, Player name, GK" value={away} onChange={event => setAway(event.target.value)} /></label>
      </div>
      <div className="desk-action-row"><span>{homePlayers.length} home · {awayPlayers.length} away</span><button type="button" className="desk-primary" disabled={homePlayers.length !== 11 || awayPlayers.length !== 11} onClick={() => onLoad([
        { ...match.home, formation: match.home.formation || '4-3-3', players: homePlayers },
        { ...match.away, formation: match.away.formation || '4-2-3-1', players: awayPlayers },
      ])}>Load manual XI <ArrowDownRight size={16} /></button></div>
    </div>
  </div>
}
