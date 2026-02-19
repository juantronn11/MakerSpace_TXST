import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { isConfigured as cloudConfigured, fetchCloudStatus } from '../lib/ultimaker.js'
import { requireApiKey } from '../middleware/auth.js'

const router = Router()

// ── Constants ────────────────────────────────────────────────────────────────
const VALID_STATUSES = new Set(['available', 'in_use', 'maintenance'])
const MAX_NAME_LEN   = 80
const MAX_KEY_LEN    = 60
const MAX_URL_LEN    = 500
const ID_RE          = /^[a-zA-Z0-9_-]{1,128}$/

// ── Helpers ──────────────────────────────────────────────────────────────────
function getIpMap() {
  try {
    return JSON.parse(process.env.PRINTER_IPS || '{}')
  } catch {
    console.warn('PRINTER_IPS env var is not valid JSON — live data unavailable')
    return {}
  }
}

function validateId(req, res) {
  if (!ID_RE.test(req.params.id)) {
    res.status(400).json({ error: 'Invalid printer ID' })
    return false
  }
  return true
}

// ── Live endpoint: stricter rate limit + 30-second in-memory cache ───────────
const liveLimiter = rateLimit({
  windowMs:        30 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many live requests, slow down.' },
})

const liveCache = new Map()
const LIVE_TTL  = 30_000

function getCached(id)      { const e = liveCache.get(id); return e && Date.now() < e.expiresAt ? e.data : null }
function setCache(id, data) { liveCache.set(id, { data, expiresAt: Date.now() + LIVE_TTL }) }

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/printers
router.get('/', async (_req, res, next) => {
  try {
    const snap = await getFirestore().collection('printers').orderBy('name').get()
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (err) { next(err) }
})

// GET /api/printers/:id
router.get('/:id', async (req, res, next) => {
  if (!validateId(req, res)) return
  try {
    const doc = await getFirestore().collection('printers').doc(req.params.id).get()
    if (!doc.exists) return res.status(404).json({ error: 'Printer not found' })
    res.json({ id: doc.id, ...doc.data() })
  } catch (err) { next(err) }
})

// GET /api/printers/:id/live
router.get('/:id/live', liveLimiter, async (req, res, next) => {
  if (!validateId(req, res)) return
  try {
    const cached = getCached(req.params.id)
    if (cached) return res.json(cached)

    const docSnap = await getFirestore().collection('printers').doc(req.params.id).get()
    if (!docSnap.exists) return res.status(404).json({ error: 'Printer not found' })

    const data = docSnap.data()
    if (!data.printerKey) {
      const r = { live: false, reason: 'no_key' }
      setCache(req.params.id, r)
      return res.json(r)
    }

    let rawStatus, job

    // ── Path A: Ultimaker Digital Factory cloud API ───────────────────────
    if (cloudConfigured()) {
      try {
        const cloud = await fetchCloudStatus(data.printerKey)
        rawStatus   = cloud.printerStatus
        job         = cloud.job
      } catch (cloudErr) {
        console.warn('Digital Factory API error:', cloudErr.message)
        const r = { live: false, reason: 'cloud_error' }
        setCache(req.params.id, r)
        return res.json(r)
      }
    }

    // ── Path B: Direct local-network IP ──────────────────────────────────
    else {
      const printerIp = getIpMap()[data.printerKey]
      if (!printerIp) {
        const r = { live: false, reason: 'key_not_in_env' }
        setCache(req.params.id, r)
        return res.json(r)
      }

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
        const reason = fetchErr.name === 'AbortError' ? 'timeout' : 'unreachable'
        const r = { live: false, reason }
        setCache(req.params.id, r)
        return res.json(r)
      }

      rawStatus = printersJson[0]?.status ?? 'idle'
      const activeJob = jobsJson.find(j => j.status === 'printing') ?? jobsJson[0] ?? null
      job = activeJob ? {
        name:            activeJob.name          ?? 'Unknown job',
        status:          activeJob.status        ?? 'unknown',
        timeElapsed:     activeJob.time_elapsed  ?? 0,
        timeTotal:       activeJob.time_total    ?? 0,
        timeRemaining:   Math.max(0, (activeJob.time_total ?? 0) - (activeJob.time_elapsed ?? 0)),
        percentComplete: activeJob.time_total > 0
          ? Math.min(100, Math.round((activeJob.time_elapsed / activeJob.time_total) * 100))
          : 0,
      } : null
    }

    // ── Normalize + auto-sync Firestore ──────────────────────────────────
    const liveStatus =
      rawStatus === 'idle'        ? 'available'  :
      rawStatus === 'error'       ? 'maintenance' :
      rawStatus === 'maintenance' ? 'maintenance' : 'in_use'

    if (liveStatus !== data.status) {
      const update = {
        status:          liveStatus,
        lastUpdated:     FieldValue.serverTimestamp(),
        estimatedFinish: (liveStatus === 'in_use' && job?.timeRemaining)
          ? new Date(Date.now() + job.timeRemaining * 1000)
          : null,
      }
      await getFirestore().collection('printers').doc(req.params.id).update(update)
    }

    const r = { live: true, printerStatus: rawStatus, job }
    setCache(req.params.id, r)
    res.json(r)
  } catch (err) { next(err) }
})

// POST /api/printers  [auth required]
router.post('/', requireApiKey, async (req, res, next) => {
  try {
    const name       = String(req.body.name       ?? '').trim()
    const printerKey = String(req.body.printerKey ?? '').trim()

    if (!name)                          return res.status(400).json({ error: 'name is required' })
    if (name.length > MAX_NAME_LEN)     return res.status(400).json({ error: `name must be ≤ ${MAX_NAME_LEN} chars` })
    if (printerKey.length > MAX_KEY_LEN) return res.status(400).json({ error: `printerKey must be ≤ ${MAX_KEY_LEN} chars` })

    const ref = await getFirestore().collection('printers').add({
      name,
      printerKey:      printerKey || null,
      status:          'available',
      estimatedFinish: null,
      photoUrl:        null,
      lastUpdated:     FieldValue.serverTimestamp(),
    })
    res.status(201).json({ id: ref.id })
  } catch (err) { next(err) }
})

// PATCH /api/printers/:id  [auth required]
router.patch('/:id', requireApiKey, async (req, res, next) => {
  if (!validateId(req, res)) return
  try {
    const { status, estimatedFinish, photoUrl, printerKey } = req.body
    const update = { lastUpdated: FieldValue.serverTimestamp() }

    if (status !== undefined) {
      if (!VALID_STATUSES.has(status))
        return res.status(400).json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` })
      update.status = status
    }
    if (estimatedFinish !== undefined) {
      update.estimatedFinish = estimatedFinish ? new Date(estimatedFinish) : null
    }
    if (photoUrl !== undefined) {
      if (photoUrl && String(photoUrl).length > MAX_URL_LEN)
        return res.status(400).json({ error: 'photoUrl too long' })
      update.photoUrl = photoUrl || null
    }
    if (printerKey !== undefined) {
      const key = String(printerKey ?? '').trim()
      if (key.length > MAX_KEY_LEN)
        return res.status(400).json({ error: `printerKey must be ≤ ${MAX_KEY_LEN} chars` })
      update.printerKey = key || null
    }

    liveCache.delete(req.params.id)
    await getFirestore().collection('printers').doc(req.params.id).update(update)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// DELETE /api/printers/:id  [auth required]
router.delete('/:id', requireApiKey, async (req, res, next) => {
  if (!validateId(req, res)) return
  try {
    liveCache.delete(req.params.id)
    await getFirestore().collection('printers').doc(req.params.id).delete()
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
