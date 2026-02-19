import { Router } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const router = Router()

// IP map lives entirely in .env — never touches git or Firestore
// Format: PRINTER_IPS={"printer1":"192.168.1.100","printer2":"192.168.1.101"}
function getIpMap() {
  try {
    return JSON.parse(process.env.PRINTER_IPS || '{}')
  } catch {
    console.warn('PRINTER_IPS env var is not valid JSON — live data unavailable')
    return {}
  }
}

// GET /api/printers — list all printers ordered by name
router.get('/', async (_req, res, next) => {
  try {
    const snap = await getFirestore().collection('printers').orderBy('name').get()
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (err) {
    next(err)
  }
})

// GET /api/printers/:id/live — proxy to the printer's cluster API
// IP resolved from PRINTER_IPS env var using the printer's key — never from Firestore
router.get('/:id/live', async (req, res, next) => {
  try {
    const docSnap = await getFirestore().collection('printers').doc(req.params.id).get()
    if (!docSnap.exists) return res.status(404).json({ error: 'Printer not found' })

    const data      = docSnap.data()
    const printerIp = getIpMap()[data.printerKey]

    if (!data.printerKey) return res.json({ live: false, reason: 'no_key' })
    if (!printerIp)       return res.json({ live: false, reason: 'key_not_in_env' })

    const base       = `http://${printerIp}/cluster-api/v1`
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 5000)

    let jobsJson, printersJson
    try {
      const [jobsRes, printersRes] = await Promise.all([
        fetch(`${base}/print_jobs`, { signal: controller.signal }),
        fetch(`${base}/printers`,   { signal: controller.signal }),
      ])
      clearTimeout(timeout)
      jobsJson     = await jobsRes.json()
      printersJson = await printersRes.json()
    } catch (fetchErr) {
      clearTimeout(timeout)
      const reason = fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message
      return res.json({ live: false, reason })
    }

    // Normalize job data
    const activeJob = jobsJson.find(j => j.status === 'printing') ?? jobsJson[0] ?? null
    const job = activeJob ? {
      name:            activeJob.name          ?? 'Unknown job',
      status:          activeJob.status        ?? 'unknown',
      timeElapsed:     activeJob.time_elapsed  ?? 0,
      timeTotal:       activeJob.time_total    ?? 0,
      timeRemaining:   Math.max(0, (activeJob.time_total ?? 0) - (activeJob.time_elapsed ?? 0)),
      percentComplete: activeJob.time_total > 0
        ? Math.min(100, Math.round((activeJob.time_elapsed / activeJob.time_total) * 100))
        : 0,
    } : null

    // Normalize printer status → our status vocabulary
    const rawStatus = printersJson[0]?.status ?? 'idle'
    const liveStatus =
      rawStatus === 'idle'        ? 'available'   :
      rawStatus === 'error'       ? 'maintenance'  :
      rawStatus === 'maintenance' ? 'maintenance'  : 'in_use'

    // Auto-sync Firestore if status drifted
    if (liveStatus !== data.status) {
      const update = {
        status:      liveStatus,
        lastUpdated: FieldValue.serverTimestamp(),
      }
      if (liveStatus === 'in_use' && job?.timeRemaining) {
        update.estimatedFinish = new Date(Date.now() + job.timeRemaining * 1000)
      } else {
        update.estimatedFinish = null
      }
      await getFirestore().collection('printers').doc(req.params.id).update(update)
    }

    res.json({ live: true, printerStatus: rawStatus, job })
  } catch (err) {
    next(err)
  }
})

// GET /api/printers/:id — single printer
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await getFirestore().collection('printers').doc(req.params.id).get()
    if (!doc.exists) return res.status(404).json({ error: 'Printer not found' })
    res.json({ id: doc.id, ...doc.data() })
  } catch (err) {
    next(err)
  }
})

// POST /api/printers — add a printer (printerKey is a non-sensitive alias, not the real IP)
router.post('/', async (req, res, next) => {
  try {
    const { name, printerKey } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
    const ref = await getFirestore().collection('printers').add({
      name:            name.trim(),
      printerKey:      printerKey?.trim() || null,
      status:          'available',
      estimatedFinish: null,
      photoUrl:        null,
      lastUpdated:     FieldValue.serverTimestamp(),
    })
    res.status(201).json({ id: ref.id })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/printers/:id — update status, finish time, photo, or key alias
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, estimatedFinish, photoUrl, printerKey } = req.body
    const update = { lastUpdated: FieldValue.serverTimestamp() }
    if (status          !== undefined) update.status          = status
    if (estimatedFinish !== undefined) update.estimatedFinish = estimatedFinish ? new Date(estimatedFinish) : null
    if (photoUrl        !== undefined) update.photoUrl        = photoUrl
    if (printerKey      !== undefined) update.printerKey      = printerKey?.trim() || null
    await getFirestore().collection('printers').doc(req.params.id).update(update)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/printers/:id — remove a printer
router.delete('/:id', async (req, res, next) => {
  try {
    await getFirestore().collection('printers').doc(req.params.id).delete()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
