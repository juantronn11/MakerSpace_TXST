import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

const API_BASE   = import.meta.env.VITE_API_URL   ?? ''
const ADMIN_KEY  = import.meta.env.VITE_ADMIN_KEY ?? ''

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key':    ADMIN_KEY,
  }
}

async function apiReq(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(),
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function updatePrinterStatus(id, { status, estimatedFinish, photoFile, printerKey }) {
  let photoUrl
  if (photoFile) {
    // Photo upload stays client-side (Firebase Storage); only the resulting URL
    // goes to the backend so it can be stored in Firestore via Admin SDK.
    const storageRef = ref(storage, `printer-photos/${id}/${Date.now()}_${photoFile.name}`)
    await uploadBytes(storageRef, photoFile)
    photoUrl = await getDownloadURL(storageRef)
  }

  const body = { status, estimatedFinish: estimatedFinish?.toISOString?.() ?? estimatedFinish ?? null }
  if (photoUrl    !== undefined) body.photoUrl   = photoUrl
  if (printerKey  !== undefined) body.printerKey = printerKey

  await apiReq(`/api/printers/${id}`, 'PATCH', body)
}

export async function addPrinter(name, printerKey = null) {
  await apiReq('/api/printers', 'POST', { name, printerKey })
}

export async function deletePrinter(id) {
  await apiReq(`/api/printers/${id}`, 'DELETE')
}

// Calls the backend proxy → printer's cluster API or Digital Factory cloud
// Returns { live, job?, printerStatus?, reason? }
export async function fetchLiveStatus(printerId) {
  const res = await fetch(`${API_BASE}/api/printers/${printerId}/live`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
