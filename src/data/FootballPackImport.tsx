import { useState } from 'react'
import { FileUp } from 'lucide-react'
import { previewFootballPack, publishFootballPack } from './footballDataset'

export function FootballPackImport() {
  const [preview, setPreview] = useState<ReturnType<typeof previewFootballPack>>()
  const [authorised, setAuthorised] = useState(false)
  const [message, setMessage] = useState('')
  return <details className="desk-panel football-import">
    <summary><FileUp size={16} /> Import authorised football records</summary>
    <div className="desk-stack">
      <p>Import a versioned JSON pack with a source, verification date and usage permission. Review it before replacing the current imported revision.</p>
      <label className="desk-field">Football data pack<input type="file" accept=".json,application/json" onChange={async event => {
        const file = event.currentTarget.files?.[0]
        setPreview(undefined)
        setAuthorised(false)
        setMessage('')
        if (!file) return
        try {
          if (file.size > 4 * 1024 * 1024) throw new Error('The pack exceeds 4 MB.')
          setPreview(previewFootballPack(JSON.parse(await file.text())))
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read the pack.') }
      }} /></label>
      {preview && <section aria-label="Football data import preview">
        <strong>{preview.pack.revision}</strong>
        <p>{preview.pack.fixtures.length} fixtures · {preview.pack.players.length} identities · {preview.pack.registrations.length} registrations · {preview.pack.lineups.length} matchday XIs · {preview.pack.events.length} events · {preview.pack.metrics.length} statistics rows</p>
        <p>0 duplicate keys · 0 missing required fields · {preview.missingShirtNumbers} unknown shirt numbers · {preview.differences.length} fixture changes</p>
        {preview.replaces && <p>Replaces imported revision {preview.replaces}. The previous valid revision will be retained.</p>}
        <p>{preview.pack.source.label} · {preview.pack.source.permission} · <a href={preview.pack.source.url} target="_blank" rel="noreferrer">Source record</a></p>
        {preview.differences.length > 0 && <details><summary>Inspect changes</summary><ul>{preview.differences.map(row => <li key={row.id}>{row.text}</li>)}</ul></details>}
        <label className="desk-toggle"><input type="checkbox" checked={authorised} onChange={event => setAuthorised(event.target.checked)} /> I am authorised to use these records in the studio.</label>
        <button type="button" className="desk-primary" disabled={!authorised} onClick={() => {
          try {
            publishFootballPack(preview.pack)
            setMessage('Published revision ' + preview.pack.revision + ' in this browser.')
            setPreview(undefined)
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not publish the pack.') }
        }}>Publish verified pack</button>
      </section>}
      {message && <p role="status">{message}</p>}
    </div>
  </details>
}
