require('dotenv').config()
const db   = require('./index')
const bcrypt = require('bcryptjs')

async function seed() {
  console.log('Seeding...')

  // Admin
  const adminHash = await bcrypt.hash('Admin@1234', 12)
  await db.query(`
    INSERT INTO users (name, email, password, role)
    VALUES ($1,$2,$3,'admin')
    ON CONFLICT (email) DO NOTHING
  `, ['Administrator', 'admin@flyjaya.com', adminHash])

  // Sample crew data from Excel
  const crews = [
    {
      name:'PRADWITYA ANDI NUGRAHA', employee_id:'SMN.2024.12.032',
      license:'A19076', email:'andi.nugraha@flyjaya.com', phone:'0811 840 161',
      rank:'PIC', loa:'19-0076/KAPEL/X/2025 (GI FIS)', status:'fit',
      ppc_conduct:'2026-03-31',       ppc_valid:'2026-09-30',
      ground_training_conduct:'2026-03-06', ground_training_valid:'2027-03-31',
      loft_conduct:'2025-09-18',      loft_valid:'2026-09-30',
      medex_conduct:'2026-03-10',     medex_valid:'2026-09-10',
      ielp_conduct:'2024-04-26',      ielp_valid:'2030-04-26',
      crm_conduct:'2025-03-19',       crm_valid:'2026-12-31',
      ws_conduct:'2026-02-11',        ws_valid:'2027-12-31',
      alar_cfit_conduct:'2025-03-17', alar_cfit_valid:'2026-12-31',
      dg_conduct:'2025-03-20',        dg_valid:'2027-12-31',
      cet_conduct:'2025-04-24',       cet_valid:'2027-04-24',
      pbn_conduct:'2025-06-26',       pbn_valid:'2026-12-31',
      avsec_conduct:'2026-03-09',     avsec_valid:'2027-12-31',
      sms_conduct:'2025-05-08',       sms_valid:'2027-12-31',
      tcas_conduct:null,              tcas_valid:null,
      basic_indoc_conduct:'2025-08-05',
    },
    {
      name:'RADEN RARA BITA SARASWATI', employee_id:'SMN.2024.10.012',
      license:'CPL 20-0024', email:'bita.saraswati@flyjaya.com', phone:'085710678200',
      rank:'SIC', loa:null, status:'fit',
      ppc_conduct:'2025-09-25',       ppc_valid:'2026-09-30',
      ground_training_conduct:'2026-03-06', ground_training_valid:'2027-03-31',
      loft_conduct:'2025-09-24',      loft_valid:'2026-09-30',
      medex_conduct:'2026-03-10',     medex_valid:'2026-09-10',
      ielp_conduct:'2026-02-12',      ielp_valid:'2029-02-12',
      crm_conduct:'2025-12-24',       crm_valid:'2026-12-31',
      ws_conduct:'2025-06-12',        ws_valid:'2026-12-31',
      alar_cfit_conduct:'2025-06-13', alar_cfit_valid:'2026-12-31',
      dg_conduct:'2025-10-06',        dg_valid:'2027-12-31',
      cet_conduct:'2025-04-24',       cet_valid:'2027-04-24',
      pbn_conduct:'2025-06-26',       pbn_valid:'2026-12-31',
      avsec_conduct:'2025-09-06',     avsec_valid:'2026-12-31',
      sms_conduct:'2025-08-05',       sms_valid:'2027-12-31',
      tcas_conduct:null,              tcas_valid:null,
      basic_indoc_conduct:'2025-05-08',
    },
    {
      name:'FLORIANUS ADEL', employee_id:'SMN.2025.1.048',
      license:'CPL 9615', email:'florianus.adel@flyjaya.com', phone:'81289282656',
      rank:'SIC', loa:null, status:'fit',
      ppc_conduct:'2026-01-15',       ppc_valid:'2027-01-31',
      ground_training_conduct:'2026-01-05', ground_training_valid:'2027-01-31',
      loft_conduct:'2026-01-14',      loft_valid:'2027-01-31',
      medex_conduct:'2025-10-31',     medex_valid:'2026-04-30',
      ielp_conduct:'2025-06-17',      ielp_valid:'2028-06-17',
      crm_conduct:'2026-02-09',       crm_valid:'2027-12-31',
      ws_conduct:'2026-02-11',        ws_valid:'2027-12-31',
      alar_cfit_conduct:'2026-02-12', alar_cfit_valid:'2027-12-31',
      dg_conduct:'2025-03-20',        dg_valid:'2027-12-31',
      cet_conduct:'2025-04-25',       cet_valid:'2027-04-25',
      pbn_conduct:'2025-06-26',       pbn_valid:'2026-12-31',
      avsec_conduct:'2025-03-21',     avsec_valid:'2026-12-31',
      sms_conduct:'2025-08-05',       sms_valid:'2027-12-31',
      tcas_conduct:null,              tcas_valid:null,
      basic_indoc_conduct:'2025-05-08',
    },
  ]

  for (const c of crews) {
    const res = await db.query(`
      INSERT INTO crews (
        name,employee_id,license,email,phone,rank,loa,status,
        ppc_conduct,ppc_valid,ground_training_conduct,ground_training_valid,
        loft_conduct,loft_valid,medex_conduct,medex_valid,
        ielp_conduct,ielp_valid,crm_conduct,crm_valid,
        ws_conduct,ws_valid,alar_cfit_conduct,alar_cfit_valid,
        dg_conduct,dg_valid,cet_conduct,cet_valid,
        pbn_conduct,pbn_valid,avsec_conduct,avsec_valid,
        sms_conduct,sms_valid,tcas_conduct,tcas_valid,
        basic_indoc_conduct
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,
        $25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37
      ) ON CONFLICT (employee_id) DO UPDATE SET
        name=EXCLUDED.name, updated_at=NOW()
      RETURNING id
    `, [
      c.name,c.employee_id,c.license,c.email,c.phone,c.rank,c.loa,c.status,
      c.ppc_conduct,c.ppc_valid,c.ground_training_conduct,c.ground_training_valid,
      c.loft_conduct,c.loft_valid,c.medex_conduct,c.medex_valid,
      c.ielp_conduct,c.ielp_valid,c.crm_conduct,c.crm_valid,
      c.ws_conduct,c.ws_valid,c.alar_cfit_conduct,c.alar_cfit_valid,
      c.dg_conduct,c.dg_valid,c.cet_conduct,c.cet_valid,
      c.pbn_conduct,c.pbn_valid,c.avsec_conduct,c.avsec_valid,
      c.sms_conduct,c.sms_valid,c.tcas_conduct,c.tcas_valid,
      c.basic_indoc_conduct,
    ])

    if (c.email) {
      const crewId = res.rows[0].id
      const pw = await bcrypt.hash(c.employee_id, 12)
      await db.query(`
        INSERT INTO users (name,email,password,role,crew_id)
        VALUES ($1,$2,$3,'crew',$4)
        ON CONFLICT (email) DO NOTHING
      `, [c.name, c.email, pw, crewId])
    }
  }

  console.log('✅ Seed complete!')
  console.log('   Admin: admin@flyjaya.com / Admin@1234')
  console.log('   Crew:  [email] / [Employee ID]')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
