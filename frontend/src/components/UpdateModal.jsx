import { useState, useEffect } from 'react'
import { updatePrinterStatus } from '../lib/printers'

export default function UpdateModal({ printer, onClose, onSuccess, onError, isDemo }) {
  const [status,      setStatus]      = useState('available')
  const [customDays,  setCustomDays]  = useState('')
  const [customHours, setCustomHours] = useState('')
  const [customMins,  setCustomMins]  = useState('')
  const [printerKey,  setPrinterKey]  = useState('')
  const [saving,      setSaving]      = useState(false)

  const open = Boolean(printer)

  // Sync fields when selected printer changes
  useEffect(() => {
    if (printer) {
      setStatus(printer.status || 'available')
      setCustomDays('')
      setCustomHours('')
      setCustomMins('')
      setPrinterKey(printer.printerKey || '')
    }
  }, [printer?.id])

  async function handleSubmit() {
    if (isDemo) { onError('Demo mode — Firebase not configured'); return }
    setSaving(true)
    try {
      let estimatedFinish = null
      if (status === 'in_use') {
        const d    = parseInt(customDays)  || 0
        const h    = parseInt(customHours) || 0
        const m    = parseInt(customMins)  || 0
        const mins = d * 1440 + h * 60 + m
        estimatedFinish = mins > 0 ? new Date(Date.now() + mins * 60000) : null
      }
      await updatePrinterStatus(printer.id, { status, estimatedFinish, printerKey })
      onSuccess('Status updated!')
      onClose()
    } catch (err) {
      onError('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>Update Printer Status</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {printer && (
            <div className="field">
              <div className="field-label">Printer</div>
              <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{printer.name}</div>
            </div>
          )}

          {/* Status selector */}
          <div className="field">
            <label className="field-label">Status</label>
            <div className="status-grid">
              {[
                { value: 'available',   label: 'Available', cls: 'opt-available',   icon: <CheckIcon /> },
                { value: 'in_use',      label: 'In Use',    cls: 'opt-in_use',      icon: <ClockIcon /> },
                { value: 'maintenance', label: 'Down',      cls: 'opt-maintenance', icon: <WarnIcon />  },
              ].map(opt => (
                <div
                  key={opt.value}
                  className={`status-opt ${opt.cls}${status === opt.value ? ' selected' : ''}`}
                  onClick={() => setStatus(opt.value)}
                >
                  <label style={{ cursor: 'pointer' }}>
                    {opt.icon}
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Time remaining (only when In Use) */}
          {status === 'in_use' && (
            <div className="field">
              <label className="field-label">
                Time remaining <span className="hint">(countdown shown to all users)</span>
              </label>
              <div className="custom-dhm-row">
                <div className="custom-dhm-field">
                  <input
                    type="number" className="field-input" min="0" max="30"
                    placeholder="0" value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                  />
                  <span className="custom-dhm-label">days</span>
                </div>
                <div className="custom-dhm-field">
                  <input
                    type="number" className="field-input" min="0" max="23"
                    placeholder="0" value={customHours}
                    onChange={e => setCustomHours(e.target.value)}
                  />
                  <span className="custom-dhm-label">hours</span>
                </div>
                <div className="custom-dhm-field">
                  <input
                    type="number" className="field-input" min="0" max="59"
                    placeholder="0" value={customMins}
                    onChange={e => setCustomMins(e.target.value)}
                  />
                  <span className="custom-dhm-label">min</span>
                </div>
              </div>
            </div>
          )}

          {/* Printer Key */}
          <div className="field">
            <label className="field-label">
              Printer Key <span className="hint">(links to live API data)</span>
            </label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. ums5-1"
              value={printerKey}
              onChange={e => setPrinterKey(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
              {saving ? <><span className="spinner-sm" /> Saving…</> : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 3" />
    </svg>
  )
}
function WarnIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}
