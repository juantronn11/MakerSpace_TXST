import { useState, useEffect, useRef } from 'react'
import { updatePrinterStatus } from '../lib/printers'

const DURATIONS = [
  { value: '15',  label: '15 min' },
  { value: '30',  label: '30 min' },
  { value: '60',  label: '1 hr'   },
  { value: '120', label: '2 hr'   },
  { value: '240', label: '4 hr'   },
  { value: '480', label: '8 hr'   },
  { value: 'custom', label: 'Custom' },
]

export default function UpdateModal({ printer, onClose, onSuccess, onError, isDemo }) {
  const [status,       setStatus]       = useState('available')
  const [duration,     setDuration]     = useState('15')
  const [customTime,   setCustomTime]   = useState('')
  const [printerKey,    setPrinterKey]    = useState('')
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [dragging,     setDragging]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const fileRef = useRef(null)

  const open = Boolean(printer)

  // Sync fields when selected printer changes
  useEffect(() => {
    if (printer) {
      setStatus(printer.status || 'available')
      setDuration('15')
      setCustomTime('')
      setPrinterKey(printer.printerKey || '')
      clearPhoto()
    }
  }, [printer?.id])

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFileSelect(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { onError('Photo must be under 5 MB'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = e => setPhotoPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) handleFileSelect(f)
  }

  async function handleSubmit() {
    if (isDemo) { onError('Demo mode — Firebase not configured'); return }
    setSaving(true)
    try {
      let estimatedFinish = null
      if (status === 'in_use') {
        if (duration === 'custom') {
          estimatedFinish = customTime ? new Date(customTime) : null
        } else {
          estimatedFinish = new Date(Date.now() + parseInt(duration) * 60000)
        }
      }
      await updatePrinterStatus(printer.id, { status, estimatedFinish, photoFile, printerKey })
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
                { value: 'available',   label: 'Available',   cls: 'opt-available',   icon: <CheckIcon /> },
                { value: 'in_use',      label: 'In Use',      cls: 'opt-in_use',      icon: <ClockIcon /> },
                { value: 'maintenance', label: 'Down',        cls: 'opt-maintenance', icon: <WarnIcon />  },
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

          {/* Duration (only when In Use) */}
          {status === 'in_use' && (
            <div className="field">
              <label className="field-label">
                Estimated finish <span className="hint">(how long until done?)</span>
              </label>
              <div className="dur-grid">
                {DURATIONS.map(d => (
                  <div
                    key={d.value}
                    className={`dur-opt${duration === d.value ? ' selected' : ''}`}
                    onClick={() => setDuration(d.value)}
                  >
                    <label style={{ cursor: 'pointer' }}>{d.label}</label>
                  </div>
                ))}
              </div>
              {duration === 'custom' && (
                <input
                  type="datetime-local"
                  className="field-input"
                  style={{ marginTop: 10 }}
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Photo upload */}
          <div className="field">
            <label className="field-label">
              Photo <span className="hint">(optional — shows current state)</span>
            </label>

            {photoPreview ? (
              <div className="photo-prev">
                <img src={photoPreview} alt="Preview" />
                <button className="photo-remove" onClick={clearPhoto}>✕</button>
              </div>
            ) : (
              <div
                className={`photo-drop${dragging ? ' drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
                <div className="photo-drop-text">
                  <CameraIcon />
                  <strong>Click to upload</strong> or drag &amp; drop<br />
                  <span style={{ fontSize: '0.77rem' }}>JPG, PNG, WebP · max 5 MB</span>
                </div>
              </div>
            )}
          </div>

          {/* Printer Key — persists across updates */}
          <div className="field">
            <label className="field-label">
              Printer Key <span className="hint">(must match a key in backend/.env → PRINTER_IPS)</span>
            </label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. printer1"
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
function CameraIcon() {
  return (
    <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
      style={{ margin: '0 auto 8px', display: 'block', color: '#94a3b8' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
