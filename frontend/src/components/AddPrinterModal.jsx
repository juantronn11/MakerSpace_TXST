import { useState } from 'react'
import { addPrinter } from '../lib/printers'

export default function AddPrinterModal({ open, onClose, onSuccess, onError, isDemo }) {
  const [name,      setName]      = useState('')
  const [printerKey, setPrinterKey] = useState('')
  const [saving,    setSaving]    = useState(false)

  function handleClose() {
    setName('')
    setPrinterKey('')
    onClose()
  }

  async function handleSubmit() {
    if (isDemo) { onError('Demo mode — Firebase not configured'); return }
    const trimmed = name.trim()
    if (!trimmed) { onError('Please enter a printer name'); return }
    setSaving(true)
    try {
      await addPrinter(trimmed, printerKey)
      onSuccess(`"${trimmed}" added!`)
      handleClose()
    } catch (err) {
      onError('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') handleClose()
  }

  return (
    <div
      className={`overlay${open ? ' open' : ''}`}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>Add New Printer</h2>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="newPrinterName">Printer Name</label>
            <input
              id="newPrinterName"
              type="text"
              className="field-input"
              placeholder="e.g. Printer 3 — Bambu X1C"
              maxLength={60}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="newPrinterKey">
              Printer Key <span className="hint">(optional — enables live status)</span>
            </label>
            <input
              id="newPrinterKey"
              type="text"
              className="field-input"
              placeholder="e.g. printer1"
              value={printerKey}
              onChange={e => setPrinterKey(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 5 }}>
              Match this key to an entry in <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>backend/.env → PRINTER_IPS</code> to enable live status.
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={handleClose}>Cancel</button>
            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
              {saving ? <><span className="spinner-sm" /> Adding…</> : 'Add Printer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
