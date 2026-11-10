import { useState } from 'react'
import { ArrowUpRight, CalendarClock, ChevronRight, ListOrdered, Lock, Plus, Save } from 'lucide-react'
import { demoPanel, demoPredictions, demoSource } from './fixtures'
import { TeamMark, matchGraphic } from './graphics'
import { displayDate, predictionCutoff, predictionPoints, scoreText } from './model'
import type { GraphicSpec, Match, Panelist, Prediction, PredictionRules } from './model'

type PredictionStore = {
  panel: Panelist[]
  predictions: Prediction[]
  rules: PredictionRules
  demoResults: Record<string, [number, number]>
}
const storageKey = 'football-studio:predictions:v1'
const defaultStore: PredictionStore = { panel: demoPanel, predictions: demoPredictions, rules: { exact: 3, result: 1, cutoffMinutes: 0 }, demoResults: {} }
function readStore() {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? { ...defaultStore, ...JSON.parse(raw) } as PredictionStore : defaultStore
  } catch {
    return defaultStore
  }
}
function usePredictionStore() {
  const [store, setStore] = useState(readStore)
  const [storageError, setStorageError] = useState(false)
  return { store, storageError, update: (next: PredictionStore) => {
    setStore(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false) } catch { setStorageError(true) }
  } }
}
function isScore(value: string) {
  return /^\d{1,2}$/.test(value)
}
function verifiedResult(match: Match) {
  return match.status === 'finished' && (match.source.kind === 'demo' || match.verification?.status === 'verified') ? match.score : undefined
}
export function PredictionDesk({ matches, onQueueGraphic, producer = false }: { matches: Match[]; onQueueGraphic: (graphic: GraphicSpec) => void; producer?: boolean }) {
  const { store, storageError, update } = usePredictionStore()
  const matchList = matches
  const startingMatch = matchList.find(match => match.status === 'scheduled') || matchList[0]
  const startingPick = store.predictions.find(pick => pick.matchId === startingMatch.id && pick.panelistId === store.panel[0]?.id)
  const [fixture, setFixture] = useState(startingMatch.id)
  const [panelist, setPanelist] = useState(store.panel[0]?.id || '')
  const [addName, setAddName] = useState('')
  const [home, setHome] = useState(startingPick ? String(startingPick.home) : '')
  const [away, setAway] = useState(startingPick ? String(startingPick.away) : '')
  const [notes, setNotes] = useState(startingPick?.notes || '')
  const [actualHome, setActualHome] = useState('')
  const [actualAway, setActualAway] = useState('')
  const [status, setStatus] = useState('')
  const [override, setOverride] = useState(false)
  const active = matchList.find(match => match.id === fixture) || startingMatch
  const stored = store.predictions.find(pick => pick.matchId === active.id && pick.panelistId === panelist)
  const actualScore = verifiedResult(active) || (active.source.kind === 'demo' ? store.demoResults[active.id] : undefined)
  const cutoff = predictionCutoff(active.kickoff, store.rules)
  const closed = Date.now() >= cutoff.getTime() || active.status !== 'scheduled' || !!actualScore
  const canEdit = !closed || (producer && override)
  const loadPick = (fixtureId: string, panelistId: string) => {
    const pick = store.predictions.find(item => item.matchId === fixtureId && item.panelistId === panelistId)
    setHome(pick ? String(pick.home) : '')
    setAway(pick ? String(pick.away) : '')
    setNotes(pick?.notes || '')
    setStatus('')
    setOverride(false)
  }
  const scoreByMatch = new Map(matchList.filter(match => match.season === active.season).map(match => [match.id, verifiedResult(match) || (match.source.kind === 'demo' ? store.demoResults[match.id] : undefined)]))
  const leaderboard = store.panel.map(person => {
    const submitted = store.predictions.filter(pick => pick.panelistId === person.id && scoreByMatch.has(pick.matchId))
    const settled = submitted.flatMap(pick => {
      const actual = scoreByMatch.get(pick.matchId)
      return actual ? [{ points: predictionPoints(pick, actual, store.rules), exact: pick.home === actual[0] && pick.away === actual[1] }] : []
    })
    return { person, points: settled.reduce((total, pick) => total + pick.points, 0), exact: settled.filter(pick => pick.exact).length, submitted: submitted.length }
  }).sort((a, b) => b.points - a.points || b.exact - a.exact || a.person.name.localeCompare(b.person.name))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if ((!canEdit || Date.now() >= cutoff.getTime()) && !(producer && override)) {
      setStatus('This fixture is closed to predictions.')
      return
    }
    if (!panelist || !isScore(home) || !isScore(away)) return
    const prediction = { panelistId: panelist, matchId: active.id, home: Number(home), away: Number(away), notes: notes.trim(), submittedAt: new Date().toISOString() }
    update({ ...store, predictions: [...store.predictions.filter(pick => pick.matchId !== active.id || pick.panelistId !== panelist), prediction] })
    setStatus('Prediction saved')
  }
  return <div className="data-prediction-layout">
    <section className="desk-panel">
      <div className="desk-panel-head"><div><span className="desk-eyebrow"><CalendarClock size={14} /> WEEKLY PANEL</span><h2>Score predictions</h2></div><span className={closed ? 'desk-indicator' : 'desk-indicator ready'}>{closed ? <><Lock size={12} /> Closed</> : 'Open'}</span></div>
      <div className="desk-stack">
        <label className="desk-field">Fixture<select value={active.id} onChange={event => { setFixture(event.target.value); loadPick(event.target.value, panelist); setActualHome(''); setActualAway('') }}>{matchList.map(match => <option key={match.id} value={match.id}>{match.home.name} v {match.away.name} · {displayDate(match.kickoff)}</option>)}</select></label>
        <div className="prediction-match-band"><TeamMark team={active.home} /><b>{active.home.name}</b><strong>{scoreText(actualScore)}</strong><b>{active.away.name}</b><TeamMark team={active.away} /></div>
        <form className="desk-stack" onSubmit={submit}>
          <label className="desk-field">Panel member<select value={panelist} onChange={event => { setPanelist(event.target.value); loadPick(active.id, event.target.value) }}>{store.panel.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <div className="desk-field-row">
            <label className="desk-field">Home score<input type="number" min="0" max="99" required value={home} onChange={event => setHome(event.target.value)} disabled={!canEdit} /></label>
            <label className="desk-field">Away score<input type="number" min="0" max="99" required value={away} onChange={event => setAway(event.target.value)} disabled={!canEdit} /></label>
          </div>
          <label className="desk-field">Panel notes<textarea rows={2} maxLength={350} value={notes} onChange={event => setNotes(event.target.value)} disabled={!canEdit} /></label>
          {closed && producer && <label className="desk-toggle"><input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} /> Producer cutoff override</label>}
          <div className="desk-action-row prediction-actions"><span>{isScore(home) && isScore(away) ? Number(home) === Number(away) ? 'Draw predicted' : `${Number(home) > Number(away) ? active.home.name : active.away.name} to win` : `Cutoff · ${displayDate(cutoff.toISOString(), true)}`}</span><button className="desk-primary" type="submit" disabled={!canEdit || !isScore(home) || !isScore(away)}><Save size={15} /> Save prediction</button></div>
        </form>
        <div className="desk-inline-form"><input aria-label="New panel member" placeholder="New panel member" maxLength={35} value={addName} onChange={event => setAddName(event.target.value)} /><button className="desk-secondary" type="button" disabled={!addName.trim() || store.panel.some(person => person.name.toLowerCase() === addName.trim().toLowerCase())} onClick={() => {
          const newPanelist = { id: `panel-${Date.now()}`, name: addName.trim() }
          update({ ...store, panel: [...store.panel, newPanelist] })
          setPanelist(newPanelist.id)
          loadPick(active.id, newPanelist.id)
          setAddName('')
        }}><Plus size={15} /> Add</button></div>
        {stored && <div className="desk-action-row prediction-actions"><span>Submitted {displayDate(stored.submittedAt, true)}{actualScore ? ` · ${predictionPoints(stored, actualScore, store.rules)} pts` : ''}</span><button className="desk-secondary" type="button" onClick={() => {
          onQueueGraphic({ ...matchGraphic(active, 'prediction'), title: 'Panel prediction', subtitle: `${store.panel.find(person => person.id === panelist)?.name || 'Panel'} · ${active.competition}`, source: `Prediction · ${active.source.label}`, detail: 'Predicted score', score: [stored.home, stored.away] })
          setStatus('Prediction added to preview')
        }}>Queue prediction <ArrowUpRight size={14} /></button></div>}
        <div role="status" className="desk-status-line">{storageError ? 'Browser storage could not save the latest change.' : status}</div>
      </div>
    </section>
    <section className="desk-panel">
      <div className="desk-panel-head"><div><span className="desk-eyebrow"><ListOrdered size={14} /> SEASON STANDINGS</span><h2>Panel leaderboard</h2></div><span className="desk-indicator">{active.season}</span></div>
      <table className="desk-table prediction-leaderboard"><thead><tr><th scope="col">Rank</th><th scope="col">Panelist</th><th scope="col">Picks</th><th scope="col">Exact</th><th scope="col">Points</th></tr></thead><tbody>{leaderboard.map((row, index) => <tr key={row.person.id}><td>{String(index + 1).padStart(2, '0')}</td><th scope="row">{row.person.name}</th><td>{row.submitted}</td><td>{row.exact}</td><td>{row.points}</td></tr>)}</tbody></table>
      <div className="desk-stack">
        <details className="prediction-settings">
          <summary><ChevronRight size={15} /> Scoring rules</summary>
          <div className="desk-field-row">
            <label className="desk-field">Exact score points<input type="number" min="0" max="99" value={store.rules.exact} onChange={event => update({ ...store, rules: { ...store.rules, exact: Math.min(99, Math.max(0, Math.round(Number(event.target.value)))) } })} /></label>
            <label className="desk-field">Correct result points<input type="number" min="0" max="99" value={store.rules.result} onChange={event => update({ ...store, rules: { ...store.rules, result: Math.min(99, Math.max(0, Math.round(Number(event.target.value)))) } })} /></label>
            <label className="desk-field">Cutoff minutes before kick-off<input type="number" min="0" max="1440" value={store.rules.cutoffMinutes} onChange={event => update({ ...store, rules: { ...store.rules, cutoffMinutes: Math.min(1440, Math.max(0, Math.round(Number(event.target.value)))) } })} /></label>
          </div>
        </details>
        {active.source.kind === 'demo' && active.status === 'scheduled' && <details className="prediction-settings">
          <summary><ChevronRight size={15} /> Enter a fictional result</summary>
          <form className="desk-field-row" onSubmit={event => {
            event.preventDefault()
            if (!isScore(actualHome) || !isScore(actualAway)) return
            update({ ...store, demoResults: { ...store.demoResults, [active.id]: [Number(actualHome), Number(actualAway)] } })
            setStatus('Fictional result saved. Standings recalculated.')
          }}>
            <label className="desk-field">Actual home<input type="number" min="0" max="99" value={actualHome} onChange={event => setActualHome(event.target.value)} /></label>
            <label className="desk-field">Actual away<input type="number" min="0" max="99" value={actualAway} onChange={event => setActualAway(event.target.value)} /></label>
            <button className="desk-secondary" type="submit" disabled={!isScore(actualHome) || !isScore(actualAway)}>Set result</button>
          </form>
        </details>}
      </div>
      <div className="desk-action-row"><span>{active.source.kind === 'demo' ? demoSource.label : active.source.label}</span><button className="desk-primary" type="button" onClick={() => {
        onQueueGraphic({ id: `leaderboard-${Date.now()}`, kind: 'leaderboard', title: 'Panel leaderboard', subtitle: `Score predictions · ${active.season}`, source: active.source.kind === 'demo' ? demoSource.label : `Panel predictions · results from ${active.source.label}`, rows: leaderboard.slice(0, 7).map(row => ({ label: row.person.name, value: `${row.points} pts`, detail: `${row.exact} exact` })) })
        setStatus('Leaderboard added to preview')
      }}>Queue leaderboard <ArrowUpRight size={16} /></button></div>
    </section>
  </div>
}
