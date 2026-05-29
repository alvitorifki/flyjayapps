const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const db      = require('../db')

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
//
// Strategi login:
//   1. Cari email di tabel users
//      a. Cocokkan password dengan hash di users.password  (custom password)
//      b. Jika gagal DAN user adalah crew → coba employee_id sebagai fallback
//   2. Jika tidak ada di users → cari di crews langsung (email + employee_id)
//
// Dengan cara ini crew SELALU bisa login pakai employee_id,
// sekaligus TETAP bisa pakai password yang sudah di-update.
// ══════════════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email dan password wajib diisi.' })

    const emailLower = email.toLowerCase().trim()

    // ── Step 1: Cari di tabel users ────────────────────────────────────────
    const { rows: userRows } = await db.query(
      `SELECT u.*, c.name as crew_name, c.rank, c.employee_id, c.status as crew_status
       FROM users u
       LEFT JOIN crews c ON c.id = u.crew_id
       WHERE u.email = $1`,
      [emailLower]
    )

    if (userRows.length > 0) {
      const user = userRows[0]

      // Coba custom password (hash) dulu
      const matchCustom = await bcrypt.compare(password, user.password)

      // Jika custom password gagal DAN ini adalah akun crew →
      // coba employee_id sebagai fallback password
      let matchEmployeeId = false
      if (!matchCustom && user.role === 'crew' && user.employee_id) {
        matchEmployeeId = password === user.employee_id
      }

      if (!matchCustom && !matchEmployeeId) {
        return res.status(401).json({ message: 'Email atau password salah.' })
      }

      if (user.role === 'crew' && !user.crew_id)
        return res.status(403).json({ message: 'Akun belum terhubung ke data crew. Hubungi admin.' })

      const payload = {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        crew_id:     user.crew_id,
        rank:        user.rank        || null,
        employee_id: user.employee_id || null,
      }
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })
      return res.json({ token, user: payload })
    }

    // ── Step 2: Fallback → cari langsung di tabel crews ────────────────────
    // (Crew yang belum punya user record sama sekali)
    const { rows: crewRows } = await db.query(
      `SELECT * FROM crews WHERE email = $1`,
      [emailLower]
    )

    if (crewRows.length === 0)
      return res.status(401).json({ message: 'Email atau password salah.' })

    const crew = crewRows[0]

    // Password harus = employee_id (plaintext)
    if (password !== crew.employee_id)
      return res.status(401).json({ message: 'Email atau password salah.' })

    // Auto-buat user record dengan password = hash(employee_id)
    const hash = await bcrypt.hash(crew.employee_id, 12)
    const { rows: newUser } = await db.query(
      `INSERT INTO users (name, email, password, role, crew_id)
       VALUES ($1, $2, $3, 'crew', $4)
       ON CONFLICT (email) DO UPDATE SET
         crew_id    = EXCLUDED.crew_id,
         name       = EXCLUDED.name,
         updated_at = NOW()
       RETURNING *`,
      [crew.name, emailLower, hash, crew.id]
    )

    const u = newUser[0]
    const payload = {
      id:          u.id,
      name:        u.name,
      email:       u.email,
      role:        u.role,
      crew_id:     crew.id,
      rank:        crew.rank,
      employee_id: crew.employee_id,
    }
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, user: payload })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// GET /api/auth/me
router.get('/me', require('../middleware/auth').authMiddleware, async (req, res) => {
  res.json({ user: req.user })
})

// POST /api/auth/register-admin
const { authMiddleware, adminOnly } = require('../middleware/auth')

router.post('/register-admin', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' })
    if (password.length < 8)
      return res.status(400).json({ message: 'Password minimal 8 karakter.' })

    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email sudah terdaftar.' })

    const hash = await bcrypt.hash(password, 12)
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash]
    )
    res.status(201).json({ message: 'Admin berhasil didaftarkan.', admin: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

module.exports = router