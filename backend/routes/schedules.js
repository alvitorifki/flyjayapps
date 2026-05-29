const router = require('express').Router()
const db     = require('../db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const VALID_TYPES     = ['flight', 'training', 'off', 'standby']
const VALID_ROLES     = ['PIC', 'SIC', 'FA', 'FA1', 'FOO']

// ── Helper validasi ───────────────────────────────────────────
function validateSchedule(body) {
  const errors = []
  if (!body.type)       errors.push('type wajib diisi (flight/training/off/standby)')
  if (!body.date_start) errors.push('date_start wajib diisi')
  if (!VALID_TYPES.includes(body.type)) errors.push(`type tidak valid. Pilih: ${VALID_TYPES.join(', ')}`)
  if (body.date_end && body.date_end < body.date_start)
    errors.push('date_end tidak boleh sebelum date_start')
  return errors
}

// ═══════════════════════════════════════════════════════════════
// GET /api/schedules
// Query params:
//   year, month       — filter bulan (default: bulan berjalan)
//   crew_id           — filter per crew
//   role              — filter PIC/SIC/FA/FA1
//   type              — filter flight/training/off/standby
//   activity          — filter nama training (misal: DG, CRM)
// ═══════════════════════════════════════════════════════════════
router.get('/', authMiddleware, async (req, res) => {
  try {
    const now   = new Date()
    const year  = parseInt(req.query.year)  || now.getFullYear()
    const month = parseInt(req.query.month) || now.getMonth() + 1

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0] // last day

    let sql = `
      SELECT s.*, c.name AS crew_name_ref, c.rank AS crew_rank_ref
      FROM schedules s
      LEFT JOIN crews c ON c.id = s.crew_id
      WHERE s.date_start <= $1 AND (s.date_end >= $2 OR s.date_start >= $2)
    `
    const params = [endDate, startDate]

    // Crew hanya bisa lihat jadwal sendiri
    if (req.user.role === 'crew') {
      params.push(req.user.crew_id)
      sql += ` AND s.crew_id = $${params.length}`
    } else {
      if (req.query.crew_id) {
        params.push(req.query.crew_id)
        sql += ` AND s.crew_id = $${params.length}`
      }
      if (req.query.role) {
        params.push(req.query.role)
        sql += ` AND s.crew_role = $${params.length}`
      }
      if (req.query.type) {
        params.push(req.query.type)
        sql += ` AND s.type = $${params.length}`
      }
      if (req.query.activity) {
        params.push(`%${req.query.activity}%`)
        sql += ` AND s.activity ILIKE $${params.length}`
      }
    }

    sql += ' ORDER BY s.date_start, s.crew_name'

    const { rows } = await db.query(sql, params)
    res.json({ data: rows, meta: { year, month, start: startDate, end: endDate } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/schedules/summary
// Ringkasan per jenis training untuk bulan tertentu
// (dipakai di halaman "Schedule — Kegiatan")
// ═══════════════════════════════════════════════════════════════
router.get('/summary', authMiddleware, adminOnly, async (req, res) => {
  try {
    const now   = new Date()
    const year  = parseInt(req.query.year)  || now.getFullYear()
    const month = parseInt(req.query.month) || now.getMonth() + 1

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

    // Hitung jumlah crew per aktivitas
    const { rows: activityRows } = await db.query(`
      SELECT activity, type, crew_role,
             COUNT(*) AS crew_count,
             array_agg(crew_name ORDER BY crew_name) AS crew_list
      FROM schedules
      WHERE date_start <= $1 AND (date_end >= $2 OR date_start >= $2)
        AND activity IS NOT NULL
      GROUP BY activity, type, crew_role
      ORDER BY activity, crew_role
    `, [endDate, startDate])

    // Crew yang punya kegiatan di bulan ini
    const { rows: crewRows } = await db.query(`
      SELECT crew_id, crew_name, crew_role,
             array_agg(DISTINCT activity ORDER BY activity) AS activities,
             array_agg(DISTINCT type ORDER BY type) AS types,
             COUNT(*) AS total_events
      FROM schedules
      WHERE date_start <= $1 AND (date_end >= $2 OR date_start >= $2)
      GROUP BY crew_id, crew_name, crew_role
      ORDER BY crew_name
    `, [endDate, startDate])

    res.json({
      data: {
        by_activity: activityRows,
        crews_active: crewRows,
      },
      meta: { year, month },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/schedules/activity/:activity
// Siapa saja yang ikut training tertentu di bulan tertentu
// Contoh: GET /api/schedules/activity/DG?month=10&year=2025
// ═══════════════════════════════════════════════════════════════
router.get('/activity/:activity', authMiddleware, adminOnly, async (req, res) => {
  try {
    const now   = new Date()
    const year  = parseInt(req.query.year)  || now.getFullYear()
    const month = parseInt(req.query.month) || now.getMonth() + 1

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

    const { rows } = await db.query(`
      SELECT s.*, c.rank, c.employee_id, c.email, c.phone
      FROM schedules s
      LEFT JOIN crews c ON c.id = s.crew_id
      WHERE s.activity ILIKE $1
        AND s.date_start <= $2
        AND (s.date_end >= $3 OR s.date_start >= $3)
      ORDER BY s.date_start, s.crew_name
    `, [`%${req.params.activity}%`, endDate, startDate])

    res.json({ data: rows, activity: req.params.activity, meta: { year, month } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/schedules/:id
// ═══════════════════════════════════════════════════════════════
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, c.rank, c.employee_id
      FROM schedules s
      LEFT JOIN crews c ON c.id = s.crew_id
      WHERE s.id = $1
    `, [req.params.id])

    if (!rows[0]) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' })

    // Crew hanya bisa akses jadwal sendiri
    if (req.user.role === 'crew' && rows[0].crew_id !== req.user.crew_id) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }

    res.json({ data: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/schedules  (Admin)
// ═══════════════════════════════════════════════════════════════
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const b = req.body
    const errors = validateSchedule(b)
    if (errors.length) return res.status(400).json({ message: errors.join('; ') })

    // Jika crew_id diberikan, ambil data crew untuk denormalisasi
    let crew_name = b.crew_name || null
    let crew_role = b.crew_role || null

    if (b.crew_id) {
      const { rows: cr } = await db.query('SELECT name, rank FROM crews WHERE id=$1', [b.crew_id])
      if (cr[0]) {
        crew_name = crew_name || cr[0].name
        crew_role = crew_role || cr[0].rank
      }
    }

    const { rows } = await db.query(`
      INSERT INTO schedules
        (crew_id, crew_name, crew_role, type, activity, date_start, date_end, detail, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      b.crew_id    || null,
      crew_name,
      crew_role,
      b.type,
      b.activity   || null,
      b.date_start,
      b.date_end   || null,
      b.detail     || null,
      req.user.id,
    ])

    res.status(201).json({ data: rows[0], message: 'Jadwal berhasil ditambahkan.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/schedules/bulk  (Admin) — tambah banyak jadwal sekaligus
// Body: { schedules: [ {...}, {...} ] }
// ═══════════════════════════════════════════════════════════════
router.post('/bulk', authMiddleware, adminOnly, async (req, res) => {
  try {
    const items = req.body.schedules
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Body harus berisi array "schedules".' })
    }

    const results = []
    const failed  = []

    for (const b of items) {
      const errors = validateSchedule(b)
      if (errors.length) { failed.push({ item: b, errors }); continue }

      let crew_name = b.crew_name || null
      let crew_role = b.crew_role || null
      if (b.crew_id) {
        const { rows: cr } = await db.query('SELECT name, rank FROM crews WHERE id=$1', [b.crew_id])
        if (cr[0]) { crew_name = crew_name || cr[0].name; crew_role = crew_role || cr[0].rank }
      }

      const { rows } = await db.query(`
        INSERT INTO schedules
          (crew_id, crew_name, crew_role, type, activity, date_start, date_end, detail, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `, [b.crew_id || null, crew_name, crew_role, b.type, b.activity || null,
          b.date_start, b.date_end || null, b.detail || null, req.user.id])
      results.push(rows[0])
    }

    res.status(201).json({
      message:  `${results.length} jadwal berhasil ditambahkan.`,
      inserted: results,
      failed,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// PUT /api/schedules/:id  (Admin)
// ═══════════════════════════════════════════════════════════════
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const b = req.body
    const errors = validateSchedule(b)
    if (errors.length) return res.status(400).json({ message: errors.join('; ') })

    let crew_name = b.crew_name || null
    let crew_role = b.crew_role || null
    if (b.crew_id) {
      const { rows: cr } = await db.query('SELECT name, rank FROM crews WHERE id=$1', [b.crew_id])
      if (cr[0]) { crew_name = crew_name || cr[0].name; crew_role = crew_role || cr[0].rank }
    }

    const { rows } = await db.query(`
      UPDATE schedules
      SET crew_id=$1, crew_name=$2, crew_role=$3, type=$4, activity=$5,
          date_start=$6, date_end=$7, detail=$8, updated_at=NOW()
      WHERE id=$9
      RETURNING *
    `, [
      b.crew_id || null,
      crew_name,
      crew_role,
      b.type,
      b.activity   || null,
      b.date_start,
      b.date_end   || null,
      b.detail     || null,
      req.params.id,
    ])

    if (!rows[0]) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' })
    res.json({ data: rows[0], message: 'Jadwal berhasil diupdate.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// DELETE /api/schedules/:id  (Admin)
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM schedules WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' })
    res.json({ message: 'Jadwal berhasil dihapus.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

module.exports = router
