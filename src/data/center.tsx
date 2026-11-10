import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, CalendarDays, ChevronRight, ClipboardList, Clock, Crosshair, Goal, ListOrdered, MapPin, Radio, Search, Shield, Swords, Table2, Users } from 'lucide-react'
import { ComparisonDesk } from './comparison'
import { competitions, demoMatches, demoStandings } from './fixtures'
import { lineupGraphic, matchGraphic, TeamMark } from './graphics'
import { displayDate, fixtureSnapshot, replayMoment, scoreText } from './model'
import { activeSeason, coverageFor, fixturesFor, readFootballSnapshot, resultStandings, subscribeToFootballPack } from './footballDataset'
import { FootballPackImport } from './FootballPackImport'
import type { GraphicSpec, LineupKind, LoadTacticsPayload, Match, Moment, Source, Standing, Team } from './model'
import { PredictionDesk } from './predictions'
import { footballProvider } from './provider'
import './data.css'

type DeskTab = 'matches' | 'standings' | 'compare' | 'predictions'
type DetailTab = 'summary' | 'lineups' | 'stats' | 'squads'
type FixtureFilter = 'all' | 'scheduled' | 'finished'
const statusLabels = { scheduled: 'Upcoming', finished: 'Full time', live: 'Live', postponed: 'Postponed', awaiting: 'Awaiting verification' }
const seasons = Array.from({ length: 5 }, (_, index) => Number(activeSeason.id) - index)
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
  const [competition, setCompetition] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'demo' || initialMatchId?.startsWith('demo-')
    ? 'demo' : initialMatchId?.startsWith('cl:') ? 'CL' : initialMatchId?.startsWith('el:') ? 'EL' : 'PL')
  const [season, setSeason] = useState(activeSeason.id)
  const [snapshot, setSnapshot] = useState(readFootballSnapshot)
  const [licensed, setLicensed] = useState(false)
  const [filter, setFilter] = useState<FixtureFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [activeId, setActiveId] = useState(initialMatchId ?? '')
  const [matchFeed, setMatchFeed] = useState<{ matches: Match[]; source?: Source; message?: string; loading?: boolean }>({ matches: [] })
  const [tableFeed, setTableFeed] = useState<{ standings: Standing[]; message?: string; loading?: boolean }>({ standings: [] })
  const demo = competition === 'demo'
  const pinned = useMemo(() => fixturesFor(competition, season, snapshot.pack), [competition, season, snapshot])
  const matches = demo ? demoMatches : pinned.length && !licensed ? pinned : matchFeed.matches.length ? matchFeed.matches : pinned
  const active = matches.find(match => match.id === activeId) || (demo ? matches[0] : matches.filter(match => match.status === 'finished' && match.verification?.status === 'verified').at(-1))
    || matches.filter(match => match.status === 'finished').at(-1) || matches.find(match => match.status === 'scheduled') || matches[0]
  const source = matches[0]?.source
  const useProvider = !demo && (licensed || !pinned.length)
  const standings = demo ? demoStandings : useProvider && tableFeed.standings.length ? tableFeed.standings : resultStandings(matches)
  const coverage = demo ? undefined : coverageFor(matches, competition)
  const shouldFetchTable = useProvider && (tab === 'standings' || (tab === 'matches' && active?.status === 'scheduled'))
  useEffect(() => subscribeToFootballPack(() => setSnapshot(readFootballSnapshot())), [])
  useEffect(() => {
    if (!useProvider) return
    const controller = new AbortController()
    footballProvider.matches(competition, season, controller.signal).then(feed => {
      const matches = feed.matches || []
      const closest = [...matches].sort((left, right) => Math.abs(Date.parse(left.kickoff) - Date.now()) - Math.abs(Date.parse(right.kickoff) - Date.now()))[0]
      setMatchFeed({ matches, source: feed.source, message: feed.error || feed.message || (feed.stale ? 'Showing the last available provider snapshot.' : '') })
      if (closest) setActiveId(closest.id)
    }).catch(() => {})
    return () => controller.abort()
  }, [competition, season, useProvider])
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
    setActiveId('')
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
        {demo ? <span className="desk-source-tag">Fictional demo</span> : source && <SourceTag source={source} />}
        <label className="desk-field"><span className="desk-sr-only">Competition</span><select value={competition} onChange={event => changeFeed(event.target.value, season)}>
          {competitions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}<option value="demo">Premier Division · Rehearsal</option>
        </select></label>
        {!demo && <label className="desk-field"><span className="desk-sr-only">Season</span><select value={season} onChange={event => changeFeed(competition, event.target.value)}>{seasons.map(year => <option value={year} key={year}>{year}/{String(year + 1).slice(-2)}</option>)}</select></label>}
        {!demo && <label className="desk-toggle"><input type="checkbox" checked={licensed} onChange={event => { setLicensed(event.target.checked); changeFeed(competition, season) }} /> Licensed provider</label>}
      </div>
    </header>
    <nav className="desk-tabs" aria-label="Match intelligence sections">
      {tabs.map(item => <button type="button" key={item.id} aria-pressed={tab === item.id} onClick={() => {
        if (item.id === 'standings' && !demo && !tableFeed.standings.length) setTableFeed({ standings: [], loading: true })
        setTab(item.id)
      }}><item.icon size={16} />{item.text}</button>)}
    </nav>
    {useProvider && matchFeed.message && <div className="desk-service-message" role="status">{matchFeed.message}</div>}
    {coverage && <div className="football-coverage" aria-label="Data coverage">
      <span className="desk-indicator">Coverage preview</span>
      <span>{coverage.fixtures}{coverage.expected ? '/' + coverage.expected : ''} fixtures · {coverage.finished} results · {coverage.missingResults} awaiting verification</span>
      <span>Results complete through round {coverage.throughRound || '—'}{coverage.latestScore && ' · latest available result ' + displayDate(coverage.latestScore)}</span>
      <span>{coverage.squadTeams}/{coverage.teams} clubs with usable sourced squads · {coverage.confirmed} fixtures with both confirmed XIs</span>
      <span>{snapshot.pack?.metrics.filter(metric => metric.competitionId === competition).length || 0} supplied statistics rows{coverage.finished > 0 ? ' · team totals from available results' : ''}</span>
      {source?.downloadedAt && <span>Snapshot retrieved {displayDate(source.downloadedAt, true)}</span>}
      {coverage.conflicts > 0 && <span>{coverage.conflicts} records need producer review</span>}
    </div>}
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
      {active ? <MatchCenter key={active.id + ':' + snapshot.pack?.revision} match={active} matches={matches} standings={standings} onLoadTactics={onLoadTactics} onQueueGraphic={onQueueGraphic} />
        : <section className="desk-panel"><div className="desk-empty comparison-empty">{matchFeed.loading ? 'Loading match data…' : 'Select a competition with available match data.'}</div></section>}
    </div>}
    {tab === 'standings' && <LeagueTable standings={standings} loading={useProvider && tableFeed.loading} message={useProvider ? tableFeed.message : demo ? undefined : 'Provisional table from available results. Played totals show gaps in the snapshot.'} />}
    {tab === 'compare' && <ComparisonDesk key={competition + ':' + snapshot.pack?.revision} onQueueGraphic={onQueueGraphic} matches={matches} competition={competition} demo={demo} />}
    {tab === 'predictions' && (matches.length
      ? <PredictionDesk key={`${competition}-${season}`} matches={matches} onQueueGraphic={onQueueGraphic} producer={producer} />
      : <section className="desk-panel"><p className="desk-empty">{matchFeed.loading ? 'Loading fixtures…' : 'No fixtures are available for predictions in this competition.'}</p></section>)}
    {!demo && <FootballPackImport />}
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
  const [proposal, setProposal] = useState(false)
  const [squad, setSquad] = useState<{ home?: Team; away?: Team; message?: string }>({})
  const [analysisNote, setAnalysisNote] = useState(() => readNote(match.id))
  useEffect(() => {
    if (match.source.kind !== 'provider') return
    const controller = new AbortController()
    footballProvider.match(match.providerId ?? match.id, controller.signal).then(feed => {
      setDetail(feed.match || null)
      setDetailStatus(feed.error || (feed.stale ? 'Showing the last available match details.' : ''))
    }).catch(() => {})
    return () => controller.abort()
  }, [match.id, match.providerId, match.source.kind])
  const active = detail || match
  useEffect(() => {
    if (tab !== 'squads' || active.source.kind !== 'provider' || !active.home.providerId || !active.away.providerId) return
    const controller = new AbortController()
    Promise.all([footballProvider.squad(active.home.providerId, controller.signal), footballProvider.squad(active.away.providerId, controller.signal)]).then(([home, away]) => {
      setSquad({ home: home.team, away: away.team, message: home.error || away.error || home.message || away.message })
    }).catch(() => {})
    return () => controller.abort()
  }, [active.away.providerId, active.home.providerId, active.source.kind, tab])
  const demo = active.source.kind === 'demo'
  const hasXi = (team: Team) => team.players.length === 11 && new Set(team.players.map(player => player.id)).size === 11
  const hasLineups = hasXi(active.home) && hasXi(active.away)
  const lineupKind: LineupKind = demo ? 'demo' : !hasLineups ? 'repair'
    : [active.home, active.away].some(team => team.lineupKind === 'squad') ? 'squad' : 'confirmed'
  const load = (moment?: Moment, accepted = false) => {
    if (lineupKind === 'squad' && !accepted) { setProposal(true); return }
    const teams = [active.home, active.away].map((team, index) => {
      const proposed = squad[index ? 'away' : 'home']?.players ?? []
      const eligible = [...new Map([...(team.squad ?? proposed), ...(team.bench ?? []), ...team.players].filter(player => player.id).map(player => [player.id, player])).values()]
      return { ...team, lineupKind: demo ? 'demo' as const : team.lineupKind ?? (hasXi(team) ? 'confirmed' as const : 'repair' as const), eligible }
    })
    const [home, away] = teams.map(team => moment ? replayMoment(team, active.moments, moment) : { team, dismissed: [] })
    onLoadTactics({
      matchId: active.id, title: active.home.name + ' v ' + active.away.name, competition: active.competition, score: active.score,
      home: home.team, away: away.team, homeDismissed: home.dismissed, awayDismissed: away.dismissed, lineupKind,
      fixture: demo ? undefined : fixtureSnapshot(active), classification: demo && !moment ? 'HYPOTHETICAL' : 'RECONSTRUCTED',
      source: active.source.label + ' · ' + (lineupKind === 'repair' ? 'Roster repair' : lineupKind === 'squad' ? 'Sourced squad XI · analyst selection' : demo ? 'Rehearsal XI' : 'Confirmed XI') + ' · positions estimated',
      moment,
    })
  }
  const queue = (graphic: GraphicSpec) => {
    onQueueGraphic(graphic)
    setStatus('Graphic added to studio preview')
  }
  const label = lineupKind === 'repair' ? 'Open roster repair' : lineupKind === 'squad' ? 'Review sourced squad XIs' : demo
    ? active.status === 'scheduled' ? 'Load expected demo XI' : 'Load into tactics' : 'Load confirmed XIs'
  const conflict = active.verification?.status === 'conflict'
  const unverifiedResult = !demo && active.status === 'finished' && active.verification?.status !== 'verified'
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
      <button className="desk-secondary" type="button" disabled={conflict || unverifiedResult} onClick={() => queue(matchGraphic(active))}>Queue match graphic <ArrowUpRight size={15} /></button>
      <span role="status">{status || detailStatus}</span>
    </div>
    {unverifiedResult && <p className="desk-service-message">Reported result. An independently verified record is needed to queue a full-time graphic.</p>}
    {active.verification?.note && <p className="desk-service-message">{active.verification.note}</p>}
    {lineupKind === 'repair' && <p className="desk-service-message">Eligible XI gap · {Math.max(0, 11 - active.home.players.length)} {active.home.shortName} · {Math.max(0, 11 - active.away.players.length)} {active.away.shortName}. Import authorised records to complete the selection.</p>}
    {proposal && <section className="desk-panel" aria-label="Proposed sourced squad line-ups">
      <div className="data-two-columns"><LineupList team={active.home} label="Proposed sourced squad XI" /><LineupList team={active.away} label="Proposed sourced squad XI" /></div>
      <button type="button" className="desk-primary" onClick={() => load(undefined, true)}>Use sourced squad XIs</button>
    </section>}
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
        {(['home', 'away'] as const).map(side => <LineupList key={side} team={active[side]} label={active.source.kind === 'demo' ? active.status === 'scheduled' ? 'Expected XI · fictional' : 'Demonstration XI' : active[side].lineupKind === 'squad' ? 'Sourced squad XI · analyst selection' : 'Confirmed XI'} onQueue={active[side].players.length === 11 ? () => queue(lineupGraphic(active, side)) : undefined} />)}
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
          {(['home', 'away'] as const).map(side => <LineupList key={side} team={active.source.kind === 'demo' ? { ...active[side], players: [...active[side].players, ...(active[side].bench || [])], bench: [] } : squad[side] || { ...active[side], players: active[side].squad ?? [], bench: [] }} label="Squad" />)}
        </div>
      </>}
      <div className="data-match-provenance"><SourceTag source={active.source} />{active.source.updatedAt && <span>Source effective {displayDate(active.source.updatedAt, true)}</span>}
        {active.verification?.status === 'verified' && <span>Independently checked {active.verification.checkedAt && displayDate(active.verification.checkedAt)}</span>}
        {active.verification?.sources?.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname.replace('www.', '')}</a>)}{active.source.kind === 'provider' && <span>Provider coverage and delay vary by competition.</span>}</div>
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
