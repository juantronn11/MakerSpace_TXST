import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

export async function updatePrinterStatus(id, { status, estimatedFinish, photoFile, printerKey }) {
  let photoUrl = null
  if (photoFile) {
    const storageRef = ref(storage, `printer-photos/${id}/${Date.now()}_${photoFile.name}`)
    await uploadBytes(storageRef, photoFile)
    photoUrl = await getDownloadURL(storageRef)
  }

  const update = {
    status,
    estimatedFinish: estimatedFinish ?? null,
    lastUpdated: serverTimestamp(),
  }
  if (photoUrl !== null)       update.photoUrl  = photoUrl
  if (printerKey !== undefined) update.printerKey = printerKey?.trim() || null

  await updateDoc(doc(db, 'printers', id), update)
}

export async function addPrinter(name, printerKey = null) {
  await addDoc(collection(db, 'printers'), {
    name,
    printerKey: printerKey?.trim() || null,
    status: 'available',
    estimatedFinish: null,
    photoUrl: null,
    lastUpdated: serverTimestamp(),
  })
}

export async function deletePrinter(id) {
  await deleteDoc(doc(db, 'printers', id))
}

// Calls the backend proxy → printer's cluster API
// Returns { live, job?, printerStatus?, reason? }
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchLiveStatus(printerId) {
  const res = await fetch(`${API_BASE}/api/printers/${printerId}/live`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
