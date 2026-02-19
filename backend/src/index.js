import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import printersRouter from './routes/printers.js'
import { errorHandler } from './middleware/errorHandler.js'

// Initialize Firebase Admin (uses service account from .env)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// Health check — useful for uptime monitoring and deployment checks
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date() }))

app.use('/api/printers', printersRouter)

app.use(errorHandler)

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => console.log(`Backend → http://localhost:${PORT}`))
