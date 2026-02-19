import { statsFrom } from '../lib/utils'

export default function Header({ printers, isDemo, onAddPrinter }) {
  const { available, inUse, maintenance } = statsFrom(printers)

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="header-top">
            <div className="header-title">
              <h1>MakerSpace <span className="accent">3D Printers</span></h1>
              <p>Real-time availability — updated by students &amp; staff</p>
            </div>
            <div>
              <button className="btn btn-ghost" onClick={onAddPrinter}>+ Add Printer</button>
            </div>
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <div className="stat-dot" style={{ background: 'var(--available)' }} />
              <span className="stat-count">{available}</span> Available
            </div>
            <div className="stat-item">
              <div className="stat-dot" style={{ background: 'var(--in-use)' }} />
              <span className="stat-count">{inUse}</span> In Use
            </div>
            <div className="stat-item">
              <div className="stat-dot" style={{ background: 'var(--maintenance)' }} />
              <span className="stat-count">{maintenance}</span> Down
            </div>
          </div>
        </div>
      </header>

      {isDemo && (
        <div className="setup-banner">
          ⚠️ <strong>Firebase not configured — showing demo data.</strong>{' '}
          <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
            Create a Firebase project
          </a>
          , copy <code>frontend/.env.example</code> to <code>frontend/.env</code>, and fill in your values.
        </div>
      )}
    </>
  )
}
