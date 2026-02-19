import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, isConfigured } from './lib/firebase'
import Header from './components/Header'
import PrinterCard from './components/PrinterCard'
import UpdateModal from './components/UpdateModal'
import AddPrinterModal from './components/AddPrinterModal'
import Toast from './components/Toast'

const DEMO_PRINTERS = [
  { id: 'd1', name: 'Printer 1 — Bambu X1C',     status: 'available',   photoUrl: null, estimatedFinish: null,                          lastUpdated: new Date(Date.now() - 5  * 60000)  },
  { id: 'd2', name: 'Printer 2 — Prusa MK4',      status: 'in_use',      photoUrl: null, estimatedFinish: new Date(Date.now() + 42 * 60000), lastUpdated: new Date(Date.now() - 10 * 60000)  },
  { id: 'd3', name: 'Printer 3 — Ender 3 Pro',    status: 'maintenance', photoUrl: null, estimatedFinish: null,                          lastUpdated: new Date(Date.now() - 2  * 3600000) },
  { id: 'd4', name: 'Printer 4 — Bambu P1S',      status: 'available',   photoUrl: null, estimatedFinish: null,                          lastUpdated: new Date(Date.now() - 20 * 60000)  },
  { id: 'd5', name: 'Printer 5 — Raise3D Pro3',   status: 'in_use',      photoUrl: null, estimatedFinish: new Date(Date.now() - 8  * 60000),  lastUpdated: new Date(Date.now() - 90 * 60000)  },
]

export default function App() {
  const [printers,      setPrinters]      = useState([])
  const [toasts,        setToasts]        = useState([])
  const [updateTarget,  setUpdateTarget]  = useState(null) // printer object or null
  const [addOpen,       setAddOpen]       = useState(false)
  const [, setTick] = useState(0) // forces re-render for "likely available" recalc

  // Firebase listener or demo data
  useEffect(() => {
    if (!isConfigured) {
      setPrinters(DEMO_PRINTERS)
      return
    }
    const q = query(collection(db, 'printers'), orderBy('name'))
    return onSnapshot(q, snap => {
      setPrinters(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        estimatedFinish: d.data().estimatedFinish?.toDate?.() ?? null,
        lastUpdated:     d.data().lastUpdated?.toDate?.() ?? null,
      })))
    }, err => addToast('Error loading printers: ' + err.message, 'err'))
  }, [])

  // Re-render every minute so "likely available" status auto-updates
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  function addToast(msg, type = '') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  return (
    <>
      <Header
        printers={printers}
        isDemo={!isConfigured}
        onAddPrinter={() => setAddOpen(true)}
      />

      <main className="main">
        <div className="section-header">
          <span className="section-label">All Printers</span>
        </div>

        {printers.length === 0 ? (
          <div className="printer-grid">
            <div className="empty-state">
              <svg fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <h3>No printers yet</h3>
              <p>Click "Add Printer" in the header to get started.</p>
            </div>
          </div>
        ) : (
          <div className="printer-grid">
            {printers.map(p => (
              <PrinterCard
                key={p.id}
                printer={p}
                onUpdate={() => setUpdateTarget(p)}
              />
            ))}
          </div>
        )}
      </main>

      <UpdateModal
        printer={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onSuccess={msg => addToast(msg, 'ok')}
        onError={msg => addToast(msg, 'err')}
        isDemo={!isConfigured}
      />

      <AddPrinterModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={msg => addToast(msg, 'ok')}
        onError={msg => addToast(msg, 'err')}
        isDemo={!isConfigured}
      />

      <Toast toasts={toasts} />
    </>
  )
}
