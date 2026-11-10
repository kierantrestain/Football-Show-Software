import type { CSSProperties } from 'react'
import type { MatchIdentity } from './domain'
import type { FixtureSnapshot } from './data/fixtureSnapshot'
import './score.css'

const fallbackColors = ['#b96855', '#718dab']
function color(value: string | undefined, index: number) {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallbackColors[index]
}
const teamStyle = (value: string | undefined, index: number) => ({ '--club-color': color(value, index) } as CSSProperties)
const zonedTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })
const zonedDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function fixtureStatus(fixture: FixtureSnapshot) {
  const status: string = fixture.status
  const period: string = fixture.period ?? ''
  if (status === 'finished') {
    if (fixture.shootout) return 'PENS'
    return /extra|aet/i.test(period) ? 'AET' : 'FT'
  }
  if (status === 'live') return fixture.clock ? `${fixture.clock.minute}${fixture.clock.extra ? '+' + fixture.clock.extra : ''}′` : fixture.period === 'extra-time' ? 'ET' : fixture.period === 'penalties' ? 'PENS' : 'LIVE'
  if (status === 'postponed') return 'PPD'
  if (status === 'scheduled' && Date.parse(fixture.kickoff) > Date.now()) return zonedTime.format(new Date(fixture.kickoff))
  return 'VERIFY'
}

export function Scorebug({ match, surface = 'air' }: { match: MatchIdentity; surface?: 'air' | 'editor' }) {
  const fixture = match.fixture
  const teams = fixture ? [fixture.home, fixture.away] : [
    { id: 'home', name: match.home, shortName: match.homeShort, color: fallbackColors[0] },
    { id: 'away', name: match.away, shortName: match.awayShort, color: fallbackColors[1] },
  ]
  const score = fixture ? fixture.score?.join('–') : match.score
  const status = fixture ? fixtureStatus(fixture) : score ? 'FT' : 'PREVIEW'
  const strip = (index: number) => <span className={`fixture-club strip-${index}`} style={teamStyle(teams[index].color, index)}>
    <span className="fixture-club-code" aria-hidden="true">{teams[index].shortName}</span>
    <span className="fixture-club-name">{teams[index].name}</span>
  </span>
  return <div className={`fixture-scorebug fixture-scorebug-${surface}`} aria-label={`${teams[0].name} against ${teams[1].name}`} data-testid="fixture-scorebug">
    {strip(0)}
    <span className="fixture-score-core"><strong>{score || 'v'}</strong>{fixture?.shootout && <small>{fixture.shootout.join('–')} pens</small>}</span>
    {strip(1)}
    <span className="fixture-status" data-live={fixture?.status === 'live' || undefined}>{status}</span>
  </div>
}

export function FixtureResultCard({ fixture, title }: { fixture: FixtureSnapshot; title: string }) {
  const status = fixtureStatus(fixture)
  return <div className="fixture-result-shell" data-testid="broadcast-graphic">
    <section className="fixture-result-card" aria-label={title}>
      <header><span><i /> Bang On Sports Hub</span><span>{status === 'FT' ? 'Full time' : status}</span></header>
      <div className="result-card-title"><small>{fixture.competition} · {fixture.season}{fixture.round ? ` · Matchweek ${fixture.round}` : ''}</small><h2>{title}</h2></div>
      <div className="result-card-match">
        {[fixture.home, fixture.away].map((team, index) => <div key={team.id} className={`result-card-club club-${index}`} style={teamStyle(team.color, index)}>
          <span aria-hidden="true">{team.shortName}</span><strong>{team.name}</strong>
        </div>)}
        <div className="result-card-score"><strong>{fixture.score?.join(' – ') ?? 'v'}</strong>{fixture.shootout
          ? <span>{fixture.shootout.join(' – ')} on penalties</span>
          : <span>{fixture.status === 'scheduled' && status !== 'VERIFY' ? `${zonedDate.format(new Date(fixture.kickoff))} UK` : status === 'VERIFY' ? 'Awaiting verification' : status}</span>}</div>
      </div>
      <footer><span>{fixture.source.label}</span><span>Fixture data · {fixture.revision}</span></footer>
    </section>
  </div>
}
