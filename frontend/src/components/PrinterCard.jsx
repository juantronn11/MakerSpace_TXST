import { useState, useEffect } from 'react'
import { effectiveStatus, timeInfo, timeAgo } from '../lib/utils'
import { fetchLiveStatus } from '../lib/printers'

const STATUS_LABEL = {
  available:   'Available',
  in_use:      'In Use',
  maintenance: 'Down',
  likely:      'Likely Free',
}

export default function PrinterCard({ printer, onUpdate }) {
  const [live, setLive] = useState(null) // null = not yet fetched

  // Poll the live endpoint every 30s when an IP is configured
  useEffect(() => {
    if (!printer.printerKey) { setLive(null); return }

    let cancelled = false

    async function poll() {
      try {
        const data = await fetchLiveStatus(printer.id)
        if (!cancelled) setLive(data)
      } catch {
        if (!cancelled) setLive({ live: false, reason: 'fetch_error' })
      }
    }

    poll()
    const t = setInterval(poll, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [printer.id, printer.printerKey])

  const now      = new Date()
  const eff      = effectiveStatus(printer, now)
  const liveJob  = live?.live && live.job ? live.job : null
  const isLive   = live?.live === true

  const timeDisplay = liveJob ? formatLiveTime(liveJob) : timeInfo(printer, now)

  return (
    <div className="printer-card" onClick={onUpdate}>
      <div className="card-photo">
        {printer.photoUrl ? (
          <img src={printer.photoUrl} alt={printer.name} loading="lazy" />
        ) : (
          <div className="photo-placeholder">
            <svg width="52" height="52" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span>No photo</span>
          </div>
        )}
        <span className={`status-badge s-${eff}`}>{STATUS_LABEL[eff]}</span>

        {/* Live indicator — only shown when an IP is set */}
        {printer.printerKey && (
          <span
            className={`live-dot ${isLive ? 'live-dot--on' : 'live-dot--off'}`}
            title={isLive ? 'Live data from printer' : `Printer unreachable (${live?.reason ?? 'connecting…'})`}
          />
        )}
      </div>

      <div className="card-body">
        <div className="card-name">{printer.name}</div>

        {/* Live job info */}
        {liveJob && (
          <div className="live-job">
            <div className="job-name" title={liveJob.name}>📄 {liveJob.name}</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${liveJob.percentComplete}%` }} />
            </div>
            <div className="progress-label">{liveJob.percentComplete}% complete</div>
          </div>
        )}

        <div className="card-time">{timeDisplay}</div>

        <button className="update-btn" onClick={e => { e.stopPropagation(); onUpdate() }}>
          Update Status
        </button>

        {printer.lastUpdated && (
          <div className="card-updated">Updated {timeAgo(printer.lastUpdated)}</div>
        )}
      </div>
    </div>
  )
}

function formatLiveTime(job) {
  if (job.timeRemaining <= 0) return '⏰ Print likely complete'
  const mins = Math.ceil(job.timeRemaining / 60)
  return mins > 60
    ? `⏱ ~${(job.timeRemaining / 3600).toFixed(1)}h remaining · live`
    : `⏱ ~${mins} min remaining · live`
}
