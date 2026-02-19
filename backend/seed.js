/**
 * Seed script — adds UMS5-1 through UMS5-8 to Firestore
 *
 * Usage (from the backend/ folder):
 *   node seed.js                          ← targets http://localhost:3001
 *   node seed.js https://your-railway-url ← targets production
 *
 * Run your local backend first if targeting localhost:
 *   npm run dev
 */

import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue }      from 'firebase-admin/firestore'

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

const PRINTERS = Array.from({ length: 8 }, (_, i) => ({
  name:            `UMS5-${i + 1}`,
  printerKey:      `ums5-${i + 1}`,
  status:          'available',
  estimatedFinish: null,
  photoUrl:        null,
  lastUpdated:     FieldValue.serverTimestamp(),
}))

async function seed() {
  // Check what's already in Firestore so we don't add duplicates
  const existing = await db.collection('printers').get()
  const existingKeys = new Set(existing.docs.map(d => d.data().printerKey))

  let added   = 0
  let skipped = 0

  for (const printer of PRINTERS) {
    if (existingKeys.has(printer.printerKey)) {
      console.log(`  skip  ${printer.name} (already exists)`)
      skipped++
      continue
    }
    await db.collection('printers').add(printer)
    console.log(`  added ${printer.name}`)
    added++
  }

  console.log(`\nDone — ${added} added, ${skipped} skipped.`)
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
