/**
 * Ultimaker Digital Factory cloud API client
 *
 * Required env vars:
 *   ULTIMAKER_CLIENT_ID     — OAuth client ID (from digitalfactory.ultimaker.com → Developer settings)
 *   ULTIMAKER_CLIENT_SECRET — OAuth client secret
 *
 * The `printerKey` stored in Firestore should match the cluster `name` or
 * `host_name` shown in your Digital Factory dashboard (e.g. "ums5-1").
 *
 * Endpoints used:
 *   POST https://api.ultimaker.com/oauth/v1/token   → get access token
 *   GET  https://api.ultimaker.com/connect/v1/clusters → list all clusters + their status
 */

const BASE = 'https://api.ultimaker.com'

let _token      = null
let _tokenExpiry = 0

export function isConfigured() {
  return !!(process.env.ULTIMAKER_CLIENT_ID && process.env.ULTIMAKER_CLIENT_SECRET)
}

async function getToken() {
  if (_token && Date.now() < _tokenExpiry - 30_000) return _token

  const res = await fetch(`${BASE}/oauth/v1/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.ULTIMAKER_CLIENT_ID,
      client_secret: process.env.ULTIMAKER_CLIENT_SECRET,
      scope:         'um.df.organization.printers.read',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ultimaker OAuth error ${res.status}: ${text}`)
  }

  const data    = await res.json()
  _token        = data.access_token
  _tokenExpiry  = Date.now() + (data.expires_in ?? 3600) * 1000
  return _token
}

async function apiFetch(path) {
  const token = await getToken()
  const res   = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Ultimaker API ${res.status}: ${path}`)
  return res.json()
}

/**
 * Fetch live printer status from the Digital Factory cloud.
 *
 * @param {string} printerKey  - matches cluster `name` or `host_name` in Digital Factory
 * @returns {{ printerStatus: string, job: object|null }}
 * @throws if the cluster is not found or API call fails
 */
export async function fetchCloudStatus(printerKey) {
  // GET /connect/v1/clusters — returns all clusters (printer groups) for the account
  const payload  = await apiFetch('/connect/v1/clusters')
  const clusters = Array.isArray(payload) ? payload : (payload.data ?? payload.clusters ?? [])

  // Match by name or host_name (e.g. "ums5-1")
  const cluster = clusters.find(
    c => c.name === printerKey || c.host_name === printerKey,
  )

  if (!cluster) {
    throw new Error(`cluster_not_found: "${printerKey}" — check printerKey matches Digital Factory cluster name`)
  }

  // Normalize printer status from cluster fields
  const rawStatus = cluster.printer_status ?? cluster.status ?? 'idle'

  // Active print jobs may be nested on the cluster object or in a separate array
  const jobList  = cluster.print_jobs ?? cluster.active_print_jobs ?? []
  const activeJob = jobList.find(j => j.status === 'printing') ?? jobList[0] ?? null

  const job = activeJob ? {
    name:            activeJob.name         ?? 'Unknown job',
    status:          activeJob.status       ?? 'unknown',
    timeElapsed:     activeJob.time_elapsed ?? 0,
    timeTotal:       activeJob.time_total   ?? 0,
    timeRemaining:   Math.max(0, (activeJob.time_total ?? 0) - (activeJob.time_elapsed ?? 0)),
    percentComplete: (activeJob.time_total ?? 0) > 0
      ? Math.min(100, Math.round((activeJob.time_elapsed / activeJob.time_total) * 100))
      : 0,
  } : null

  return { printerStatus: rawStatus, job }
}
