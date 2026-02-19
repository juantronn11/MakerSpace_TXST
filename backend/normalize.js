/**
 * One-time script — normalizes all printer names to UMS5-1 … UMS5-8
 * so orderBy('name') sorts them correctly on the homepage.
 *
 * Run from the backend/ folder:
 *   node normalize.js
 */

import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore }                  from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

async function normalize() {
  const snap = await db.collection('printers').get()

  for (const doc of snap.docs) {
    const data = doc.data()
    const key  = data.printerKey  // e.g. "ums5-3"

    if (!key || !key.startsWith('ums5-')) {
      console.log(`  skip  ${doc.id} — no recognized printerKey (${key})`)
      continue
    }

    const num          = key.split('-')[1]           // "3"
    const correctName  = `UMS5-${num}`               // "UMS5-3"

    if (data.name === correctName) {
      console.log(`  ok    ${correctName}`)
      continue
    }

    await doc.ref.update({ name: correctName })
    console.log(`  fixed ${data.name ?? '(unnamed)'} → ${correctName}`)
  }

  console.log('\nDone.')
  process.exit(0)
}

normalize().catch(err => {
  console.error('Failed:', err.message)
  process.exit(1)
})
