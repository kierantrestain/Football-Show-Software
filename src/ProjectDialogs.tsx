import { useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { uid, viewNames, type Cue, type PitchView, type Scene } from './domain'
import { mp4Type, webmType, type ExportOptions } from './export'
import { IconButton, Modal } from './ui'

export function SceneSettings({ scene, index, count, onChange, onMove, onDelete, onDuplicate, onTemplate, onClose }: {
  scene: Scene; index: number; count: number; onChange: (value: Scene) => void; onMove: (delta: number) => void;
  onDelete: () => void; onDuplicate: () => void; onTemplate: (value: Scene) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(scene)
  const updateCue = (id: string, patch: Partial<Cue>) => setDraft(current => ({
    ...current, cues: current.cues.map(cue => cue.id === id ? { ...cue, ...patch } : cue),
  }))
  const save = () => {
    if (!draft.name.trim()) return
    const duration = Math.min(600, Math.max(1, draft.duration || 8))
    const cues = draft.cues.map(cue => ({ ...cue, label: cue.label.trim() || 'Untitled cue', time: Math.min(duration, Math.max(0, cue.time ?? 0)) }))
    onChange({ ...draft, name: draft.name.trim(), duration, cues, sourceReference: draft.sourceReference && { ...draft.sourceReference, estimated: draft.classification !== 'VERIFIED' } })
    onClose()
  }
  return <Modal title="Scene settings" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); save() }}>
      <label className="form-field">Scene name<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <div className="form-row"><label className="form-field">Duration in seconds<input type="number" min="1" max="600" step=".1" value={draft.duration || ''} onChange={event => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
        <label className="form-field">Transition<select value={draft.transition} onChange={event => setDraft({ ...draft, transition: event.target.value as Scene['transition'] })}><option value="cut">Cut</option><option value="fade">Fade</option></select></label></div>
      <label className="form-field">Provenance<select value={draft.classification} onChange={event => {
        const classification = event.target.value as Scene['classification']
        setDraft({ ...draft, classification, sourceReference: classification === 'VERIFIED' && draft.sourceReference?.estimated ? undefined : draft.sourceReference })
      }}><option>HYPOTHETICAL</option><option>RECONSTRUCTED</option><option>VERIFIED</option></select></label>
      <label className="form-field">Source<input required={draft.classification === 'VERIFIED'} placeholder="Source or reconstruction context" value={draft.sourceReference?.label ?? ''} onChange={event => setDraft({ ...draft, sourceReference: { ...draft.sourceReference, label: event.target.value } })} /></label>
      <label className="form-field">Presenter notes<textarea value={draft.notes} rows={3} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      <div className="form-field"><strong>Cue order</strong>
        {draft.cues.map((cue, i) => <div className="cue-edit-block" key={cue.id}>
          <div className="cue-edit"><input aria-label={`Cue ${i + 1} label`} value={cue.label} onChange={event => updateCue(cue.id, { label: event.target.value })} />
            <input aria-label={`Cue ${i + 1} time`} type="number" min="0" step=".1" value={cue.time ?? 0} onChange={event => updateCue(cue.id, { time: Number(event.target.value) })} />
            <IconButton label={`Delete cue ${i + 1}`} onClick={() => setDraft({ ...draft, cues: draft.cues.filter(item => item.id !== cue.id) })}><Trash2 size={15} /></IconButton>
          </div>
          <details><summary>Cue actions</summary>
            <div className="cue-action-fields">
              {(['reveal', 'hide'] as const).map(action => <label className="form-field" key={action}>{action === 'reveal' ? 'Reveal layer' : 'Hide layer'}
                <select value={cue[action]?.[0] ?? ''} onChange={event => updateCue(cue.id, { [action]: event.target.value ? [event.target.value] : undefined })}>
                  <option value="">No change</option>{draft.objects.map((object, n) => <option key={object.id} value={object.id}>{object.label || `${object.kind} ${n + 1}`}</option>)}
                </select>
              </label>)}
              <label className="form-field">Highlight player<select value={cue.highlight?.[0] ?? ''} onChange={event => updateCue(cue.id, { highlight: event.target.value ? [event.target.value] : undefined })}>
                <option value="">No change</option>{draft.players.map(player => <option key={player.id} value={player.id}>{player.number} · {player.name}</option>)}
              </select></label>
              <label className="form-field">Camera<select value={cue.view ?? ''} onChange={event => updateCue(cue.id, { view: event.target.value ? event.target.value as PitchView : undefined })}>
                <option value="">No change</option>{Object.entries(viewNames).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
              </select></label>
            </div>
          </details>
        </div>)}
        <button className="button" type="button" onClick={() => setDraft({ ...draft, cues: [...draft.cues, { id: uid(), label: 'New cue', time: 0 }] })}><Plus size={14} /> Add cue</button>
      </div>
      <div className="scene-tools">
        <IconButton label="Move scene earlier" disabled={index <= 0} onClick={() => { onMove(-1); onClose() }}><ArrowUp size={15} /></IconButton>
        <IconButton label="Move scene later" disabled={index >= count - 1} onClick={() => { onMove(1); onClose() }}><ArrowDown size={15} /></IconButton>
        <button className="button" type="button" onClick={() => { onDuplicate(); onClose() }}><Copy size={15} /> Duplicate</button>
        <button className="button" type="button" onClick={() => { onTemplate(draft); onClose() }}><Save size={15} /> Save template</button>
        <IconButton label="Delete scene" disabled={count < 2} onClick={() => { onDelete(); onClose() }}><Trash2 size={15} /></IconButton>
      </div>
      <div className="modal-actions"><button className="button primary" type="submit">Save scene</button></div>
    </form>
  </Modal>
}

export function ExportDialog({ onClose, onExport, onProject, busy }: { onClose: () => void; onExport: (options: ExportOptions) => void; onProject: () => void; busy: number | null }) {
  const [options, setOptions] = useState<ExportOptions>({ format: 'png', orientation: '16:9', size: '1080p', transparent: false })
  return <Modal title="Export production" onClose={onClose}>
    <div className="form-row">
      <label className="form-field">File type<select value={options.format} onChange={event => setOptions({ ...options, format: event.target.value as ExportOptions['format'], transparent: false })}>
        <option value="png">PNG still</option>{webmType() && <option value="webm">WebM animation</option>}{mp4Type() && <option value="mp4">MP4 animation</option>}</select></label>
      <label className="form-field">Resolution<select value={options.size} onChange={event => setOptions({ ...options, size: event.target.value as ExportOptions['size'] })}><option>1080p</option><option>4K</option></select></label>
      <label className="form-field">Frame<select value={options.orientation} onChange={event => setOptions({ ...options, orientation: event.target.value as ExportOptions['orientation'] })}><option>16:9</option><option>9:16</option></select></label>
    </div>
    {options.format === 'png' && <label className="checkbox-row"><input type="checkbox" checked={options.transparent} onChange={event => setOptions({ ...options, transparent: event.target.checked })} /> Transparent overlay</label>}
    {busy !== null && <progress max={1} value={busy} aria-label="Export progress" />}
    <div className="modal-actions"><button className="button" disabled={busy !== null} onClick={onProject}>Project JSON</button><button className="button primary" disabled={busy !== null} onClick={() => onExport(options)}>{busy !== null ? 'Exporting…' : 'Export scene'}</button></div>
  </Modal>
}
