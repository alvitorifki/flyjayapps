require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app = express()

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:9000',
    'http://localhost:8080',
  ].filter(Boolean),
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'))
app.use('/api/crews',     require('./routes/crews'))
app.use('/api/schedules', require('./routes/schedules'))  // ← BARU

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }))

// ── 404 ──────────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ message: 'Route tidak ditemukan.' }))

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Internal server error.' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`✈  FlyJaya API running on :${PORT}`))
