import { useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { uid, type Scene } from './domain'
import { mp4Type, webmType, type ExportOptions } from './export'
import { IconButton, Modal } from './ui'

export function SceneSettings({ scene, index, count, onChange, onMove, onDelete, onDuplicate, onTemplate, onClose }: {
  scene: Scene; index: number; count: number; onChange: (value: Scene) => void; onMove: (delta: number) => void;
  onDelete: () => void; onDuplicate: () => void; onTemplate: (value: Scene) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(scene)
  const save = () => {
    if (!draft.name.trim()) return
    onChange({ ...draft, name: draft.name.trim(), duration: Math.min(90, Math.max(1, draft.duration || 8)) })
    onClose()
  }
  return <Modal title="Scene settings" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); save() }}>
      <label className="form-field">Scene name<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <div className="form-row"><label className="form-field">Duration in seconds<input type="number" min="1" max="90" step=".1" value={draft.duration || ''} onChange={event => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
        <label className="form-field">Transition<select value={draft.transition} onChange={event => setDraft({ ...draft, transition: event.target.value as Scene['transition'] })}><option value="cut">Cut</option><option value="fade">Fade</option></select></label></div>
      <label className="form-field">Provenance<select value={draft.classification} onChange={event => setDraft({ ...draft, classification: event.target.value as Scene['classification'] })}><option>HYPOTHETICAL</option><option>RECONSTRUCTED</option><option>VERIFIED</option></select></label>
      <label className="form-field">Source<input required={draft.classification === 'VERIFIED'} placeholder="Source or reconstruction context" value={draft.sourceReference?.label ?? ''} onChange={event => setDraft({ ...draft, sourceReference: { ...draft.sourceReference, label: event.target.value } })} /></label>
      <label className="form-field">Presenter notes<textarea value={draft.notes} rows={3} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      <div className="form-field">Cue order
        {draft.cues.map((cue, i) => <div className="cue-edit" key={cue.id}><input aria-label={`Cue ${i + 1} label`} value={cue.label} onChange={event => setDraft({ ...draft, cues: draft.cues.map((item, index) => index === i ? { ...item, label: event.target.value } : item) })} />
          <input aria-label={`Cue ${i + 1} time`} type="number" min="0" max={draft.duration} step=".1" value={cue.time ?? 0} onChange={event => setDraft({ ...draft, cues: draft.cues.map((item, index) => index === i ? { ...item, time: Number(event.target.value) } : item) })} />
          <IconButton label={`Delete cue ${i + 1}`} onClick={() => setDraft({ ...draft, cues: draft.cues.filter(item => item.id !== cue.id) })}><Trash2 size={15} /></IconButton></div>)}
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
