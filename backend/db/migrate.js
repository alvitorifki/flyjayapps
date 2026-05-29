require('dotenv').config()
const db = require('./index')

async function migrate() {
  console.log('Running migrations...')

  // ── Tabel crews ──────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS crews (
      id                      BIGSERIAL PRIMARY KEY,
      name                    VARCHAR(255) NOT NULL,
      employee_id             VARCHAR(50)  NOT NULL UNIQUE,
      license                 VARCHAR(50),
      email                   VARCHAR(255),
      phone                   VARCHAR(30),
      rank                    VARCHAR(10)  NOT NULL DEFAULT 'SIC'
                                  CHECK (rank IN ('PIC','SIC','FA1','FA','FOO')),
      loa                     VARCHAR(255),
      status                  VARCHAR(10)  NOT NULL DEFAULT 'fit'
                                  CHECK (status IN ('fit','unfit')),

      -- Pilot / PIC / SIC certs
      ppc_conduct             DATE, ppc_valid               DATE,
      ground_training_conduct DATE, ground_training_valid   DATE,
      loft_conduct            DATE, loft_valid              DATE,
      medex_conduct           DATE, medex_valid             DATE,
      ielp_conduct            DATE, ielp_valid              DATE,
      crm_conduct             DATE, crm_valid               DATE,
      ws_conduct              DATE, ws_valid                DATE,
      alar_cfit_conduct       DATE, alar_cfit_valid         DATE,
      dg_conduct              DATE, dg_valid                DATE,
      cet_conduct             DATE, cet_valid               DATE,
      pbn_conduct             DATE, pbn_valid               DATE,
      avsec_conduct           DATE, avsec_valid             DATE,
      sms_conduct             DATE, sms_valid               DATE,
      tcas_conduct            DATE, tcas_valid              DATE,

      -- FA-only certs (ditambahkan)
      cc_conduct              DATE, cc_valid                DATE,
      first_aid_conduct       DATE, first_aid_valid         DATE,

      basic_indoc_conduct     DATE,
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      updated_at              TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  // Tambah kolom FA kalau sudah ada tabel lama (safe migration)
  await db.query(`ALTER TABLE crews ADD COLUMN IF NOT EXISTS cc_conduct        DATE;`)
  await db.query(`ALTER TABLE crews ADD COLUMN IF NOT EXISTS cc_valid          DATE;`)
  await db.query(`ALTER TABLE crews ADD COLUMN IF NOT EXISTS first_aid_conduct DATE;`)
  await db.query(`ALTER TABLE crews ADD COLUMN IF NOT EXISTS first_aid_valid   DATE;`)

  // ── Tabel users ──────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             BIGSERIAL PRIMARY KEY,
      name           VARCHAR(255) NOT NULL,
      email          VARCHAR(255) NOT NULL UNIQUE,
      password       VARCHAR(255) NOT NULL,
      role           VARCHAR(10)  NOT NULL DEFAULT 'crew'
                         CHECK (role IN ('admin','crew')),
      crew_id        BIGINT REFERENCES crews(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  // ── Tabel schedules (BARU) ───────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id           BIGSERIAL PRIMARY KEY,
      crew_id      BIGINT REFERENCES crews(id) ON DELETE CASCADE,
      crew_name    VARCHAR(255),              -- denormalized agar mudah query
      crew_role    VARCHAR(10),               -- PIC / SIC / FA / FA1
      type         VARCHAR(20) NOT NULL
                       CHECK (type IN ('flight','training','off','standby')),
      activity     VARCHAR(100),              -- nama training / rute terbang
      date_start   DATE NOT NULL,
      date_end     DATE,                      -- nullable = 1 hari
      detail       TEXT,                      -- keterangan tambahan
      created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  // ── Indexes ──────────────────────────────────────────────────
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_crews_rank         ON crews(rank);
    CREATE INDEX IF NOT EXISTS idx_crews_status       ON crews(status);
    CREATE INDEX IF NOT EXISTS idx_crews_ppc_valid    ON crews(ppc_valid);
    CREATE INDEX IF NOT EXISTS idx_crews_medex_valid  ON crews(medex_valid);
    CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_crew_id      ON users(crew_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_crew_id  ON schedules(crew_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_dates    ON schedules(date_start, date_end);
    CREATE INDEX IF NOT EXISTS idx_schedules_type     ON schedules(type);
    CREATE INDEX IF NOT EXISTS idx_schedules_activity ON schedules(activity);
  `)

  // ── updated_at trigger ───────────────────────────────────────
  await db.query(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
  `)
  for (const t of ['crews', 'users', 'schedules']) {
    await db.query(`
      DROP TRIGGER IF EXISTS trg_${t}_updated_at ON ${t};
      CREATE TRIGGER trg_${t}_updated_at
        BEFORE UPDATE ON ${t}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `)
  }

  // ── View: sertifikat expiring (Pilot) ────────────────────────
  const pilotCertPairs = [
    ['PPC','ppc_valid'],
    ['Ground Training','ground_training_valid'],
    ['LOFT','loft_valid'],
    ['MEDEX','medex_valid'],
    ['IELP','ielp_valid'],
    ['CRM','crm_valid'],
    ['WS','ws_valid'],
    ['ALAR/CFIT','alar_cfit_valid'],
    ['DG','dg_valid'],
    ['CET','cet_valid'],
    ['PBN','pbn_valid'],
    ['AVSEC','avsec_valid'],
    ['SMS','sms_valid'],
    ['TCAS','tcas_valid'],
  ]
  const pilotValues = pilotCertPairs.map(([l,f]) => `('${l}', c.${f})`).join(',\n        ')

  await db.query(`
    CREATE OR REPLACE VIEW v_expiring_certs AS
    SELECT c.id, c.name, c.rank, c.employee_id,
           t.cert_name, t.valid_date,
           (t.valid_date - CURRENT_DATE) AS days_remaining
    FROM crews c
    CROSS JOIN LATERAL (VALUES ${pilotValues}) AS t(cert_name, valid_date)
    WHERE t.valid_date IS NOT NULL
      AND t.valid_date <= CURRENT_DATE + INTERVAL '90 days'
    ORDER BY t.valid_date ASC;
  `)

  // ── View: sertifikat expiring ALL (Pilot + FA) ───────────────
  const allCertPairs = [
    ...pilotCertPairs,
    ['CC','cc_valid'],
    ['First Aid','first_aid_valid'],
  ]
  const allValues = allCertPairs.map(([l,f]) => `('${l}', c.${f})`).join(',\n        ')

  await db.query(`
    CREATE OR REPLACE VIEW v_expiring_certs_all AS
    SELECT c.id, c.name, c.rank, c.employee_id,
           t.cert_name, t.valid_date,
           (t.valid_date - CURRENT_DATE) AS days_remaining
    FROM crews c
    CROSS JOIN LATERAL (VALUES ${allValues}) AS t(cert_name, valid_date)
    WHERE t.valid_date IS NOT NULL
      AND t.valid_date <= CURRENT_DATE + INTERVAL '90 days'
    ORDER BY t.valid_date ASC;
  `)

  // ── View: schedule bulan berjalan ────────────────────────────
  await db.query(`
    CREATE OR REPLACE VIEW v_schedule_current_month AS
    SELECT s.*, c.rank as crew_rank_ref
    FROM schedules s
    LEFT JOIN crews c ON c.id = s.crew_id
    WHERE date_start >= date_trunc('month', CURRENT_DATE)
      AND date_start <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    ORDER BY date_start, crew_name;
  `)

  console.log('✅ Migration complete!')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })
