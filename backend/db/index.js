const { Pool, types } = require('pg')
require('dotenv').config()

// ── Fix timezone shift untuk kolom DATE ──────────────────────
// Secara default, pg driver mengkonversi DATE → JS Date object
// menggunakan timezone LOKAL server, yang menyebabkan shift 1-2 hari.
// Solusi: override type parser untuk DATE (OID 1082) agar
// dikembalikan AS-IS sebagai string 'YYYY-MM-DD' tanpa konversi apapun.
types.setTypeParser(1082, (val) => val)   // DATE  → string as-is
types.setTypeParser(1114, (val) => val)   // TIMESTAMP  → string as-is
types.setTypeParser(1184, (val) => val)   // TIMESTAMPTZ → string as-is

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}