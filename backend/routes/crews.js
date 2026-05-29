const router = require('express').Router()
const db = require('../db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

// ── Definisi cert per role ────────────────────────────────────
// durasi dalam bulan — dipakai untuk AUTO-CALC valid date dari conduct
// Cert yang masuk END_OF_YEAR_CERTS: valid-nya selalu di-set ke 31 Des tahun conduct
const END_OF_YEAR_CERTS = ['sms', 'dg', 'alar_cfit', 'pbn', 'avsec', 'crm', 'first_aid']

const PILOT_CERTS = [
  { field: 'medex', months: 6 },
  { field: 'ppc', months: 12 },
  { field: 'ground_training', months: 12 },
  { field: 'cet', months: 24 },
  { field: 'dg', months: 12 },  // end-of-year
  { field: 'avsec', months: 12 },  // end-of-year
  { field: 'ielp', months: 24 },
  { field: 'loft', months: 12 },
  { field: 'crm', months: 12 },  // end-of-year
  { field: 'ws', months: 12 },
  { field: 'alar_cfit', months: 12 },  // end-of-year
  { field: 'pbn', months: 12 },  // end-of-year
  { field: 'sms', months: 24 },  // end-of-year
]

const FA_CERTS = [
  { field: 'cc', months: 12 },
  { field: 'ground_training', months: 12 },
  { field: 'medex', months: 12 },
  { field: 'crm', months: 12 },  // end-of-year
  { field: 'dg', months: 12 },  // end-of-year
  { field: 'cet', months: 12 },
  { field: 'avsec', months: 12 },  // end-of-year
  { field: 'sms', months: 24 },  // end-of-year
  { field: 'first_aid', months: 12 },  // end-of-year
]

// Semua field cert yang ada di DB
const ALL_CERT_FIELDS = [
  'ppc', 'ground_training', 'loft', 'medex', 'ielp', 'crm',
  'ws', 'alar_cfit', 'dg', 'cet', 'pbn', 'avsec', 'sms', 'tcas',
  'cc', 'first_aid',
]

// ── Helper: cert status ───────────────────────────────────────
function certStatus(validDate) {
  if (!validDate) return 'expired'
  const diff = Math.floor((new Date(validDate) - new Date()) / 86400000)
  if (diff < 0) return 'expired'
  if (diff <= 90) return 'warning'
  return 'valid'
}

// ── Helper: tambah bulan ke tanggal ──────────────────────────
function addMonths(dateStr, months) {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  const base = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z' : s
  const d = new Date(base)
  if (isNaN(d.getTime())) return null
  d.setUTCMonth(d.getUTCMonth() + months)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Helper: end-of-year dari conduct date ─────────────────────
// SMS, DG, ALAR/CFIT, PBN, AVSEC, CRM, FIRST AID → expired 31 Des tahun conduct
function endOfYearValid(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  const base = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z' : s
  const d = new Date(base)
  if (isNaN(d.getTime())) return null
  const year = d.getUTCFullYear()
  return `${year}-12-31`
}

// ── Helper: ambil daftar cert sesuai rank ─────────────────────
function getCertListByRank(rank) {
  return ['FA', 'FA1'].includes(rank) ? FA_CERTS : PILOT_CERTS
}

// ── Helper: auto-calc valid date dari conduct + durasi ────────
function autoCalcValid(body, rank) {
  const certList = getCertListByRank(rank || body.rank)
  const result = { ...body }
  for (const { field, months } of certList) {
    const conductKey = `${field}_conduct`
    const validKey = `${field}_valid`
    // Hanya auto-calc jika ada conduct tapi tidak ada valid (atau valid kosong)
    if (result[conductKey] && !result[validKey]) {
      if (END_OF_YEAR_CERTS.includes(field)) {
        // Cert end-of-year: valid = 31 Des tahun conduct
        result[validKey] = endOfYearValid(result[conductKey])
      } else {
        result[validKey] = addMonths(result[conductKey], months)
      }
    }
  }
  return result
}

// ── Helper: auto-status medis (fit/unfit based on medex) ──────
function autoMedexStatus(crew) {
  // Jika medex_valid sudah lewat → unfit, sebaliknya fit
  if (!crew.medex_valid) return crew.status || 'fit'
  const today = new Date()
  const medexValid = new Date(crew.medex_valid)
  if (isNaN(medexValid.getTime())) return crew.status || 'fit'
  return medexValid < today ? 'unfit' : 'fit'
}

// ── Helper: enrich crew object ───────────────────────────────
function enrichCrew(crew) {
  const isFA = ['FA', 'FA1'].includes(crew.rank)
  const certs = {}

  for (const f of ALL_CERT_FIELDS) {
    certs[f] = {
      conduct: crew[`${f}_conduct`] || null,
      valid: crew[`${f}_valid`] || null,
      status: certStatus(crew[`${f}_valid`]),
    }
  }

  // Overall status hanya dari cert yang relevan untuk rank ini
  const relevantFields = getCertListByRank(crew.rank).map(c => c.field)
  const statuses = relevantFields.map(f => certs[f].status)
  const overall = statuses.includes('expired') ? 'expired'
    : statuses.includes('warning') ? 'warning' : 'valid'

  // Auto-determine fit/unfit dari medex
  const medexAutoStatus = autoMedexStatus(crew)

  return {
    ...crew,
    status: medexAutoStatus,  // override status dari medex
    certs,
    overall_status: overall,
    is_fa: isFA,
    cert_schema: isFA ? 'fa' : 'pilot',
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/crews
// ═══════════════════════════════════════════════════════════════
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'crew') {
      const { rows } = await db.query('SELECT * FROM crews WHERE id=$1', [req.user.crew_id])
      return res.json({ data: rows.map(enrichCrew) })
    }

    let sql = 'SELECT * FROM crews WHERE 1=1'
    const params = []

    if (req.query.rank) {
      params.push(req.query.rank)
      sql += ` AND rank = $${params.length}`
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`)
      sql += ` AND (name ILIKE $${params.length} OR employee_id ILIKE $${params.length} OR license ILIKE $${params.length})`
    }
    sql += ' ORDER BY rank, name'

    const { rows } = await db.query(sql, params)
    const enriched = rows.map(enrichCrew)
    const sf = req.query.status_filter
    const filtered = sf ? enriched.filter(c => c.overall_status === sf) : enriched
    res.json({ data: filtered })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/crews/stats
// ═══════════════════════════════════════════════════════════════
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows: all } = await db.query('SELECT * FROM crews')
    const enriched = all.map(enrichCrew)
    const byRank = {}
    enriched.forEach(c => { byRank[c.rank] = (byRank[c.rank] || 0) + 1 })
    res.json({
      total: enriched.length,
      valid: enriched.filter(c => c.overall_status === 'valid').length,
      warning: enriched.filter(c => c.overall_status === 'warning').length,
      expired: enriched.filter(c => c.overall_status === 'expired').length,
      by_rank: byRank,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/crews/alerts
// Query param: days (default: 90, for "30 days" report use days=30)
// ═══════════════════════════════════════════════════════════════
router.get('/alerts', authMiddleware, adminOnly, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90
    const { rows } = await db.query(
      `SELECT id, name, rank, employee_id, cert_name, valid_date::TEXT AS valid_date, days_remaining FROM v_expiring_certs_all WHERE days_remaining <= $1 ORDER BY days_remaining ASC`,
      [days]
    )
    res.json({ data: rows, days_threshold: days })
  } catch (err) {
    // Fallback ke view lama
    try {
      const { rows } = await db.query('SELECT id, name, rank, employee_id, cert_name, valid_date::TEXT AS valid_date, days_remaining FROM v_expiring_certs_all LIMIT 100')
      res.json({ data: rows })
    } catch (e2) {
      console.error(e2)
      res.status(500).json({ message: 'Server error.' })
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/crews/training-schema
// ═══════════════════════════════════════════════════════════════
router.get('/training-schema', authMiddleware, async (req, res) => {
  res.json({
    pilot: PILOT_CERTS,
    fa: FA_CERTS,
    end_of_year_certs: END_OF_YEAR_CERTS,
  })
})

// ═══════════════════════════════════════════════════════════════
// GET /api/crews/me
// ═══════════════════════════════════════════════════════════════
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (!req.user.crew_id)
      return res.status(404).json({ message: 'Crew tidak ditemukan.' })
    const { rows } = await db.query('SELECT * FROM crews WHERE id=$1', [req.user.crew_id])
    if (!rows[0]) return res.status(404).json({ message: 'Crew tidak ditemukan.' })
    res.json({ data: enrichCrew(rows[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// PUT /api/crews/me/password
// ═══════════════════════════════════════════════════════════════
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs')
    const { current_password, new_password } = req.body

    if (!current_password || !new_password)
      return res.status(400).json({ message: 'current_password dan new_password wajib diisi.' })
    if (new_password.length < 6)
      return res.status(400).json({ message: 'Password baru minimal 6 karakter.' })

    const { rows } = await db.query(
      `SELECT u.*, c.employee_id
       FROM users u
       LEFT JOIN crews c ON c.id = u.crew_id
       WHERE u.id = $1`,
      [req.user.id]
    )
    const user = rows[0]
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' })

    const matchHash = await bcrypt.compare(current_password, user.password)
    const matchEmployeeId = user.employee_id && current_password === user.employee_id

    if (!matchHash && !matchEmployeeId)
      return res.status(400).json({ message: 'Password lama salah.' })

    const hash = await bcrypt.hash(new_password, 12)
    await db.query('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id])
    res.json({ message: 'Password berhasil diubah.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/crews/:id
// ═══════════════════════════════════════════════════════════════
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'crew' && String(req.user.crew_id) !== String(req.params.id)) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }
    const { rows } = await db.query('SELECT * FROM crews WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ message: 'Crew tidak ditemukan.' })
    res.json({ data: enrichCrew(rows[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/crews
// ═══════════════════════════════════════════════════════════════
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const b = autoCalcValid(req.body, req.body.rank)

    const cols = [
      'name', 'employee_id', 'license', 'email', 'phone', 'rank', 'loa', 'status',
      ...ALL_CERT_FIELDS.flatMap(f => [`${f}_conduct`, `${f}_valid`]),
      'basic_indoc_conduct',
    ]
    const vals = cols.map(c => b[c] || null)
    const nums = cols.map((_, i) => `$${i + 1}`)

    const { rows } = await db.query(
      `INSERT INTO crews (${cols.join(',')}) VALUES (${nums.join(',')}) RETURNING *`,
      vals
    )
    const crew = rows[0]

    if (crew.email) {
      const bcrypt = require('bcryptjs')
      const pw = await bcrypt.hash(crew.employee_id, 12)
      await db.query(`
        INSERT INTO users (name, email, password, role, crew_id)
        VALUES ($1, $2, $3, 'crew', $4)
        ON CONFLICT (email) DO UPDATE SET
          crew_id    = EXCLUDED.crew_id,
          name       = EXCLUDED.name,
          updated_at = NOW()
      `, [crew.name, crew.email, pw, crew.id])
    }

    res.status(201).json({ data: enrichCrew(crew), message: 'Crew berhasil ditambahkan.' })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Employee ID sudah terdaftar.' })
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// PUT /api/crews/:id
// ═══════════════════════════════════════════════════════════════
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows: existing } = await db.query('SELECT rank FROM crews WHERE id=$1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ message: 'Crew tidak ditemukan.' })
    const rank = req.body.rank || existing[0].rank

    const b = autoCalcValid(req.body, rank)

    const cols = [
      'name', 'employee_id', 'license', 'email', 'phone', 'rank', 'loa', 'status',
      ...ALL_CERT_FIELDS.flatMap(f => [`${f}_conduct`, `${f}_valid`]),
      'basic_indoc_conduct',
    ]
    const sets = cols.map((c, i) => `${c}=$${i + 1}`).join(',')
    const vals = [...cols.map(c => b[c] || null), req.params.id]

    const { rows } = await db.query(
      `UPDATE crews SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,
      vals
    )
    if (!rows[0]) return res.status(404).json({ message: 'Crew tidak ditemukan.' })
    res.json({ data: enrichCrew(rows[0]), message: 'Data crew berhasil diupdate.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// DELETE /api/crews/:id
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM crews WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: 'Crew tidak ditemukan.' })
    res.json({ message: 'Crew berhasil dihapus.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/crews/bulk  — import banyak crew sekaligus dari CSV
// ═══════════════════════════════════════════════════════════════
router.post('/bulk', authMiddleware, adminOnly, async (req, res) => {
  try {
    const items = req.body.crews
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Body harus berisi array "crews".' })

    const results = []
    const failed = []
    const skipped = []

    const cols = [
      'name', 'employee_id', 'license', 'email', 'phone', 'rank', 'loa', 'status',
      ...ALL_CERT_FIELDS.flatMap(f => [`${f}_conduct`, `${f}_valid`]),
      'basic_indoc_conduct',
    ]

    // ── Normalize tanggal: YYYY-MM-DD atau Excel serial number ─
    const normalizeDate = (v) => {
      if (!v || v === '' || v === 'NULL' || v === 'null' || v === '0' || v === 0) return null
      const s = String(v).trim()
      if (s === '' || s === '0') return null

      // Format YYYY-MM-DD sudah benar
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(s + 'T00:00:00Z')
        return isNaN(d.getTime()) ? null : s
      }

      // Excel serial number (angka > 1000) → konversi ke tanggal
      if (/^\d{5}$/.test(s) || /^\d{4,6}$/.test(s)) {
        const serial = parseInt(s)
        if (serial > 20000 && serial < 80000) {
          // Excel serial: days since 1899-12-30
          const excelEpoch = new Date(1899, 11, 30)
          const ms = excelEpoch.getTime() + serial * 86400000
          const d = new Date(ms)
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
        }
        return null
      }

      // MM/DD/YYYY atau DD/MM/YYYY atau M/D/YYYY
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
        const parts = s.split(/[\/\-]/)
        const [p1, p2, yr] = parts.map(Number)
        // CSV template pakai format MM/DD/YYYY (US format)
        // Jika p2 > 12, pasti bukan bulan → berarti p1=bulan, p2=hari (MM/DD/YYYY)
        // Jika p1 > 12, pasti bukan bulan → berarti p1=hari, p2=bulan (DD/MM/YYYY)
        // Jika keduanya ≤ 12, asumsikan MM/DD/YYYY (sesuai template CSV)
        let month, day
        if (p1 > 12) {
          // p1 pasti hari, p2 bulan → DD/MM/YYYY
          day = p1; month = p2
        } else {
          // Asumsikan MM/DD/YYYY (format template CSV)
          month = p1; day = p2
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const isoStr = `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dt = new Date(isoStr + 'T00:00:00Z')
          if (!isNaN(dt.getTime())) return isoStr
        }
      }

      // Format ISO timestamp
      const d = new Date(v)
      if (isNaN(d.getTime())) return null
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    for (const raw of items) {
      if (!raw.name || !raw.employee_id || !raw.rank) {
        failed.push({ item: raw, error: 'name, employee_id, rank wajib diisi' })
        continue
      }

      const { rows: existing } = await db.query(
        'SELECT id FROM crews WHERE employee_id = $1',
        [raw.employee_id]
      )
      if (existing.length > 0) {
        skipped.push({ employee_id: raw.employee_id, name: raw.name, reason: 'employee_id sudah ada' })
        continue
      }

      // Normalize semua kolom tanggal dulu sebelum auto-calc
      const normalized = { ...raw }
      for (const key of Object.keys(normalized)) {
        if (key.endsWith('_conduct') || key.endsWith('_valid') || key === 'basic_indoc_conduct') {
          normalized[key] = normalizeDate(normalized[key])
        }
      }

      // Auto-calc valid dari conduct (termasuk end-of-year logic)
      const b = autoCalcValid(normalized, normalized.rank)

      const vals = cols.map(c => {
        const v = b[c]
        if (c.endsWith('_conduct') || c.endsWith('_valid') || c === 'basic_indoc_conduct') {
          return normalizeDate(v)
        }
        return v || null
      })

      try {
        const nums = cols.map((_, i) => `$${i + 1}`)
        const { rows } = await db.query(
          `INSERT INTO crews (${cols.join(',')}) VALUES (${nums.join(',')}) RETURNING *`,
          vals
        )
        const crew = rows[0]

        if (crew.email) {
          const bcrypt = require('bcryptjs')
          const pw = await bcrypt.hash(crew.employee_id, 12)
          await db.query(`
            INSERT INTO users (name, email, password, role, crew_id)
            VALUES ($1, $2, $3, 'crew', $4)
            ON CONFLICT (email) DO UPDATE SET
              crew_id    = EXCLUDED.crew_id,
              name       = EXCLUDED.name,
              updated_at = NOW()
          `, [crew.name, crew.email, pw, crew.id])
        }

        results.push(enrichCrew(crew))
      } catch (rowErr) {
        failed.push({ item: raw, error: rowErr.message })
      }
    }

    res.status(201).json({
      message: `${results.length} crew berhasil diimport.`,
      inserted: results.length,
      skipped: skipped.length,
      failed: failed.length,
      skipped_detail: skipped,
      failed_detail: failed,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/crews/export/expiring  — Export cert mau expire (30 hari)
// Query: days=30 (default), format=json
// ═══════════════════════════════════════════════════════════════
router.get('/export/expiring', authMiddleware, adminOnly, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    const { rows } = await db.query(
      `SELECT id, name, rank, employee_id, cert_name, valid_date::TEXT AS valid_date, days_remaining FROM v_expiring_certs_all WHERE days_remaining <= $1 ORDER BY days_remaining ASC`,
      [days]
    )
    res.json({ data: rows, days_threshold: days, total: rows.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

module.exports = router